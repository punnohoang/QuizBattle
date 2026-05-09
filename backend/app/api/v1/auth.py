from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_redis
from app.core.dependencies import CurrentUser
from app.core.security import REFRESH_TOKEN_EXPIRE_DAYS
from app.db import get_db
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.auth_service import AuthService

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
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
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
        secure=True,
        samesite="strict",
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


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser):
    """Get current authenticated user information."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
    }
