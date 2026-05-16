from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status, File, UploadFile
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_redis
from app.core.dependencies import CurrentUser, RealUser
from app.core.security import REFRESH_TOKEN_EXPIRE_DAYS, ACCESS_TOKEN_EXPIRE_MINUTES
from app.db import get_db
from app.schemas.auth import (
    LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, 
    UserResponse, GuestJoinRequest, GuestJoinResponse, UpdateMeRequest
)
from app.services.auth_service import AuthService
from app.services.cloudinary_service import get_cloudinary_service, CloudinaryService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """Register a new user."""
    auth_service = AuthService(db, None)  # Redis not needed for registration
    user = await auth_service.register_user(payload)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
) -> TokenResponse:
    """Authenticate user and return tokens."""
    auth_service = AuthService(db, redis)
    user = await auth_service.authenticate_user(payload)
    tokens = await auth_service.generate_tokens(user.id)

    # Set refresh token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=tokens.refresh_token,
        httponly=True,
        secure=False,  # Set to False for local dev (HTTP)
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )

    # Also set access token in HttpOnly cookie for cookie-based auth flows
    response.set_cookie(
        key="access_token",
        value=tokens.access_token,
        httponly=True,
        secure=False,  # Set to False for local dev (HTTP)
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
) -> TokenResponse:
    """Refresh access token using refresh token."""
    auth_service = AuthService(db, redis)
    user, tokens = await auth_service.refresh_access_token(payload.refresh_token)

    # Set new refresh token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=tokens.refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )

    return tokens


@router.post("/logout", status_code=204)
async def logout(
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
) -> None:
    """Logout user by blacklisting refresh token."""
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token not provided")

    auth_service = AuthService(db, redis)
    await auth_service.logout_user(refresh_token)


@router.post("/guest-join", response_model=GuestJoinResponse)
async def guest_join(
    payload: GuestJoinRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
) -> GuestJoinResponse:
    """Create a guest session and return a JWT."""
    auth_service = AuthService(db, redis)
    return await auth_service.guest_join(payload)
