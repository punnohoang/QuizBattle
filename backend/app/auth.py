from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from redis.asyncio import Redis
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_db
from .models import RefreshToken, User
from .schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserResponse
from .utils.redis import (
    LOCKOUT_DURATION_SECONDS,
    MAX_LOGIN_ATTEMPTS,
    get_login_attempt_key,
    get_redis,
    get_token_blacklist_key,
)
from .utils.tokens import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    verify_token,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserResponse:
    result = await db.execute(
        select(User).where(or_(User.email == payload.email, User.username == payload.username))
    )
    existing = result.scalar_one_or_none()
    if existing:
        if existing.email == payload.email:
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=400, detail="Username already taken")

    password_hash = bcrypt.hashpw(
        payload.password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    user = User(
        email=payload.email,
        username=payload.username,
        password=password_hash,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)
) -> TokenResponse:
    # Check brute force
    attempt_key = get_login_attempt_key(payload.email)
    attempts = await redis.get(attempt_key)
    if attempts and int(attempts) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again in 15 minutes.",
        )

    # Get user
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Validate password
    if not user or not bcrypt.checkpw(payload.password.encode("utf-8"), user.password.encode("utf-8")):
        # Increment failed attempts
        if attempts:
            await redis.incr(attempt_key)
        else:
            await redis.setex(attempt_key, LOCKOUT_DURATION_SECONDS, 1)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Clear failed attempts on success
    await redis.delete(attempt_key)

    # Generate tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # Set refresh token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenResponse:
    # Verify refresh token
    token_payload = verify_token(payload.refresh_token, token_type="refresh")
    if not token_payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Check if token is blacklisted
    blacklist_key = get_token_blacklist_key(payload.refresh_token)
    if await redis.get(blacklist_key):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    # Get user
    result = await db.execute(select(User).where(User.id == token_payload.sub))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Generate new tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # Set new refresh token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=204)
async def logout(
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> None:
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token not provided")

    # Verify token
    token_payload = verify_token(refresh_token, token_type="refresh")
    if not token_payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Add to blacklist in Redis (fast lookup)
    expire_timestamp = int(token_payload.exp.timestamp())
    ttl = expire_timestamp - int(datetime.now(timezone.utc).timestamp())
    if ttl > 0:
        blacklist_key = get_token_blacklist_key(refresh_token)
        await redis.setex(blacklist_key, ttl, "1")

    # Also store in database for persistence
    token_entry = RefreshToken(
        token=refresh_token,
        user_id=token_payload.sub,
        expires_at=token_payload.exp,
    )
    db.add(token_entry)
    await db.commit()
