from datetime import datetime, timezone
from typing import Optional
import uuid

import bcrypt
from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import (
    LOCKOUT_DURATION_SECONDS,
    MAX_LOGIN_ATTEMPTS,
    get_login_attempt_key,
    get_token_blacklist_key,
)
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.models import RefreshToken, User, GameSession
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse, GuestJoinRequest, GuestJoinResponse, UpdateMeRequest
from app.services.room_service import RoomService


class AuthService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def register_user(self, payload: RegisterRequest) -> User:
        """Register a new user with validation."""
        await self._validate_registration_data(payload)

        password_hash = self._hash_password(payload.password)
        user = User(
            email=payload.email,
            username=payload.username,
            password=password_hash,
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate_user(self, payload: LoginRequest) -> User:
        """Authenticate user with brute force protection."""
        await self._check_brute_force_protection(payload.email)

        user = await self._get_user_by_email(payload.email)
        if not user or not self._verify_password(payload.password, user.password):
            await self._handle_failed_login(payload.email)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        await self._clear_login_attempts(payload.email)
        return user

    async def generate_tokens(self, user_id: int, role: str = "user") -> TokenResponse:
        """Generate access and refresh tokens for user."""
        access_token = create_access_token(user_id, role)
        refresh_token = create_refresh_token(user_id, role)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def refresh_access_token(self, refresh_token: str) -> tuple[User, TokenResponse]:
        """Validate refresh token and generate new tokens."""
        token_payload = self._verify_refresh_token(refresh_token)
        await self._check_token_not_blacklisted(refresh_token)

        user = await self._get_user_by_id(int(token_payload.sub))
        new_tokens = await self.generate_tokens(user.id, role=token_payload.role)

        return user, new_tokens

    async def logout_user(self, refresh_token: str) -> None:
        """Logout user by blacklisting refresh token."""
        token_payload = self._verify_refresh_token(refresh_token)
        await self._blacklist_token(refresh_token, token_payload)

        # Store in database for persistence
        token_entry = RefreshToken(
            token=refresh_token,
            user_id=int(token_payload.sub),
            expires_at=token_payload.exp.replace(tzinfo=None),
        )
        self.db.add(token_entry)
        await self.db.commit()

    async def _validate_registration_data(self, payload: RegisterRequest) -> None:
        """Validate registration data and check for existing users."""
        result = await self.db.execute(
            select(User).where(or_(User.email == payload.email, User.username == payload.username))
        )
        existing = result.scalar_one_or_none()

        if existing:
            if existing.email == payload.email:
                raise HTTPException(status_code=400, detail="Email already registered")
            raise HTTPException(status_code=400, detail="Username already taken")

    def _hash_password(self, password: str) -> str:
        """Hash password using bcrypt."""
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash."""
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )

    async def _check_brute_force_protection(self, email: str) -> None:
        """Check if user has exceeded login attempts."""
        attempt_key = get_login_attempt_key(email)
        attempts = await self.redis.get(attempt_key)

        if attempts and int(attempts) >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Try again in 15 minutes.",
            )

    async def _handle_failed_login(self, email: str) -> None:
        """Increment failed login attempts counter."""
        attempt_key = get_login_attempt_key(email)
        attempts = await self.redis.get(attempt_key)

        if attempts:
            await self.redis.incr(attempt_key)
        else:
            await self.redis.setex(attempt_key, LOCKOUT_DURATION_SECONDS, 1)

    async def _clear_login_attempts(self, email: str) -> None:
        """Clear login attempts counter on successful login."""
        attempt_key = get_login_attempt_key(email)
        await self.redis.delete(attempt_key)

    async def _get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address."""
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def _get_user_by_id(self, user_id: int) -> User:
        """Get user by ID, raise exception if not found."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    def _verify_refresh_token(self, token: str) -> any:
        """Verify refresh token validity."""
        token_payload = verify_token(token, token_type="refresh")
        if not token_payload:
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        return token_payload

    async def _check_token_not_blacklisted(self, token: str) -> None:
        """Check if token is blacklisted."""
        blacklist_key = get_token_blacklist_key(token)
        if await self.redis.get(blacklist_key):
            raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    async def _blacklist_token(self, token: str, token_payload: any) -> None:
        """Add token to blacklist with appropriate TTL."""
        expire_timestamp = int(token_payload.exp.timestamp())
        ttl = expire_timestamp - int(datetime.now(timezone.utc).timestamp())

        if ttl > 0:
            blacklist_key = get_token_blacklist_key(token)
            await self.redis.setex(blacklist_key, ttl, "1")
    async def guest_join(self, payload: GuestJoinRequest) -> GuestJoinResponse:
        """Create a shadow user for a guest and issue a JWT."""
        # 1. Verify room exists and is in waiting state
        result = await self.db.execute(
            select(GameSession).where(GameSession.room_code == payload.room_code)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Room not found")
        if session.status.lower() != "waiting":
            raise HTTPException(
                status_code=400, 
                detail=f"Room is already {session.status}. Guests can only join waiting rooms."
            )

        # 2. Create shadow user
        guest_uuid = uuid.uuid4()
        guest_email = f"guest_{guest_uuid}@quizbattle.com"
        
        # Ensure username uniqueness (shadow users might have same nicknames)
        guest_username = payload.nickname
        username_check = await self.db.execute(select(User).where(User.username == guest_username))
        if username_check.scalar_one_or_none():
            guest_username = f"{payload.nickname}_{str(guest_uuid)[:8]}"

        hashed_password = self._hash_password("guest")
        
        user = User(
            email=guest_email,
            username=guest_username,
            password=hashed_password,
        )
        self.db.add(user)
        
        try:
            await self.db.commit()
            await self.db.refresh(user)
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(status_code=500, detail="Failed to create guest user")

        # 3. Generate tokens
        tokens = await self.generate_tokens(user.id, role="guest")

        return GuestJoinResponse(
            access_token=tokens.access_token,
            room_code=payload.room_code,
            user=UserResponse(
                id=user.id,
                email=user.email,
                username=user.username,
                role="guest"
            )
        )

    async def update_user(self, user_id: int, payload: UpdateMeRequest) -> User:
        """Update user profile details."""
        # 1. Get user
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # 2. Update username if provided
        if payload.username and payload.username != user.username:
            # Check uniqueness
            existing = await self.db.execute(select(User).where(User.username == payload.username))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Username already taken")
            user.username = payload.username

        # 3. Update password if both current and new are provided
        if payload.new_password:
            if not payload.current_password:
                raise HTTPException(status_code=400, detail="Current password required to set new password")
            
            # Verify current
            if not bcrypt.checkpw(payload.current_password.encode("utf-8"), user.password.encode("utf-8")):
                raise HTTPException(status_code=400, detail="Incorrect current password")
            
            user.password = self._hash_password(payload.new_password)

        # 4. Update avatar if provided
        if payload.avatar_url:
            user.avatar_url = payload.avatar_url

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        return user
