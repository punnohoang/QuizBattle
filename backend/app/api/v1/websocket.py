import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, HTTPException

from app.core.cache import get_redis
from app.db import AsyncSessionLocal
from app.services.websocket_manager import (
    add_player_to_redis,
    get_room_id_by_code,
    get_room_players_from_redis,
    get_username,
    manager,
    remove_player_from_redis,
    verify_ws_token,
)
from app.services.game_state_manager import GameStateManager
from app.services.quiz_game_engine import get_game_engine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

@router.websocket("/{room_code}")
async def websocket_room(room_code: str, websocket: WebSocket):
    token = websocket.query_params.get("token")
    redis = await get_redis()
    user_id = None
    db = None
    username = None
    player = None

    try:
        logger.info(f"🔌 Connection attempt for room: {room_code}")
        # Accept early so client doesn't see "closed before established"
        await websocket.accept()

        # Verify token
        user_id = await verify_ws_token(token)
        logger.info(f"✅ Token verified for user: {user_id}")
    except HTTPException as e:
        logger.warning(f"❌ Invalid WebSocket token for room {room_code}: {e.detail}")
        try:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        except:
            pass
        return

    # Get room ID
    room_id = await get_room_id_by_code(redis, room_code)
    if room_id is None:
        logger.warning(f"❌ Room not found: {room_code}")
        try:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        except:
            pass
        return

    db = None
    try:
        # Create persistent DB session
        db = AsyncSessionLocal()
        
        # Get username
        username = await get_username(db, user_id)
        state_manager = GameStateManager(redis, db)

        # Register connection (already accepted)
        await manager.connect(room_code, websocket, user_id)
        logger.info(f"🚀 User {user_id} ({username}) connected to room {room_code}")
        
        # Add to Redis
        await add_player_to_redis(redis, room_id, user_id, username)

        player = {"user_id": user_id, "username": username}
        participants = await get_room_players_from_redis(redis, room_id)
        
        # Broadcast player joined
        await manager.broadcast(
            room_code,
            {
                "event": "player_joined",
                "player": player,
                "participants": participants,
            },
        )

        # Try to recover game state if reconnecting
        try:
            recovered_state = await state_manager.recover_game_state(room_id, user_id)
            if recovered_state:
                try:
                    await websocket.send_json({
                        "event": "state_recovered",
                        "state": recovered_state,
                        "message": "Game state recovered",
                    })
                    logger.info(f"✓ State recovered for user {user_id}")
                except Exception as e:
                    logger.error(f"Failed to send state_recovered: {e}")
        except Exception as e:
            logger.error(f"Error recovering state: {e}", exc_info=True)

        # Message loop - keep connection open
        try:
            while True:
                try:
                    data = await websocket.receive_text()
                    if data:
                        try:
                            message = json.loads(data)
                            
                            # Process submit_answer event
                            if message.get("event") == "submit_answer":
                                engine = await get_game_engine(redis, db)
                                q_index = message.get("question_index")
                                opt_ids = message.get("selected_option_ids", [])
                                time_taken = message.get("time_taken", 0)
                                
                                result = await engine.submit_answer(
                                    room_id=room_id,
                                    user_id=user_id,
                                    question_index=q_index,
                                    selected_option_ids=opt_ids,
                                    time_taken=time_taken,
                                    broadcast_callback=lambda msg: manager.broadcast(room_code, msg)
                                )
                                
                            
                                # Send confirmation/result back to player
                                await websocket.send_json({
                                    "event": "answer_result",
                                    "success": "error" not in result,
                                    "result": {
                                        "question_index": q_index,
                                        "is_correct": result.get("is_correct", False),
                                        "score": result.get("score", 0),
                                        "correct_option_ids": result.get("correct_option_ids", []),
                                    }
                                })
                        except json.JSONDecodeError:
                            continue
                except Exception as e:
                    logger.debug(f"Error receiving message: {e}")
                    break
        except WebSocketDisconnect:
            logger.info(f"User {user_id} disconnected from room {room_code}")
        finally:
            # Cleanup - disconnect and remove from Redis
            try:
                if username and user_id:
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
            except Exception as e:
                logger.error(f"Error during cleanup: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket handler: {e}", exc_info=True)
        try:
            await websocket.close()
        except:
            pass
    finally:
        # Close DB session
        if db:
            try:
                await db.close()
            except:
                pass
