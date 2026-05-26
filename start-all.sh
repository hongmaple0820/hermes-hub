#!/bin/bash
# Start all Hermes Hub services
cd /home/z/my-project

# Kill any existing processes
pkill -f "next dev" 2>/dev/null
pkill -f "chat-service/index" 2>/dev/null
pkill -f "skill-ws/index" 2>/dev/null
pkill -f "terminal-service/index" 2>/dev/null
sleep 1

# Start Next.js main app
./node_modules/.bin/next dev -p 3000 &
sleep 3

# Start chat service
cd /home/z/my-project/mini-services/chat-service
/usr/local/bin/bun --hot index.ts &
sleep 1

# Start skill-ws service
cd /home/z/my-project/mini-services/skill-ws
/usr/local/bin/bun --hot index.ts &
sleep 1

# Start terminal service
cd /home/z/my-project/mini-services/terminal-service
/usr/local/bin/bun --hot index.ts &
sleep 1

echo "All services started"
wait
