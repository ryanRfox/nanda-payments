#!/bin/bash

# Test Weather Agent - Free and Paid Endpoints
set -e

WEATHER_AGENT="http://localhost:3001"
FACILITATOR="http://localhost:3000"

# Wallet IDs from MongoDB
FROM_WALLET="75ddc385-e780-481f-9aae-8d986f9ca67b"  # summary-agent (has 100 NP)
TO_WALLET="ac29a924-b17c-44b7-b94f-9d14db21e1b1"    # weather-agent

echo "🌤️  Testing Weather Agent"
echo "======================="
echo ""

# Test 1: Health Check
echo "1️⃣ Health Check"
curl -s "$WEATHER_AGENT/health" | jq '.'
echo ""

# Test 2: Free Endpoint - Forecast
echo "2️⃣ Free Endpoint: /forecast"
curl -s "$WEATHER_AGENT/forecast?location=Boston" | jq '.'
echo ""

# Test 3: Paid Endpoint Without Payment (expect 402)
echo "3️⃣ Paid Endpoint Without Payment: /alerts (expect 402)"
curl -s "$WEATHER_AGENT/alerts?location=Miami" | jq '.'
echo ""

# Test 4: Paid Endpoint With Payment
echo "4️⃣ Paid Endpoint With Payment: /alerts (100 NP)"
echo "  Creating payment payload..."

# Create x402-compliant payment payload
PAYMENT_PAYLOAD='{
  "x402Version": 1,
  "scheme": "exact",
  "network": "nanda-points",
  "payload": {
    "from": "'$FROM_WALLET'",
    "to": "'$TO_WALLET'",
    "amount": 10000
  }
}'

# Wrap payment for x-payment header
X_PAYMENT='{
  "paymentPayload": '$PAYMENT_PAYLOAD'
}'

echo "  Making paid request..."
curl -s "$WEATHER_AGENT/alerts?location=Miami" \
  -H "x-payment: $(echo $X_PAYMENT | jq -c '.')" | jq '.'

echo ""
echo "✅ Weather Agent tests complete!"
