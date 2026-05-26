#!/bin/bash
cd /home/z/my-project

# Start Next.js
bun run dev &
NEXT_PID=$!

# Start chat-service
cd /home/z/my-project/mini-services/chat-service
bun index.ts &
CHAT_PID=$!

# Start skill-ws
cd /home/z/my-project/mini-services/skill-ws
bun index.ts &
WS_PID=$!

echo "Next.js PID: $NEXT_PID"
echo "Chat Service PID: $CHAT_PID"
echo "Skill WS PID: $WS_PID"

# Wait for all processes
wait
