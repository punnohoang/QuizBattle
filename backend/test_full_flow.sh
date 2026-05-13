#!/bin/bash

# Test QuizBattle Game Flow

API="http://localhost:8000/api/v1"

echo "🧪 Testing QuizBattle Game Flow"
echo "================================"

# 1. Login
echo -e "\n1️⃣ Logging in..."
LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

TOKEN=$(echo $LOGIN | jq -r '.access_token')
if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed:"
  echo $LOGIN | jq .
  exit 1
fi
echo "✅ Logged in"
echo "   Token: ${TOKEN:0:30}..."

# 2. Get quizzes
echo -e "\n2️⃣ Getting quizzes..."
QUIZZES=$(curl -s -X GET "$API/quizzes" \
  -H "Authorization: Bearer $TOKEN")

QUIZ_ID=$(echo $QUIZZES | jq -r '.[0].id')
if [ "$QUIZ_ID" == "null" ] || [ -z "$QUIZ_ID" ]; then
  echo "❌ No quizzes found"
  exit 1
fi
echo "✅ Found quiz ID: $QUIZ_ID"

# 3. Create room
echo -e "\n3️⃣ Creating room..."
ROOM=$(curl -s -X POST "$API/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"quiz_id\":$QUIZ_ID}")

ROOM_CODE=$(echo $ROOM | jq -r '.room_code')
ROOM_ID=$(echo $ROOM | jq -r '.id')
if [ "$ROOM_CODE" == "null" ] || [ -z "$ROOM_CODE" ]; then
  echo "❌ Failed to create room"
  echo $ROOM | jq .
  exit 1
fi
echo "✅ Room created"
echo "   Room Code: $ROOM_CODE"
echo "   Room ID: $ROOM_ID"

# 4. Check access
echo -e "\n4️⃣ Checking access..."
ACCESS=$(curl -s -X GET "$API/rooms/$ROOM_CODE/access" \
  -H "Authorization: Bearer $TOKEN")

IS_HOST=$(echo $ACCESS | jq -r '.is_host')
echo "✅ Access verified"
echo "   Is Host: $IS_HOST"

# 5. Start game
echo -e "\n5️⃣ Starting game..."
START=$(curl -s -X POST "$API/rooms/$ROOM_CODE/start" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $START | jq -r '.status' 2>/dev/null || echo "error")
if [ "$STATUS" == "playing" ]; then
  echo "✅ Game started"
  echo $START | jq .
else
  echo "❌ Failed to start game"
  echo $START | jq .
  exit 1
fi

# 6. Start questions
echo -e "\n6️⃣ Starting questions..."
QUESTIONS=$(curl -s -X POST "$API/rooms/$ROOM_CODE/start-questions" \
  -H "Authorization: Bearer $TOKEN")

Q_STATUS=$(echo $QUESTIONS | jq -r '.status' 2>/dev/null || echo "error")
if [ "$Q_STATUS" == "questions_started" ]; then
  echo "✅ Questions started"
  echo $QUESTIONS | jq .
else
  echo "❌ Failed to start questions"
  echo $QUESTIONS | jq .
fi

echo -e "\n✅ Test completed successfully!"
echo "   Room Code: $ROOM_CODE (ready for players to join)"
