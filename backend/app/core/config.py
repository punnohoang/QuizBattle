from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "QuizBattle API"
    APP_ENV: str = "local"
    API_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://0.0.0.0:3000"]
    
    # Security
    JWT_SECRET: str = "change_me_in_production_extremely_secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://quizbattle:quizbattle@localhost:5432/quizbattle_db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    
    # Rate Limiting
    RATE_LIMIT_LOGIN: int = 5  # requests per minute
    RATE_LIMIT_REGISTER: int = 3  # requests per minute
    RATE_LIMIT_UPLOAD: int = 5  # requests per minute

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
