import asyncio
import websockets
import json
import requests
import time
import sys

BASE_URL = "http://localhost:8000/api/v1"
WS_URL = "ws://localhost:8000/ws/room"

def login(email, password):
    print(f"DEBUG: Attempting login for {email}...", flush=True)
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        print(f"DEBUG: Login status code: {resp.status_code}", flush=True)
        resp.raise_for_status()
        return resp.json()["access_token"]
    except Exception as e:
        print(f"DEBUG: Login failed: {e}", flush=True)
        raise

def create_tf_quiz(token):
    print("DEBUG: Creating TF Quiz...", flush=True)
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "title": f"TF Test {int(time.time())}",
        "description": "Test TF correctness",
        "category": "Test",
        "is_public": False
    }
    resp = requests.post(f"{BASE_URL}/quizzes", json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    quiz_id = resp.json()["id"]
    print(f"DEBUG: Quiz created with ID: {quiz_id}", flush=True)
    
    # Add a TF question
    question_payload = {
        "content": "1 + 1 = 2?",
        "type": "TF",
        "score_type": "normal",
        "time_limit": 10,
        "order_index": 0,
        "options": [
            {"content": "True", "is_correct": True, "order_index": 0},
            {"content": "False", "is_correct": False, "order_index": 1}
        ]
    }
    resp = requests.post(f"{BASE_URL}/quizzes/{quiz_id}/questions", json=question_payload, headers=headers, timeout=10)
    resp.raise_for_status()
    print("DEBUG: TF Question added.", flush=True)
    return quiz_id

def create_room(token, quiz_id):
    print("DEBUG: Creating Room...", flush=True)
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/rooms", json={"quiz_id": quiz_id}, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    print(f"DEBUG: Room created. Code: {data['room_code']}, ID: {data['id']}", flush=True)
    return data["room_code"], data["id"]

async def player_client(room_code, token):
    print(f"DEBUG: Player connecting to room {room_code}...", flush=True)
    try:
        async with websockets.connect(f"{WS_URL}/{room_code}?token={token}", timeout=10) as ws:
            # Wait for join confirmation
            msg = await ws.recv()
            print(f"DEBUG: Player received join msg: {msg}", flush=True)
            
            # Wait for events
            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                print(f"DEBUG: Player received event: {data.get('event')}", flush=True)
                
                if data.get("event") == "question_start":
                    q = data["question"]
                    q_idx = data["question_index"]
                    # Find the "True" option ID
                    true_opt_id = None
                    for opt in q["options"]:
                        if opt["content"] == "True":
                            true_opt_id = opt["id"]
                            break
                    
                    print(f"DEBUG: Submitting answer 'True' (ID: {true_opt_id}) for question {q_idx}...", flush=True)
                    await ws.send(json.dumps({
                        "event": "submit_answer",
                        "question_index": q_idx,
                        "selected_option_ids": [true_opt_id],
                        "time_taken": 2
                    }))
                
                elif data.get("event") == "answer_result":
                    print(f"DEBUG: ANSWER RESULT: {msg}", flush=True)
                    return data["result"]
                
                elif data.get("event") == "game_finished":
                    print("DEBUG: Game Finished!", flush=True)
                    break
    except Exception as e:
        print(f"DEBUG: Player WebSocket error: {e}", flush=True)
        raise

async def main():
    try:
        token = login("admin@example.com", "admin123")
        quiz_id = create_tf_quiz(token)
        room_code, room_id = create_room(token, quiz_id)
        
        player_token = login("testuser1@example.com", "password123")
        
        player_task = asyncio.create_task(player_client(room_code, player_token))
        await asyncio.sleep(2)
        
        print("DEBUG: Host starting room...", flush=True)
        headers = {"Authorization": f"Bearer {token}"}
        requests.post(f"{BASE_URL}/rooms/{room_code}/start", headers=headers, timeout=10).raise_for_status()
        
        await asyncio.sleep(4)
        
        print("DEBUG: Host starting questions...", flush=True)
        requests.post(f"{BASE_URL}/rooms/{room_code}/start-questions", headers=headers, timeout=10).raise_for_status()
        
        result = await player_task
        print("\n" + "="*40)
        if result.get("is_correct"):
            print("SUCCESS: Answer 'True' was marked as CORRECT!", flush=True)
        else:
            print("FAILURE: Answer 'True' was marked as WRONG!", flush=True)
            print(f"Details: {result}", flush=True)
        print("="*40 + "\n", flush=True)
        
    except Exception as e:
        print(f"DEBUG: Main error: {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
