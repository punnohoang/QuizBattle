from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.core.dependencies import RealUser, get_auth_service
from app.schemas.auth import UpdateMeRequest, UserResponse
from app.services.auth_service import AuthService
from app.services.cloudinary_service import get_cloudinary_service, CloudinaryService
from app.core.rate_limit import rate_limit
from app.core.config import settings

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: RealUser) -> UserResponse:
    """Get current user information."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateMeRequest,
    current_user: RealUser,
    auth_service: AuthService = Depends(get_auth_service)
) -> UserResponse:
    """Update current user information."""
    return await auth_service.update_user(current_user.id, payload)


@router.post("/avatar", response_model=UserResponse, dependencies=[Depends(rate_limit(settings.RATE_LIMIT_UPLOAD))])
async def upload_avatar(
    current_user: RealUser,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    cloudinary: CloudinaryService = Depends(get_cloudinary_service)
) -> UserResponse:
    """Upload user avatar to Cloudinary."""
    # Upload to Cloudinary
    avatar_url = await cloudinary.upload_image(file)

    # Update user in DB
    auth_service = AuthService(db, None)
    return await auth_service.update_user(current_user.id, UpdateMeRequest(avatar_url=avatar_url))
