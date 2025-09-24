# API Service Example with x402 Integration

This example demonstrates how to add x402 payment protection to a standard REST API service using the NANDA SDK.

## Overview

A typical REST API that offers both free and premium endpoints:
- **Free endpoints**: Basic functionality accessible without payment
- **Premium endpoints**: Advanced features requiring NANDA Points payment

## Key Features

- **HTTP 402 Payment Required**: Standard implementation of x402 protocol
- **Automatic Payment Verification**: Real-time validation of payment headers
- **Instant Settlement**: Automatic payment settlement after successful processing
- **Flexible Pricing**: Different costs for different service tiers
- **Error Handling**: Comprehensive error responses with payment requirements

## Endpoints

### Free Endpoints
- `GET /` - Service overview and endpoint listing
- `GET /health` - Health check endpoint
- `GET /info` - Service information and payment details

### Premium Endpoints (Require Payment)
- `POST /analyze` - Text analysis (5.00 NP)
- `POST /translate` - Language translation (3.00 NP)
- `POST /summarize` - Text summarization (2.00 NP)
- `GET /data/premium` - Premium dataset access (10.00 NP)

## Setup

```bash
# Install dependencies
npm install

# Set environment variables
export FACILITATOR_URL=http://localhost:8080
export PORT=3003

# Run development server
npm run dev

# Or build and run production
npm run build
npm start
```

## Usage

### Free Endpoint
```bash
curl http://localhost:3003/info
```

### Premium Endpoint (without payment - returns 402)
```bash
curl -X POST http://localhost:3003/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a sample text for analysis"}'
```

### Premium Endpoint (with payment)
```bash
curl -X POST http://localhost:3003/analyze \
  -H "Content-Type: application/json" \
  -H "x-payment: {\"paymentPayload\": {...}, \"paymentRequirements\": {...}}" \
  -d '{"text": "This is a sample text for analysis"}'
```

## x402 Payment Flow

1. **Request without payment** → Returns HTTP 402 with payment requirements
2. **Client obtains payment authorization** using NANDA wallet
3. **Request with payment header** → Service verifies payment
4. **Service processes request** → Returns result
5. **Payment settlement** → Automatic settlement with facilitator

## Integration Pattern

The key integration points are:

### 1. Payment Middleware
```typescript
const requirePayment = (costNP: number, description: string) => {
  return async (c: any, next: any) => {
    // Check for payment header
    // Verify payment with facilitator
    // Process request
    // Settle payment
  };
};
```

### 2. Protected Endpoints
```typescript
app.post('/premium-endpoint',
  requirePayment(500, 'Premium service'), // 5.00 NP
  async (c) => {
    // Your existing endpoint logic
  }
);
```

### 3. Error Responses
```typescript
return c.json({
  error: 'Payment Required',
  x402: {
    cost: costNP,
    description,
    currency: 'NP',
    facilitatorUrl: process.env.FACILITATOR_URL
  }
}, 402);
```

## Environment Variables

- `FACILITATOR_URL` - URL of the NANDA facilitator service
- `PORT` - Port to run the service on (default: 3003)

## Developer Benefits

- **Monetize existing APIs** with minimal code changes
- **Flexible pricing** per endpoint or feature
- **Standard HTTP 402** protocol compliance
- **Real-time payments** without complex billing systems
- **Easy integration** with existing Node.js/TypeScript projects

This example shows how any REST API can quickly integrate x402 payments using the NANDA ecosystem.