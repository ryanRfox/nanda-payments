#!/bin/bash

# Test Weather Agent - Free and Paid Endpoints
set -e

WEATHER_AGENT="http://localhost:3001"
FACILITATOR="http://localhost:3000"

# Wallet IDs from MongoDB
FROM_WALLET="efea794f-bf21-46c5-847f-7340c38e3eba"  # search-agent
TO_WALLET="70faae34-dddf-4429-9913-0245cb849a09"    # weather-agent

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
