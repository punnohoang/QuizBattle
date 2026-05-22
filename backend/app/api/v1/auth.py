from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status, Request

from app.core.config import settings
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse,
    UserResponse, GuestJoinRequest, GuestJoinResponse,
    RefreshRequest
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
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """Authenticate user and return tokens."""
    user = await auth_service.authenticate_user(payload)
    tokens = await auth_service.generate_tokens(user.id)

    # Set tokens as HttpOnly cookies
    secure_cookie = request.url.scheme == "https"
    samesite_value = "none" if secure_cookie and settings.APP_ENV == "production" else "lax"
    cookie_params = {
        "httponly": True,
        "secure": secure_cookie,
        "samesite": samesite_value,
        "path": "/",
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
    response: Response,
    request: Request,
    payload: RefreshRequest | None = None,
    refresh_token: str = Cookie(None),
    auth_service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """Refresh access and refresh tokens using the HttpOnly refresh_token cookie."""
    refresh_token_value = refresh_token or (payload.refresh_token if payload else None)

    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not provided")

    user, tokens = await auth_service.refresh_access_token(refresh_token_value)

    secure_cookie = request.url.scheme == "https"
    samesite_value = "none" if secure_cookie and settings.APP_ENV == "production" else "lax"
    cookie_params = {
        "httponly": True,
        "secure": secure_cookie,
        "samesite": samesite_value,
        "path": "/",
    }

    response.set_cookie(
        key="access_token",
        value=tokens.access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **cookie_params
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens.refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        **cookie_params
    )

    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    request: Request,
    refresh_token: str = Cookie(None),
    auth_service: AuthService = Depends(get_auth_service)
) -> None:
    """Logout user by blacklisting refresh token."""
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token not provided")

    await auth_service.logout_user(refresh_token)
    
    # Clear cookies
    secure_cookie = request.url.scheme == "https"
    samesite_value = "none" if secure_cookie and settings.APP_ENV == "production" else "lax"
    cookie_params = {
        "secure": secure_cookie,
        "samesite": samesite_value,
        "path": "/",
    }

    response.delete_cookie("refresh_token", **cookie_params)
    response.delete_cookie("access_token", **cookie_params)


@router.post("/guest-join", response_model=GuestJoinResponse, dependencies=[Depends(rate_limit(5, 60))])
async def guest_join(
    payload: GuestJoinRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> GuestJoinResponse:
    """Create a guest session and return a JWT."""
    return await auth_service.guest_join(payload)
