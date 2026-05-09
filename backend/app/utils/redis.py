import os
from redis.asyncio import Redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


class RedisClient:
    _instance: Redis | None = None

    @classmethod
    async def get_instance(cls) -> Redis:
        if cls._instance is None:
            cls._instance = await Redis.from_url(REDIS_URL, decode_responses=True)
        return cls._instance

    @classmethod
    async def close(cls) -> None:
        if cls._instance:
            await cls._instance.close()
            cls._instance = None


async def get_redis() -> Redis:
    return await RedisClient.get_instance()


# Brute force protection keys
def get_login_attempt_key(email: str) -> str:
    return f"login_attempts:{email}"


def get_token_blacklist_key(token: str) -> str:
    return f"token_blacklist:{token}"


# Brute force: 5 attempts allowed, 15 min lockout
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 900  # 15 minutes
