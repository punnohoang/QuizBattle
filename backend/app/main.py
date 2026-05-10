from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.api.router import api_router
from app.core.cache import RedisClient, get_redis
from app.db import AsyncSessionLocal, init_db
from app.models import Base
from app.services.websocket_manager import (
    add_player_to_redis,
    get_room_id_by_code,
    get_room_players_from_redis,
    get_username,
    manager,
    remove_player_from_redis,
    verify_ws_token,
)

app = FastAPI(title="QuizBattle API")


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="QuizBattle API",
        version="1.0.0",
        routes=app.routes,
    )
    
    openapi_schema["components"]["securitySchemes"] = {
        "Bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    
    # Mark protected endpoints with security requirement
    for path, path_item in openapi_schema.get("paths", {}).items():
        for operation in path_item.values():
            if isinstance(operation, dict) and "security" not in operation:
                # Thêm security vào tất cả endpoints trừ auth/login, auth/register
                if "auth/login" not in path and "auth/register" not in path:
                    operation["security"] = [{"Bearer": []}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()
    await RedisClient.get_instance()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await RedisClient.close()


app.include_router(api_router)

@app.websocket("/ws/room/{room_code}")
async def websocket_room(room_code: str, websocket: WebSocket):
    token = websocket.query_params.get("token")
    redis = await get_redis()

    try:
        user_id = await verify_ws_token(token)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    room_id = await get_room_id_by_code(redis, room_code)
    if room_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with AsyncSessionLocal() as db:
        username = await get_username(db, user_id)

    await manager.connect(room_code, websocket, user_id)
    await add_player_to_redis(redis, room_id, user_id, username)

    player = {"user_id": user_id, "username": username}
    participants = await get_room_players_from_redis(redis, room_id)
    await manager.broadcast(
        room_code,
        {
            "event": "player_joined",
            "player": player,
            "participants": participants,
        },
    )

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(room_code, websocket, user_id)
        await remove_player_from_redis(redis, room_id, user_id, username)

        participants = await get_room_players_from_redis(redis, room_id)
        await manager.broadcast(
            room_code,
            {
                "event": "player_left",
                "player": player,
                "participants": participants,
            },
        )


@app.get("/")
async def root():
    return {"message": "QuizBattle API Running"}