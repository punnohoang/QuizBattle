"""
Testing Guide - WebSocket & Lobby Events

How to test the BE - Setup base WebSocket & Lobby Events feature
"""

# ============================================================================
# OPTION 1: Manual Testing with wscat (Terminal)
# ============================================================================

"""
Prerequisites:
- Backend running: docker compose up --build
- Redis running: (included in docker-compose)
- PostgreSQL running: (included in docker-compose)

Installation:
npm install -g wscat
or
apt-get install wscat

Steps:

1. Get JWT token first (login endpoint)
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "password123"
     }'
   
   Copy the "access_token" from response

2. Create a room
   curl -X POST http://localhost:8000/api/v1/rooms \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "quiz_id": 1
     }'
   
   Copy the "room_code" from response (e.g., "ABC123")

3. Connect to WebSocket (Terminal 1)
   wscat -c 'ws://localhost:8000/ws/room/ABC123?token=YOUR_TOKEN'
   
   You should see connection established

4. Connect second player (Terminal 2)
   wscat -c 'ws://localhost:8000/ws/room/ABC123?token=OTHER_USER_TOKEN'
   
   In Terminal 1, you should see:
   {
     "event": "player_joined",
     "player": {"user_id": 2, "username": "otheruser"},
     "participants": [
       {"user_id": 1, "username": "testuser"},
       {"user_id": 2, "username": "otheruser"}
     ]
   }

5. Disconnect Terminal 2 (Ctrl+C)
   In Terminal 1, you should see:
   {
     "event": "player_left",
     "player": {"user_id": 2, "username": "otheruser"},
     "participants": [
       {"user_id": 1, "username": "testuser"}
     ]
   }
"""


# ============================================================================
# OPTION 2: Python Testing Script
# ============================================================================

import asyncio
import json
import httpx
import websockets
from websockets.client import WebSocketClientProtocol

# Configuration
API_BASE = "http://localhost:8000/api/v1"
WS_BASE = "ws://localhost:8000/ws"

# Test credentials
TEST_USER_1 = {
    "email": "user1@test.com",
    "password": "password123",
    "username": "user1"
}

TEST_USER_2 = {
    "email": "user2@test.com", 
    "password": "password123",
    "username": "user2"
}

TEST_QUIZ_ID = 1


async def login_user(user_data: dict) -> str:
    """Login and get JWT token"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_BASE}/auth/login",
            json={
                "email": user_data["email"],
                "password": user_data["password"]
            }
        )
        token = response.json()["access_token"]
        print(f"✓ Logged in as {user_data['email']}")
        return token


async def create_room(token: str) -> str:
    """Create a new room"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_BASE}/rooms",
            headers={"Authorization": f"Bearer {token}"},
            json={"quiz_id": TEST_QUIZ_ID}
        )
        room_code = response.json()["room_code"]
        print(f"✓ Created room: {room_code}")
        return room_code


async def connect_to_room(room_code: str, token: str) -> WebSocketClientProtocol:
    """Connect to room via WebSocket"""
    url = f"{WS_BASE}/room/{room_code}?token={token}"
    ws = await websockets.connect(url)
    print(f"✓ Connected to room {room_code}")
    return ws


async def listen_for_events(ws: WebSocketClientProtocol, name: str):
    """Listen for WebSocket events"""
    try:
        async for message in ws:
            data = json.loads(message)
            print(f"\n[{name}] Received event: {data['event']}")
            if data.get("player"):
                print(f"  Player: {data['player']['username']} (ID: {data['player']['user_id']})")
            if data.get("participants"):
                print(f"  Participants: {len(data['participants'])} in room")
                for p in data['participants']:
                    print(f"    - {p['username']} (ID: {p['user_id']})")
    except websockets.exceptions.ConnectionClosed:
        print(f"[{name}] Connection closed")


async def main_test_flow():
    """Main test flow"""
    print("=" * 70)
    print("TESTING: BE - Setup base WebSocket & Lobby Events")
    print("=" * 70)
    
    try:
        # Step 1: Login both users
        print("\n[STEP 1] Logging in users...")
        token1 = await login_user(TEST_USER_1)
        token2 = await login_user(TEST_USER_2)
        
        # Step 2: Create room
        print("\n[STEP 2] Creating room...")
        room_code = await create_room(token1)
        
        # Step 3: Connect first player
        print("\n[STEP 3] Connecting player 1...")
        ws1 = await connect_to_room(room_code, token1)
        
        # Start listening in background
        task1 = asyncio.create_task(listen_for_events(ws1, "Player 1"))
        
        # Wait a bit
        await asyncio.sleep(1)
        
        # Step 4: Connect second player
        print("\n[STEP 4] Connecting player 2...")
        ws2 = await connect_to_room(room_code, token2)
        task2 = asyncio.create_task(listen_for_events(ws2, "Player 2"))
        
        # Player 1 should receive "player_joined" event
        await asyncio.sleep(2)
        
        # Step 5: Disconnect player 2
        print("\n[STEP 5] Disconnecting player 2...")
        await ws2.close()
        
        # Player 1 should receive "player_left" event
        await asyncio.sleep(2)
        
        # Cleanup
        await ws1.close()
        await task1
        await task2
        
        print("\n" + "=" * 70)
        print("✅ TEST COMPLETED SUCCESSFULLY")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        raise


# Run test
if __name__ == "__main__":
    asyncio.run(main_test_flow())


# ============================================================================
# OPTION 3: Simple Python WebSocket Test
# ============================================================================

"""
Quick test without full integration:

import asyncio
import websockets
import json

async def test_ws():
    # First, get token from login endpoint
    token = "YOUR_JWT_TOKEN_HERE"
    room_code = "ABC123"  # From create_room endpoint
    
    uri = f"ws://localhost:8000/ws/room/{room_code}?token={token}"
    
    async with websockets.connect(uri) as ws:
        print("Connected!")
        
        # Listen for 10 seconds
        try:
            async for message in ws:
                data = json.loads(message)
                print(f"Event: {data['event']}")
                print(f"Data: {json.dumps(data, indent=2)}")
        except asyncio.TimeoutError:
            print("No message received (timeout)")

asyncio.run(test_ws())
"""


# ============================================================================
# OPTION 4: Redis Verification
# ============================================================================

"""
Check Redis data directly:

# Connect to Redis
redis-cli -p 6379

# Check players in room (room_id = 1)
SMEMBERS quiz-room:1:players

# Should show:
# 1) "101:user1"
# 2) "102:user2"

# Check room state
HGETALL quiz-room:1:state

# Should show:
# 1) "state"
# 2) "false" (or "true" if quiz started)

# Check room code mapping
GET room_code:ABC123

# Should show:
# (integer) 1  (the room_id)
"""


# ============================================================================
# OPTION 5: Complete Test Checklist
# ============================================================================

"""
TESTING CHECKLIST:

Preconditions:
  ☐ Backend running: docker compose up --build
  ☐ Database seeded with test quiz
  ☐ Two test users created in database
  ☐ Redis running and accessible

WebSocket Connection Tests:
  ☐ Can connect without token → should fail (401)
  ☐ Can connect with invalid token → should fail (401)
  ☐ Can connect with valid token → should succeed
  ☐ Can connect with invalid room code → should fail (401)

Player Join Event Test:
  ☐ Player 1 connects to room
  ☐ Player 2 connects to same room
  ☐ Player 1 receives "player_joined" event
  ☐ Event contains correct player info (user_id, username)
  ☐ Event contains participant list with both players
  ☐ Redis updated with new player

Player Leave Event Test:
  ☐ Player 2 disconnects
  ☐ Player 1 receives "player_left" event
  ☐ Event contains correct player info
  ☐ Event contains updated participant list
  ☐ Redis updated to remove player

Multiple Players Test:
  ☐ 3+ players connect to same room
  ☐ Each receives correct player_joined events
  ☐ Participant list shows all players
  ☐ One player disconnects
  ☐ Others receive correct player_left event

Redis State Test:
  ☐ quiz-room:{id}:players set contains all players
  ☐ quiz-room:{id}:state hash exists
  ☐ room_code:{code} maps to correct room_id
  ☐ All TTLs are set correctly

Broadcast Verification:
  ☐ All connected clients receive events
  ☐ Events are broadcast to all clients
  ☐ No events duplicated
  ☐ Message format is valid JSON
"""


# ============================================================================
# OPTION 6: Debugging Tips
# ============================================================================

"""
If test fails:

1. Check backend logs:
   docker logs quizbattle-backend-1

2. Check Redis:
   redis-cli
   KEYS "quiz-room:*"
   SMEMBERS quiz-room:1:players

3. Check WebSocket connection:
   - Is port 8000 accessible?
   - Is token valid?
   - Is room_code correct?

4. Check database:
   - Are users created?
   - Is quiz created?

5. Enable debug logging:
   - Set LOG_LEVEL=DEBUG in .env
   - Restart backend

6. Use wscat verbose:
   wscat -c 'ws://localhost:8000/ws/room/ABC123?token=TOKEN' -v

7. Network debugging:
   netstat -tlnp | grep 8000
"""
