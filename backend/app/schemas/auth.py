from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    avatar_url: Optional[str] = None
    role: str = "user"

    class Config:
        from_attributes = True


class GuestJoinRequest(BaseModel):
    nickname: str = Field(..., min_length=2, max_length=50)
    room_code: str = Field(..., min_length=6, max_length=10)


class GuestUser(BaseModel):
    id: Optional[int] = None
    email: Optional[EmailStr] = None
    username: str
    avatar_url: Optional[str] = None
    role: str = "guest"


class GuestJoinResponse(BaseModel):
    access_token: str
    room_code: str
    user: GuestUser


class UpdateMeRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    current_password: Optional[str] = Field(None, min_length=6, max_length=128)
    new_password: Optional[str] = Field(None, min_length=6, max_length=128)
    avatar_url: Optional[str] = None
