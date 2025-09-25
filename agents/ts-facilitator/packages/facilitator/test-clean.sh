#!/bin/bash

# NANDA Simplified System Test Script
# Clean, start, test, evaluate

LOG_FILE="TEST.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to log
log() {
    echo -e "$1"
    echo "$1" | sed 's/\x1b\[[0-9;]*m//g' >> "$LOG_FILE"
}

# Function to wait for port
wait_for_port() {
    local port=$1
    local service=$2
    local max_attempts=10
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
            log "${GREEN}✅ $service listening on port $port${NC}"
            return 0
        fi
        log "⏳ Waiting for $service (attempt $attempt/$max_attempts)..."
        sleep 2
        attempt=$((attempt + 1))
    done

    log "${RED}❌ $service failed to start on port $port${NC}"
    return 1
}

# Initialize log
echo "===================================" > "$LOG_FILE"
echo "NANDA SIMPLIFIED SYSTEM TEST" >> "$LOG_FILE"
echo "===================================" >> "$LOG_FILE"
echo "Date: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# STEP 1: Cleanup
log "${YELLOW}=== STEP 1: CLEANUP ===${NC}"

for port in 3000 3001 3003; do
    pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        kill -9 $pids 2>/dev/null
        log "🔥 Killed processes on port $port"
    fi
done

pkill -f "tsx.*server.ts" 2>/dev/null && log "🔥 Killed tsx processes"
pkill -f "npm.*dev" 2>/dev/null && log "🔥 Killed npm dev processes"
pkill -f "node.*test-expert" 2>/dev/null && log "🔥 Killed test expert processes"

sleep 2

# STEP 2: MongoDB cleanup
log ""
log "${YELLOW}=== STEP 2: MONGODB CLEANUP ===${NC}"

if pgrep -x "mongod" > /dev/null; then
    log "✅ MongoDB running, cleaning database..."
    mongosh --quiet --eval "use nanda_points; db.dropDatabase();" 2>/dev/null
    log "✅ Database cleaned"
else
    log "${RED}❌ MongoDB not running!${NC}"
    exit 1
fi

# STEP 3: Start services
log ""
log "${YELLOW}=== STEP 3: STARTING SERVICES ===${NC}"

# Start Facilitator
log "🚀 Starting Facilitator..."
cd packages/facilitator
npm run dev > facilitator.log 2>&1 &
FACILITATOR_PID=$!
cd ../..

# Start Expert Agent
log "🚀 Starting Expert Agent..."
PORT=3001 node test-expert-agent.cjs > expert.log 2>&1 &
EXPERT_PID=$!

# Wait for services
wait_for_port 3000 "Facilitator"
wait_for_port 3001 "Expert Agent"

# STEP 4: Testing
log ""
log "${CYAN}=== STEP 4: TESTING ===${NC}"

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expect_code=$3

    log ""
    log "🧪 Testing: $name"
    
    response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null)
    status_code=${response: -3}
    body=${response%???}

    if echo "$body" | jq . 2>/dev/null >/dev/null; then
        formatted=$(echo "$body" | jq '.')
        log "$formatted"
    else
        log "Response: $body"
    fi

    if [ "$status_code" = "$expect_code" ]; then
        log "${GREEN}✅ Status: $status_code${NC}"
        return 0
    else
        log "${RED}❌ Status: $status_code (Expected: $expect_code)${NC}"
        return 1
    fi
}

# Run tests
test_endpoint "Facilitator Health" "http://localhost:3000/health" "200"
test_endpoint "Facilitator Stats" "http://localhost:3000/api/v1/stats" "200"
test_endpoint "Expert Agent Health" "http://localhost:3001/health" "200"
test_endpoint "Expert Agent Info" "http://localhost:3001/info" "200"

# Test 402 responses
log ""
log "🧪 Testing: Expert Search (402 expected)"
response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"query":"test"}' http://localhost:3001/search 2>/dev/null)
status_code=${response: -3}
body=${response%???}

if echo "$body" | jq . 2>/dev/null >/dev/null; then
    formatted=$(echo "$body" | jq '.')
    log "$formatted"
fi

if [ "$status_code" = "402" ]; then
    log "${GREEN}✅ Status: 402 (Payment Required)${NC}"
else
    log "${RED}❌ Status: $status_code (Expected: 402)${NC}"
fi

# STEP 5: Results
log ""
log "${CYAN}=== STEP 5: RESULTS ===${NC}"

success_count=$(grep -c "✅ Status:" "$LOG_FILE" 2>/dev/null || echo 0)
failure_count=$(grep -c "❌ Status:" "$LOG_FILE" 2>/dev/null || echo 0)

log ""
log "📊 RESULTS: $success_count passed, $failure_count failed"

if [ $success_count -ge 4 ]; then
    log "${GREEN}🎉 SYSTEM WORKING!${NC}"
else
    log "${RED}💥 ISSUES FOUND${NC}"
fi

log ""
log "Process PIDs: Facilitator=$FACILITATOR_PID, Expert=$EXPERT_PID"
log "To stop: kill $FACILITATOR_PID $EXPERT_PID"

echo ""
echo "✅ Test completed. Check TEST.log for details."
