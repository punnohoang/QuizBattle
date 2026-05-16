from fastapi import HTTPException, Request, status
from redis.asyncio import Redis
from app.core.cache import get_redis
from typing import Optional
import time

class RateLimiter:
    def __init__(self, times: int, seconds: int = 60):
        self.times = times
        self.seconds = seconds

    async def __call__(self, request: Request):
        # Identify by IP address (can be changed to user_id if authenticated)
        # Use X-Forwarded-For if behind a proxy like Nginx
        client_ip = request.headers.get("X-Forwarded-For") or request.client.host
        path = request.url.path
        key = f"rate_limit:{path}:{client_ip}"
        
        redis = await get_redis()
        
        # Fixed window counter
        count = await redis.incr(key)
        
        if count == 1:
            await redis.expire(key, self.seconds)
            
        if count > self.times:
            retry_after = await redis.ttl(key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please slow down. Retry after {retry_after}s.",
                headers={"Retry-After": str(retry_after)}
            )

def rate_limit(times: int, seconds: int = 60):
    """
    Dependency helper for rate limiting.
    Usage: @router.post("/...", dependencies=[Depends(rate_limit(5, 60))])
    """
    return RateLimiter(times, seconds)
