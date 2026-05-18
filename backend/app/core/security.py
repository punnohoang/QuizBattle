from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from pydantic import BaseModel
from .config import settings

class TokenPayload(BaseModel):
    sub: str  # user_id
    role: str  # "user" or "guest"
    type: str  # "access" or "refresh"
    exp: datetime
    iat: datetime
    nickname: Optional[str] = None

# Export constants for backward compatibility if needed in routes
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

def create_access_token(user_id: int | str, role: str = "user", extra_claims: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": expires,
        "iat": now,
    }

    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int | str, role: str = "user", extra_claims: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "refresh",
        "exp": expires,
        "iat": now,
    }

    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def verify_token(token: str, token_type: str = "access") -> Optional[TokenPayload]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
