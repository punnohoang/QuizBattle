from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status

from app.core.config import settings
from app.schemas.auth import (
    LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, 
    UserResponse, GuestJoinRequest, GuestJoinResponse
)
from app.services.auth_service import AuthService
from app.core.rate_limit import rate_limit
from app.core.dependencies import get_auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse, dependencies=[Depends(rate_limit(settings.RATE_LIMIT_REGISTER))])
async def register(
    payload: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> UserResponse:
    """Register a new user."""
    return await auth_service.register_user(payload)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit(settings.RATE_LIMIT_LOGIN))])
async def login(
    payload: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """Authenticate user and return tokens."""
    user = await auth_service.authenticate_user(payload)
    tokens = await auth_service.generate_tokens(user.id)

    # Set tokens as HttpOnly cookies
    cookie_params = {
        "httponly": True,
        "secure": settings.APP_ENV == "production",
        "samesite": "lax",
    }

    response.set_cookie(
        key="refresh_token",
        value=tokens.refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        **cookie_params
    )

    response.set_cookie(
        key="access_token",
        value=tokens.access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **cookie_params
    )

    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """Refresh access token using refresh token."""
    user, tokens = await auth_service.refresh_access_token(payload.refresh_token)

    response.set_cookie(
        key="refresh_token",
        value=tokens.refresh_token,
        httponly=True,
        secure=settings.APP_ENV == "production",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )

    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str = Cookie(None),
    auth_service: AuthService = Depends(get_auth_service)
) -> None:
    """Logout user by blacklisting refresh token."""
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token not provided")

    await auth_service.logout_user(refresh_token)
    
    # Clear cookies
    response.delete_cookie("refresh_token")
    response.delete_cookie("access_token")


@router.post("/guest-join", response_model=GuestJoinResponse, dependencies=[Depends(rate_limit(5, 60))])
async def guest_join(
    payload: GuestJoinRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> GuestJoinResponse:
    """Create a guest session and return a JWT."""
    return await auth_service.guest_join(payload)
