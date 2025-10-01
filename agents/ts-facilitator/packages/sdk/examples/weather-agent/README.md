# Weather Agent Example

A demonstration of using the NANDA SDK to create an expert agent with both free and paid endpoints.

## Overview

This weather agent showcases x402 payment integration using the `@nanda/sdk` client library:

- **Free Endpoint**: `/forecast` - Basic weather forecast data
- **Paid Endpoint**: `/alerts` - Severe weather alerts (100 NP)

## Features

- **NANDA SDK Integration**: Uses `@nanda/sdk` for payment verification and settlement
- **x402 Protocol**: Proper HTTP 402 Payment Required responses
- **uInt Minor Units**: All amounts in minor units (10000 = 100.00 NP)
- **Error Handling**: Comprehensive error handling for payment failures

## Installation

```bash
npm install
```

## Configuration

Environment variables (optional):

```bash
PORT=3001                                    # Server port
FACILITATOR_URL=http://localhost:3000        # NANDA Facilitator URL
```

The agent wallet ID is configured in the code: `ac29a924-b17c-44b7-b94f-9d14db21e1b1`

## Usage

### Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

### Test Free Endpoint

```bash
curl "http://localhost:3001/forecast?location=Boston"
```

Response:
```json
{
  "location": "Boston",
  "forecast": {
    "today": { "temperature": 72, "conditions": "Partly Cloudy" },
    "tomorrow": { "temperature": 68, "conditions": "Sunny" },
    "threeDay": { "temperature": 70, "conditions": "Clear" }
  },
  "timestamp": "2025-10-01T19:30:00.000Z"
}
```

### Test Paid Endpoint (No Payment)

```bash
curl "http://localhost:3001/alerts?location=Miami"
```

Returns HTTP 402 with payment requirements:
```json
{
  "error": "Payment Required",
  "x402": {
    "facilitatorUrl": "http://localhost:3000",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "nanda-points",
      "payTo": "ac29a924-b17c-44b7-b94f-9d14db21e1b1",
      "maxAmountRequired": 10000,
      "resource": "http://localhost:3001/alerts?location=Miami",
      "asset": "NP"
    }
  }
}
```

### Test Paid Endpoint (With Payment)

See the test script in the root: `../../test-weather-agent.sh`

## SDK Usage Pattern

```typescript
import { NandaClient } from '@nanda/sdk';

// Initialize SDK client
const nanda = new NandaClient({
  facilitatorUrl: 'http://localhost:3000'
});

// Verify payment
const verification = await nanda.verifyPayment({
  paymentPayload: payment.paymentPayload,
  paymentRequirements: {
    scheme: 'exact',
    network: 'nanda-points',
    payTo: AGENT_WALLET_ID,
    maxAmountRequired: ALERT_COST,
    resource: `http://localhost:3001/alerts`,
    description: 'Severe weather alerts',
    mimeType: 'application/json',
    maxTimeoutSeconds: 300,
    asset: 'NP',
  },
});

// Settle payment
if (verification.valid) {
  const settlement = await nanda.settlePayment({
    sessionId: verification.sessionId,
    paymentPayload: payment.paymentPayload,
  });
}
```

## Architecture

```
Client Request
     ↓
Weather Agent (this server)
     ↓
NANDA SDK (@nanda/sdk)
     ↓
NANDA Facilitator (port 3000)
     ↓
MongoDB (payment ledger)
```

## Key Concepts

### Minor Units (uInt)
- All amounts are unsigned integers in minor units
- 1 minor unit = 0.01 NP
- 100 minor units = 1.00 NP
- 10000 minor units = 100.00 NP

### x402 Flow
1. Client requests paid endpoint without payment → 402 response
2. Client creates payment payload with required amount
3. Weather agent verifies payment via SDK
4. Weather agent settles payment via SDK
5. Weather agent returns requested data

## Development

Build TypeScript:
```bash
npm run build
```

Start in production:
```bash
npm start
```

## License

MIT
