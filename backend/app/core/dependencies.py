from typing import Annotated

from fastapi import Depends, Header, Cookie, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import User
from types import SimpleNamespace
from .security import verify_token
from .cache import get_redis, get_token_blacklist_key
from redis.asyncio import Redis
from ..services.auth_service import AuthService


async def get_current_user(
    authorization: str | None = Header(default=None),
    access_token: str | None = Cookie(default=None),
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> User:
    """
    Dependency to extract and verify JWT access token from Authorization header.
    Returns current authenticated user.
    
    Raises:
        HTTPException 401: If token is missing, invalid, or expired
        HTTPException 404: If user not found
    """
    token = None

    # Prefer Authorization header
    if authorization:
        try:
            scheme, token_value = authorization.split(" ")
            if scheme.lower() != "bearer":
                raise ValueError("Invalid authentication scheme")
            token = token_value
            token_payload = verify_token(token, token_type="access")
            if not token_payload:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired access token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header format. Use 'Bearer {token}'",
                headers={"WWW-Authenticate": "Bearer"},
            )
    # Fallback to access_token cookie
    elif access_token:
        token_payload = verify_token(access_token, token_type="access")
        if not token_payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    # If only refresh_token cookie present, validate it (and check blacklist)
    elif refresh_token:
        # Check blacklist in Redis
        blacklisted = await redis.get(get_token_blacklist_key(refresh_token))
        if blacklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token revoked",
            )

        token_payload = verify_token(refresh_token, token_type="refresh")
        if not token_payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # If token indicates a guest user, construct a transient user-like object
    if getattr(token_payload, "role", None) == "guest":
        nickname = getattr(token_payload, "nickname", None) or "Guest"
        guest_id = str(token_payload.sub)
        user = SimpleNamespace()
        user.id = guest_id
        user.username = nickname
        user.email = None
        user.avatar_url = None
        user.is_active = True
        user.role = "guest"
        return user

    # Get user from database for real users
    result = await db.execute(select(User).where(User.id == int(token_payload.sub)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Attach role to the user object (runtime only, not in DB)
    user.role = token_payload.role
    return user


async def require_real_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Dependency to ensure the current user is a real user (not a guest)."""
    if hasattr(user, "role") and user.role == "guest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest users are not allowed to perform this action.",
        )
    return user


# Type aliases for cleaner usage
CurrentUser = Annotated[User, Depends(get_current_user)]
RealUser = Annotated[User, Depends(require_real_user)]

async def get_auth_service(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
) -> AuthService:
    """Dependency to provide a configured AuthService instance."""
    return AuthService(db, redis)
