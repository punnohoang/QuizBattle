#!/bin/bash

# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

echo "✅ Logged in"

# Get quiz
QUIZ_ID=$(curl -s -X GET "http://localhost:8000/api/v1/quizzes?limit=1" \
  -H "Authorization: Bearer $TOKEN" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

echo "✅ Quiz ID: $QUIZ_ID"

# Create room
ROOM=$(curl -s -X POST http://localhost:8000/api/v1/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"quiz_id\":$QUIZ_ID}")

ROOM_CODE=$(echo "$ROOM" | grep -o '"room_code":"[^"]*' | cut -d'"' -f4)
ROOM_ID=$(echo "$ROOM" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

echo "✅ Room created: $ROOM_CODE (ID: $ROOM_ID)"

# Start room
START=$(curl -s -X POST "http://localhost:8000/api/v1/rooms/$ROOM_CODE/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "✅ Start response:"
echo "$START"

