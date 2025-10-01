#!/bin/bash

# Test script for uInt minor units payment system
# Tests the NANDA Facilitator with integer amounts in minor units

set -e

FACILITATOR="http://localhost:3000"
LOG_FILE="TEST.log"

# Wallet IDs from MongoDB
FROM_WALLET="8672e85c-3dba-4d84-8821-19c0ab229308"  # test-agent
TO_WALLET="ac29a924-b17c-44b7-b94f-9d14db21e1b1"    # weather-agent

echo "🧪 Testing NANDA Facilitator - uInt Minor Units Payment System" | tee "$LOG_FILE"
echo "================================================================" | tee -a "$LOG_FILE"
echo "Test Date: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "📋 Configuration:" | tee -a "$LOG_FILE"
echo "  Facilitator: $FACILITATOR" | tee -a "$LOG_FILE"
echo "  From Wallet: $FROM_WALLET (test-agent)" | tee -a "$LOG_FILE"
echo "  To Wallet: $TO_WALLET (weather-agent)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 1: Health Check
echo "1️⃣ Health Check" | tee -a "$LOG_FILE"
echo "  GET $FACILITATOR/health" | tee -a "$LOG_FILE"
HEALTH=$(curl -s "$FACILITATOR/health")
echo "$HEALTH" | jq '.' | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 2: Network Statistics
echo "2️⃣ Network Statistics" | tee -a "$LOG_FILE"
echo "  GET $FACILITATOR/api/v1/stats" | tee -a "$LOG_FILE"
STATS=$(curl -s "$FACILITATOR/api/v1/stats")
echo "$STATS" | jq '.' | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 3: Check Initial Balances
echo "3️⃣ Initial Balances" | tee -a "$LOG_FILE"
echo "  From (test-agent):" | tee -a "$LOG_FILE"
FROM_BALANCE_BEFORE=$(curl -s "$FACILITATOR/api/v1/agents/test-agent/balance")
echo "$FROM_BALANCE_BEFORE" | jq '.' | tee -a "$LOG_FILE"

echo "  To (weather-agent):" | tee -a "$LOG_FILE"
TO_BALANCE_BEFORE=$(curl -s "$FACILITATOR/api/v1/agents/weather-agent/balance")
echo "$TO_BALANCE_BEFORE" | jq '.' | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 4: Verify Payment - Testing uInt amount (500 = 5.00 NP)
echo "4️⃣ Verify Payment (uInt: 500 minor units = 5.00 NP)" | tee -a "$LOG_FILE"
echo "  POST $FACILITATOR/verify" | tee -a "$LOG_FILE"

VERIFY_REQUEST='{
  "paymentPayload": {
    "x402Version": 1,
    "scheme": "exact",
    "network": "nanda-points",
    "payload": {
      "from": "'$FROM_WALLET'",
      "to": "'$TO_WALLET'",
      "amount": 500
    }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "nanda-points",
    "payTo": "'$TO_WALLET'",
    "maxAmountRequired": 500,
    "resource": "http://localhost:3000/test/uint-payment",
    "description": "Test uInt payment verification",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 300,
    "asset": "NP"
  }
}'

echo "Request payload:" | tee -a "$LOG_FILE"
echo "$VERIFY_REQUEST" | jq '.' | tee -a "$LOG_FILE"

VERIFY_RESPONSE=$(curl -s -X POST "$FACILITATOR/verify" \
  -H "Content-Type: application/json" \
  -d "$VERIFY_REQUEST")

echo "Response:" | tee -a "$LOG_FILE"
echo "$VERIFY_RESPONSE" | jq '.' | tee -a "$LOG_FILE"

# Extract session ID
SESSION_ID=$(echo "$VERIFY_RESPONSE" | jq -r '.sessionId // empty')

if [ -z "$SESSION_ID" ]; then
  echo "❌ FAILED: No session ID returned" | tee -a "$LOG_FILE"
  echo "This indicates payment verification failed" | tee -a "$LOG_FILE"
  exit 1
fi

echo "✅ Session ID: $SESSION_ID" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 5: Settle Payment
echo "5️⃣ Settle Payment" | tee -a "$LOG_FILE"
echo "  POST $FACILITATOR/settle" | tee -a "$LOG_FILE"

SETTLE_REQUEST='{
  "sessionId": "'$SESSION_ID'",
  "paymentPayload": {
    "x402Version": 1,
    "scheme": "exact",
    "network": "nanda-points",
    "payload": {
      "from": "'$FROM_WALLET'",
      "to": "'$TO_WALLET'",
      "amount": 500
    }
  }
}'

echo "Request payload:" | tee -a "$LOG_FILE"
echo "$SETTLE_REQUEST" | jq '.' | tee -a "$LOG_FILE"

SETTLE_RESPONSE=$(curl -s -X POST "$FACILITATOR/settle" \
  -H "Content-Type: application/json" \
  -d "$SETTLE_REQUEST")

echo "Response:" | tee -a "$LOG_FILE"
echo "$SETTLE_RESPONSE" | jq '.' | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 6: Check Final Balances
echo "6️⃣ Final Balances (After Payment)" | tee -a "$LOG_FILE"
echo "  From (test-agent):" | tee -a "$LOG_FILE"
FROM_BALANCE_AFTER=$(curl -s "$FACILITATOR/api/v1/agents/test-agent/balance")
echo "$FROM_BALANCE_AFTER" | jq '.' | tee -a "$LOG_FILE"

echo "  To (weather-agent):" | tee -a "$LOG_FILE"
TO_BALANCE_AFTER=$(curl -s "$FACILITATOR/api/v1/agents/weather-agent/balance")
echo "$TO_BALANCE_AFTER" | jq '.' | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 7: Verify Balance Changes
echo "7️⃣ Balance Verification" | tee -a "$LOG_FILE"
FROM_BEFORE=$(echo "$FROM_BALANCE_BEFORE" | jq -r '.balanceMinor')
FROM_AFTER=$(echo "$FROM_BALANCE_AFTER" | jq -r '.balanceMinor')
TO_BEFORE=$(echo "$TO_BALANCE_BEFORE" | jq -r '.balanceMinor')
TO_AFTER=$(echo "$TO_BALANCE_AFTER" | jq -r '.balanceMinor')

FROM_CHANGE=$((FROM_AFTER - FROM_BEFORE))
TO_CHANGE=$((TO_AFTER - TO_BEFORE))

echo "  test-agent: $FROM_BEFORE → $FROM_AFTER (change: $FROM_CHANGE)" | tee -a "$LOG_FILE"
echo "  weather-agent: $TO_BEFORE → $TO_AFTER (change: $TO_CHANGE)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test 8: Edge Cases - Different uInt amounts
echo "8️⃣ Testing Additional uInt Amounts" | tee -a "$LOG_FILE"

test_amounts=(1 10 100 1000 12345)

for amount in "${test_amounts[@]}"; do
  major=$(echo "scale=2; $amount / 100" | bc)
  echo "  Testing amount: $amount minor units ($major NP)" | tee -a "$LOG_FILE"

  VERIFY_REQ='{
    "paymentPayload": {
      "x402Version": 1,
      "scheme": "exact",
      "network": "nanda-points",
      "payload": {"from": "'$FROM_WALLET'", "to": "'$TO_WALLET'", "amount": '$amount'}
    },
    "paymentRequirements": {
      "scheme": "exact",
      "network": "nanda-points",
      "payTo": "'$TO_WALLET'",
      "maxAmountRequired": '$amount',
      "resource": "http://localhost:3000/test/uint-'$amount'",
      "description": "Test amount '$amount' minor units",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 300,
      "asset": "NP"
    }
  }'

  VERIFY_RESP=$(curl -s -X POST "$FACILITATOR/verify" \
    -H "Content-Type: application/json" \
    -d "$VERIFY_REQ")

  VALID=$(echo "$VERIFY_RESP" | jq -r '.valid')
  if [ "$VALID" = "true" ]; then
    echo "    ✅ Verification passed for $amount minor units" | tee -a "$LOG_FILE"
  else
    REASON=$(echo "$VERIFY_RESP" | jq -r '.reason')
    echo "    ❌ Verification failed: $REASON" | tee -a "$LOG_FILE"
  fi
done
echo "" | tee -a "$LOG_FILE"

# Summary
echo "════════════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "✅ TEST SUMMARY" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"

if [ "$FROM_CHANGE" = "-500" ] && [ "$TO_CHANGE" = "500" ]; then
  echo "✅ Payment flow SUCCESSFUL" | tee -a "$LOG_FILE"
  echo "   • Correct amount transferred: 500 minor units (5.00 NP)" | tee -a "$LOG_FILE"
  echo "   • uInt validation working correctly" | tee -a "$LOG_FILE"
  echo "   • Balance changes accurate" | tee -a "$LOG_FILE"
else
  echo "⚠️  Unexpected balance changes" | tee -a "$LOG_FILE"
  echo "   • Expected: -500 from sender, +500 to receiver" | tee -a "$LOG_FILE"
  echo "   • Actual: $FROM_CHANGE from sender, $TO_CHANGE to receiver" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo "Test completed: $(date)" | tee -a "$LOG_FILE"
echo "Full results saved to: $LOG_FILE" | tee -a "$LOG_FILE"
