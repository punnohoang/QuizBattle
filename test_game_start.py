#!/usr/bin/env python3
"""
Test script for Game Start feature
Tests the POST /api/v1/rooms/{code}/start endpoint
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

# Test accounts
TEST_ADMIN = {"email": "admin@example.com", "password": "admin123"}
TEST_USER1 = {"email": "testuser1@example.com", "password": "password123"}
TEST_USER2 = {"email": "testuser2@example.com", "password": "password123"}

def get_token(email: str, password: str) -> str:
    """Login and get access token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code != 200:
        print(f"❌ Login failed: {response.json()}")
        sys.exit(1)
    return response.json()["access_token"]

def create_quiz(token: str) -> int:
    """Create a test quiz"""
    headers = {"Authorization": f"Bearer {token}"}
    
    quiz_data = {
        "title": "Test Quiz for Game Start",
        "description": "Testing game start feature",
        "category": "Testing",
        "is_public": False
    }
    
    response = requests.post(
        f"{BASE_URL}/quizzes",
        json=quiz_data,
        headers=headers
    )
    
    if response.status_code != 201:
        print(f"❌ Quiz creation failed: {response.json()}")
        sys.exit(1)
    
    quiz_id = response.json()["id"]
    print(f"✅ Quiz created: ID={quiz_id}")
    return quiz_id

def add_questions(token: str, quiz_id: int):
    """Add questions to quiz"""
    headers = {"Authorization": f"Bearer {token}"}
    
    questions = [
        {
            "content": "What is 2 + 2?",
            "type": "MTC",
            "score_type": "normal",
            "time_limit": 30,
            "order_index": 0,
            "options": [
                {"content": "4", "is_correct": True, "order_index": 0},
                {"content": "5", "is_correct": False, "order_index": 1},
                {"content": "3", "is_correct": False, "order_index": 2},
            ]
        },
        {
            "content": "What is the capital of France?",
            "type": "MTC",
            "score_type": "double",
            "time_limit": 30,
            "order_index": 1,
            "options": [
                {"content": "Paris", "is_correct": True, "order_index": 0},
                {"content": "Berlin", "is_correct": False, "order_index": 1},
                {"content": "London", "is_correct": False, "order_index": 2},
            ]
        }
    ]
    
    for q in questions:
        response = requests.post(
            f"{BASE_URL}/quizzes/{quiz_id}/questions",
            json=q,
            headers=headers
        )
        if response.status_code != 201:
            print(f"❌ Question creation failed: {response.json()}")
            sys.exit(1)
    
    print(f"✅ Added {len(questions)} questions to quiz")

def create_room(token: str, quiz_id: int) -> str:
    """Create a game room"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.post(
        f"{BASE_URL}/rooms",
        json={"quiz_id": quiz_id},
        headers=headers
    )
    
    if response.status_code != 201:
        print(f"❌ Room creation failed: {response.json()}")
        sys.exit(1)
    
    room_code = response.json()["room_code"]
    print(f"✅ Room created: {room_code}")
    return room_code

def test_start_as_host(token: str, room_code: str):
    """Test: Host can start game"""
    print("\n🧪 Test 1: Host can start game")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.post(
        f"{BASE_URL}/rooms/{room_code}/start",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Status: {data['status']}")
        print(f"✅ Started at: {data['started_at']}")
        print(f"✅ Test PASSED: Host can start game")
        return True
    else:
        print(f"❌ Test FAILED: {response.status_code} - {response.json()}")
        return False

def test_start_as_non_host(host_room_code: str, non_host_token: str):
    """Test: Non-host cannot start game"""
    print("\n🧪 Test 2: Non-host cannot start game")
    
    # Create a new room first
    quiz_token = get_token(TEST_ADMIN["email"], TEST_ADMIN["password"])
    quiz_id = create_quiz(quiz_token)
    add_questions(quiz_token, quiz_id)
    room_code = create_room(quiz_token, quiz_id)
    
    headers = {"Authorization": f"Bearer {non_host_token}"}
    
    response = requests.post(
        f"{BASE_URL}/rooms/{room_code}/start",
        headers=headers
    )
    
    if response.status_code == 403:
        print(f"✅ Got 403 Forbidden")
        print(f"✅ Message: {response.json().get('detail', 'N/A')}")
        print(f"✅ Test PASSED: Non-host cannot start game")
        return True
    else:
        print(f"❌ Test FAILED: Expected 403, got {response.status_code}")
        return False

def test_cannot_start_twice(token: str, room_code: str):
    """Test: Cannot start game twice"""
    print("\n🧪 Test 3: Cannot start game twice")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Second attempt
    response = requests.post(
        f"{BASE_URL}/rooms/{room_code}/start",
        headers=headers
    )
    
    if response.status_code == 400:
        print(f"✅ Got 400 Bad Request")
        print(f"✅ Message: {response.json().get('detail', 'N/A')}")
        print(f"✅ Test PASSED: Cannot start game twice")
        return True
    else:
        print(f"❌ Test FAILED: Expected 400, got {response.status_code}")
        print(f"Response: {response.json()}")
        return False

def test_room_not_found():
    """Test: Room not found"""
    print("\n🧪 Test 4: Room not found")
    token = get_token(TEST_ADMIN["email"], TEST_ADMIN["password"])
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.post(
        f"{BASE_URL}/rooms/INVALID/start",
        headers=headers
    )
    
    if response.status_code == 404:
        print(f"✅ Got 404 Not Found")
        print(f"✅ Message: {response.json().get('detail', 'N/A')}")
        print(f"✅ Test PASSED: Room not found returns 404")
        return True
    else:
        print(f"❌ Test FAILED: Expected 404, got {response.status_code}")
        return False

def check_redis_cache(room_id: int):
    """Check if questions are cached in Redis"""
    print(f"\n🧪 Test 5: Check Redis cache")
    
    import subprocess
    
    # Use docker exec to run redis-cli (note: key is "quiz-room:{room_id}:question" not "questions")
    result = subprocess.run(
        ["docker", "exec", "quizbattle_redis", "redis-cli", "LLEN", f"quiz-room:{room_id}:question"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        count = int(result.stdout.strip())
        if count > 0:
            print(f"✅ Found {count} questions in Redis cache")
            
            # Get first question
            result2 = subprocess.run(
                ["docker", "exec", "quizbattle_redis", "redis-cli", "LINDEX", f"quiz-room:{room_id}:question", "0"],
                capture_output=True,
                text=True
            )
            if result2.returncode == 0:
                q = json.loads(result2.stdout.strip())
                print(f"✅ First question: {q['content']}")
                print(f"✅ Options count: {len(q['options'])}")
            
            print(f"✅ Test PASSED: Questions cached in Redis")
            return True
    
    print(f"❌ Test FAILED: Could not verify Redis cache")
    print(f"Error: {result.stderr}")
    return False

def main():
    print("=" * 60)
    print("🎮 Testing Game Start Feature")
    print("=" * 60)
    
    # Setup: Create quiz and room
    print("\n📋 Setup Phase")
    admin_token = get_token(TEST_ADMIN["email"], TEST_ADMIN["password"])
    user2_token = get_token(TEST_USER2["email"], TEST_USER2["password"])
    
    quiz_id = create_quiz(admin_token)
    add_questions(admin_token, quiz_id)
    room_code = create_room(admin_token, quiz_id)
    
    print(f"\n📊 Test Environment Ready")
    print(f"  Room Code: {room_code}")
    print(f"  Quiz ID: {quiz_id}")
    
    # Run tests
    results = {
        "Test 1: Host can start": test_start_as_host(admin_token, room_code),
        "Test 2: Non-host denied": test_start_as_non_host(room_code, user2_token),
        "Test 3: Cannot start twice": test_cannot_start_twice(admin_token, room_code),
        "Test 4: Room not found": test_room_not_found(),
        "Test 5: Redis cache": check_redis_cache(quiz_id),
    }
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print("\n" + "=" * 60)
    print(f"Total: {passed}/{total} tests passed")
    print("=" * 60)
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
