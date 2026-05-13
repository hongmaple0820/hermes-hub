#!/bin/bash
# Robust startup script for Hermes Hub
# Handles OOM issues by using production build

cd /home/z/my-project

# Kill existing processes
pkill -f "next" 2>/dev/null
pkill -f "bun --hot" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
sleep 3

# Build production version if not built
if [ ! -f .next/BUILD_ID ] || [ ! -f .next/standalone/server.js ]; then
  echo "Building production version..."
  NODE_OPTIONS="--max-old-space-size=3072" bun run build
fi

# Start mini-services
echo "Starting mini-services..."
cd /home/z/my-project/mini-services/chat-service && nohup bun --hot index.ts > /dev/null 2>&1 &
cd /home/z/my-project/mini-services/skill-ws && nohup bun --hot index.ts > /dev/null 2>&1 &
cd /home/z/my-project/mini-services/terminal-service && nohup bun --hot index.ts > /dev/null 2>&1 &
sleep 3

# Start production server (uses ~130MB vs dev server ~5GB)
echo "Starting production server..."
cd /home/z/my-project && PORT=3000 NODE_OPTIONS="--max-old-space-size=1024" nohup node .next/standalone/server.js >> /home/z/my-project/dev.log 2>&1 &
disown

sleep 10

# Verify
if ss -tlnp | rg -q ":3000 "; then
  echo "✅ Server started successfully on port 3000"
  echo "   Production mode - ~130MB memory usage"
else
  echo "❌ Server failed to start, falling back to dev mode..."
  NODE_OPTIONS="--max-old-space-size=2048" nohup bun run dev >> /home/z/my-project/dev.log 2>&1 &
  disown
  sleep 15
fi

# Show status
echo ""
echo "Service Status:"
for port in 3000 3003 3004 3005; do
  if ss -tlnp | rg -q ":$port "; then
    echo "  Port $port: UP"
  else
    echo "  Port $port: DOWN"
  fi
done
