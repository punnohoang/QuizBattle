from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import RealUser, CurrentUser
from app.db import get_db
from app.schemas.auth import UpdateMeRequest, UserResponse
from app.services.auth_service import AuthService
from app.services.cloudinary_service import get_cloudinary_service, CloudinaryService

router = APIRouter(prefix="/users", tags=["users"])

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

@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateMeRequest,
    current_user: RealUser,
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """Update current user profile."""
    auth_service = AuthService(db, None)
    return await auth_service.update_user(current_user.id, payload)

@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    current_user: RealUser,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    cloudinary: CloudinaryService = Depends(get_cloudinary_service)
) -> UserResponse:
    """Upload and update user avatar."""
    # 1. Upload to Cloudinary
    url = await cloudinary.upload_image(file)
    
    # 2. Update DB
    auth_service = AuthService(db, None)
    return await auth_service.update_user(current_user.id, UpdateMeRequest(avatar_url=url))
