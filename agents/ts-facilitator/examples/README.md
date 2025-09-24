# NANDA x402 Integration Examples

This directory contains comprehensive examples showing different patterns for integrating x402 payments using the NANDA ecosystem. Each example demonstrates a specific use case and integration pattern.

## Overview

The examples showcase how to monetize various types of services using HTTP 402 Payment Required and the NANDA TypeScript Facilitator:

- **Expert Agent** - MCP server monetization (before & after)
- **API Service** - REST API with premium endpoints
- **Content Service** - Paywall for premium content
- **Processing Service** - Usage-based pricing for compute resources

## Examples Directory Structure

```
examples/
├── README.md                    # This overview document
├── expert-agent/               # MCP server monetization
│   ├── before/                 # Original free MCP server
│   ├── after/                  # Monetized with x402
│   └── README.md
├── api-service/                # REST API with premium endpoints
│   ├── src/server.ts          # Hono server with payment middleware
│   ├── package.json
│   └── README.md
├── content-service/            # Content paywall implementation
│   ├── src/server.ts          # Content service with tiered access
│   ├── package.json
│   └── README.md
└── processing-service/         # Compute service with usage pricing
    ├── src/server.ts          # Processing jobs with variable costs
    ├── package.json
    └── README.md
```

## Quick Start

### Prerequisites

1. **NANDA Facilitator Running**:
   ```bash
   # In the facilitator package
   cd packages/facilitator
   npm run dev
   ```

2. **Environment Setup**:
   ```bash
   export FACILITATOR_URL=http://localhost:8080
   ```

### Running Examples

Each example can be run independently:

```bash
# API Service (port 3003)
cd examples/api-service
npm install
npm run dev

# Content Service (port 3004)
cd examples/content-service
npm install
npm run dev

# Processing Service (port 3005)
cd examples/processing-service
npm install
npm run dev

# Expert Agent (ports 3001/3002)
cd examples/expert-agent/after
npm install
npm run dev
```

## Integration Patterns

### 1. Middleware-Based Protection

**Use Case**: Protect specific endpoints or features with payments

```typescript
const requirePayment = (costNP: number, description: string) => {
  return async (c: any, next: any) => {
    const paymentHeader = c.req.header('x-payment');

    if (!paymentHeader) {
      return c.json({ error: 'Payment Required', x402: { cost: costNP } }, 402);
    }

    // Verify payment with facilitator
    const verification = await nandaClient.verifyPayment(paymentData);

    if (!verification.valid) {
      return c.json({ error: 'Invalid Payment' }, 402);
    }

    await next();

    // Settle payment after processing
    await nandaClient.settlePayment({ sessionId: verification.sessionId });
  };
};

// Apply to endpoints
app.post('/premium-endpoint', requirePayment(500, 'Premium API'), handler);
```

### 2. Content Access Control

**Use Case**: Paywall for premium content with free previews

```typescript
const requireContentPayment = (contentId: string) => {
  return async (c: any, next: any) => {
    const content = findContent(contentId);

    if (content.tier === 'free') {
      return next(); // Free access
    }

    // Check payment for premium content
    const paymentResult = await checkPayment(c.req.header('x-payment'));

    if (!paymentResult.valid) {
      return c.json({
        error: 'Payment Required',
        preview: content.preview,
        x402: { cost: content.cost }
      }, 402);
    }

    await next();
  };
};
```

### 3. Usage-Based Pricing

**Use Case**: Variable pricing based on resource consumption

```typescript
const calculateCost = (jobType: string, parameters: any): number => {
  const config = JOB_CONFIGS[jobType];
  let cost = config.baseCost;

  // Add variable costs
  if (parameters.fileSizeMB) {
    cost += parameters.fileSizeMB * config.costPerMB;
  }

  return cost;
};

app.post('/process', async (c) => {
  const { jobType, parameters } = await c.req.json();
  const cost = calculateCost(jobType, parameters);

  // Request payment for calculated cost
  if (!paymentHeader) {
    return c.json({ x402: { cost } }, 402);
  }

  // Process with verified payment
});
```

### 4. Subscription Model

**Use Case**: Time-based unlimited access

```typescript
app.post('/subscription', async (c) => {
  const { duration_hours } = await c.req.json();
  const cost = duration_hours * HOURLY_RATE;

  // Verify subscription payment
  const payment = await verifyPayment(paymentHeader, cost);

  if (!payment.valid) {
    return c.json({ x402: { cost } }, 402);
  }

  // Create subscription token
  const token = createSubscriptionToken(duration_hours);

  return c.json({
    subscriptionToken: token,
    expiresAt: new Date(Date.now() + duration_hours * 3600000)
  });
});
```

## Payment Flow Overview

### Standard x402 Flow

1. **Request without payment** → Service returns HTTP 402 with payment requirements
2. **Client obtains payment authorization** from NANDA wallet/facilitator
3. **Request with payment header** → Service verifies payment with facilitator
4. **Service processes request** → Returns requested content/result
5. **Payment settlement** → Automatic settlement completes transaction

### Payment Header Format

```typescript
// x-payment header content
{
  "paymentPayload": {
    "scheme": "exact",
    "network": "nanda-network",
    "x402Version": 1,
    "payload": {
      "authorization": {
        "from": "sender-wallet-id",
        "to": "receiver-wallet-id",
        "value": "500", // Cost in minor units
        "validAfter": "2024-01-20T10:00:00Z",
        "validBefore": "2024-01-20T15:00:00Z",
        "nonce": "unique-nonce"
      },
      "signature": "cryptographic-signature"
    }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "nanda-network",
    "maxAmountRequired": "500",
    "resource": "/api/endpoint",
    "description": "Service description"
  }
}
```

## Service Comparison

| Service | Pattern | Pricing | Use Case |
|---------|---------|---------|-----------|
| **Expert Agent** | MCP Monetization | Fixed per tool | AI agent services |
| **API Service** | Endpoint Protection | Fixed per endpoint | REST API monetization |
| **Content Service** | Content Paywall | Fixed per article + subscriptions | Publishing, blogs |
| **Processing Service** | Usage-Based | Variable by resource consumption | Compute services |

## Common Features Across Examples

### ✅ Standard HTTP 402 Implementation
- Proper 402 Payment Required responses
- x402 header format compliance
- Payment verification and settlement

### ✅ NANDA SDK Integration
- Type-safe client library usage
- Automatic payment processing
- Error handling and retry logic

### ✅ Development Experience
- TypeScript with full type safety
- Environment-based configuration
- Comprehensive error handling
- Development and production builds

### ✅ Business Logic
- Free tier functionality
- Premium feature protection
- Cost calculation and estimation
- Usage tracking and analytics

## Testing the Examples

### 1. Manual Testing with cURL

```bash
# Test free endpoint
curl http://localhost:3003/info

# Test premium endpoint (should return 402)
curl -X POST http://localhost:3003/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Sample text for analysis"}'

# Test with payment (requires valid payment data)
curl -X POST http://localhost:3003/analyze \
  -H "Content-Type: application/json" \
  -H "x-payment: {...}" \
  -d '{"text": "Sample text for analysis"}'
```

### 2. Integration Testing

Each example includes comprehensive integration patterns that can be extended for automated testing:

- Payment verification testing
- Error condition handling
- Cost calculation validation
- Service functionality testing

## Business Models Demonstrated

### 1. **Freemium** (Expert Agent, Content Service)
- Free basic functionality
- Premium features require payment
- User acquisition through free tier

### 2. **Pay-Per-Use** (API Service, Processing Service)
- Individual payment for each operation
- Cost based on actual usage
- No ongoing commitments

### 3. **Subscription** (Content Service)
- Time-based unlimited access
- Predictable costs for users
- Higher engagement and retention

### 4. **Usage-Based** (Processing Service)
- Variable pricing based on resource consumption
- Fair pricing for actual costs
- Scales with user needs

## Next Steps

After exploring these examples:

1. **Choose the pattern** that best fits your use case
2. **Adapt the code** to your specific service requirements
3. **Configure the NANDA SDK** with your agent credentials
4. **Deploy your service** with the NANDA facilitator
5. **Monitor and optimize** based on usage patterns

## Support and Documentation

- [NANDA SDK Documentation](../packages/sdk/README.md)
- [Facilitator API Reference](../packages/facilitator/README.md)
- [x402 Protocol Specification](https://github.com/x402-protocol/x402-protocol)
- [NANDA Points Economics](../docs/nanda-points.md)

Each example directory contains detailed README files with specific implementation details, deployment instructions, and usage patterns.