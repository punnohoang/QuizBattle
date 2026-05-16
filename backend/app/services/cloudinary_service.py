import cloudinary
import cloudinary.uploader
import cloudinary.api
from fastapi import UploadFile, HTTPException
from app.core.config import settings

class CloudinaryService:
    def __init__(self):
        # Configuration is now centralized in settings
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )

    async def upload_image(self, file: UploadFile, folder: str = "quizbattle/avatars") -> str:
        """
        Upload an image to Cloudinary and return the secure URL.
        """
        try:
            # Read file content
            content = await file.read()
            
            # Upload to Cloudinary
            result = cloudinary.uploader.upload(
                content,
                folder=folder,
                resource_type="image"
            )
            
            return result.get("secure_url")
        except Exception as e:
            print(f"Cloudinary upload error: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload image to Cloudinary")
        finally:
            await file.seek(0) # Reset file pointer

    async def delete_image(self, public_id: str):
        """
        Delete an image from Cloudinary using its public ID.
        """
        try:
            cloudinary.uploader.destroy(public_id)
        except Exception as e:
            print(f"Cloudinary deletion error: {e}")

# Global instance
_cloudinary_service = None

def get_cloudinary_service() -> CloudinaryService:
    global _cloudinary_service
    if _cloudinary_service is None:
        _cloudinary_service = CloudinaryService()
    return _cloudinary_service
