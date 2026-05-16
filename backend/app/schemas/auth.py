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
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    role: str = "user"

    class Config:
        from_attributes = True


class GuestJoinRequest(BaseModel):
    nickname: str = Field(..., min_length=2, max_length=50)
    room_code: str = Field(..., min_length=6, max_length=10)


class GuestJoinResponse(BaseModel):
    access_token: str
    room_code: str
    user: UserResponse
