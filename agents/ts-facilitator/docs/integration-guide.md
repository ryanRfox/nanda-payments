# NANDA x402 Integration Guide

Comprehensive guide for integrating x402 payments into your applications using the NANDA TypeScript Facilitator.

## Overview

The NANDA ecosystem enables micropayments using the HTTP 402 Payment Required standard. This guide covers:

- x402 protocol implementation
- Payment flow patterns
- SDK integration
- Production deployment
- Troubleshooting

## Quick Start

### 1. Install Dependencies

```bash
npm install @nanda/sdk
# or
yarn add @nanda/sdk
```

### 2. Basic Integration

```typescript
import { NandaClient } from '@nanda/sdk';
import { Hono } from 'hono';

const app = new Hono();
const nanda = new NandaClient({
  facilitatorUrl: process.env.FACILITATOR_URL
});

// Premium endpoint requiring payment
app.post('/api/premium', async (c) => {
  const paymentHeader = c.req.header('x-payment');

  if (!paymentHeader) {
    return c.json({
      error: 'Payment Required',
      x402: {
        cost: 500, // 5.00 NP
        description: 'Premium API access',
        currency: 'NP'
      }
    }, 402);
  }

  // Verify and settle payment
  const payment = JSON.parse(paymentHeader);
  const verification = await nanda.verifyPayment(payment);

  if (!verification.valid) {
    return c.json({ error: 'Invalid Payment' }, 402);
  }

  // Process request
  const result = await processRequest(c.req);

  // Settle payment
  await nanda.settlePayment({
    sessionId: verification.sessionId,
    paymentPayload: payment.paymentPayload
  });

  return c.json(result);
});
```

## Payment Flow Patterns

### 1. Simple Endpoint Protection

Protect individual API endpoints with fixed pricing.

```typescript
const requirePayment = (costNP: number, description: string) => {
  return async (c: any, next: any) => {
    const paymentHeader = c.req.header('x-payment');

    if (!paymentHeader) {
      return c.json({
        error: 'Payment Required',
        x402: {
          cost: costNP * 100, // Convert to minor units
          description,
          currency: 'NP',
          facilitatorUrl: process.env.FACILITATOR_URL
        }
      }, 402);
    }

    try {
      const paymentData = JSON.parse(paymentHeader);
      const verification = await nanda.verifyPayment(paymentData);

      if (!verification.valid) {
        return c.json({
          error: 'Invalid Payment',
          reason: verification.reason
        }, 402);
      }

      c.set('paymentSession', verification.sessionId);
      await next();

      // Auto-settle after successful processing
      if (verification.sessionId) {
        await nanda.settlePayment({
          sessionId: verification.sessionId,
          paymentPayload: paymentData.paymentPayload
        });
      }
    } catch (error) {
      return c.json({
        error: 'Payment Processing Failed',
        message: error.message
      }, 500);
    }
  };
};

// Usage
app.post('/api/analyze', requirePayment(5, 'Text analysis'), handler);
```

### 2. Usage-Based Pricing

Calculate costs based on resource consumption.

```typescript
const calculateCost = (jobType: string, params: any): number => {
  const baseCosts = {
    'image-resize': 10,
    'data-analysis': 100,
    'ml-inference': 200
  };

  let cost = baseCosts[jobType] || 50;

  // Add variable costs
  if (params.fileSizeMB) {
    cost += params.fileSizeMB * 5; // 0.05 NP per MB
  }

  if (params.complexityLevel) {
    cost *= params.complexityLevel;
  }

  return cost;
};

app.post('/api/process', async (c) => {
  const { jobType, parameters } = await c.req.json();
  const cost = calculateCost(jobType, parameters);

  const paymentHeader = c.req.header('x-payment');

  if (!paymentHeader) {
    return c.json({
      error: 'Payment Required',
      job: { type: jobType, estimatedCost: cost },
      x402: {
        cost,
        description: `Processing: ${jobType}`,
        currency: 'NP'
      }
    }, 402);
  }

  // Verify payment matches calculated cost
  const payment = JSON.parse(paymentHeader);
  const verification = await nanda.verifyPayment(payment);

  if (!verification.valid) {
    return c.json({ error: 'Invalid Payment' }, 402);
  }

  // Process job
  const result = await processJob(jobType, parameters);

  // Settle payment
  await nanda.settlePayment({
    sessionId: verification.sessionId,
    paymentPayload: payment.paymentPayload
  });

  return c.json({ result, cost });
});
```

### 3. Content Paywall

Implement paywalls for premium content.

```typescript
const requireContentPayment = (contentId: string) => {
  return async (c: any, next: any) => {
    const content = await getContent(contentId);

    if (!content) {
      return c.json({ error: 'Content not found' }, 404);
    }

    if (content.tier === 'free') {
      c.set('content', content);
      return next();
    }

    // Premium content requires payment
    const paymentHeader = c.req.header('x-payment');
    const subscription = c.req.header('authorization'); // Subscription token

    if (!paymentHeader && !subscription) {
      return c.json({
        error: 'Payment Required',
        content: {
          id: content.id,
          title: content.title,
          preview: content.preview,
          tier: content.tier
        },
        x402: {
          cost: content.cost,
          description: `Premium content: ${content.title}`,
          currency: 'NP'
        }
      }, 402);
    }

    // Check subscription first
    if (subscription && await validateSubscription(subscription)) {
      c.set('content', content);
      return next();
    }

    // Verify individual payment
    if (paymentHeader) {
      const payment = JSON.parse(paymentHeader);
      const verification = await nanda.verifyPayment(payment);

      if (verification.valid) {
        c.set('content', content);
        c.set('paymentSession', verification.sessionId);
        return next();
      }
    }

    return c.json({ error: 'Access Denied' }, 402);
  };
};

app.get('/articles/:id', requireContentPayment(':id'), (c) => {
  const content = c.get('content');
  return c.json(content);
});
```

### 4. Subscription Model

Implement time-based subscriptions.

```typescript
app.post('/subscription', async (c) => {
  const { duration_hours } = await c.req.json();
  const cost = duration_hours * 50; // 0.50 NP per hour

  const paymentHeader = c.req.header('x-payment');

  if (!paymentHeader) {
    return c.json({
      error: 'Payment Required',
      subscription: {
        duration_hours,
        cost,
        description: `${duration_hours}h unlimited access`
      },
      x402: {
        cost,
        description: `Subscription: ${duration_hours} hours`,
        currency: 'NP'
      }
    }, 402);
  }

  const payment = JSON.parse(paymentHeader);
  const verification = await nanda.verifyPayment(payment);

  if (!verification.valid) {
    return c.json({ error: 'Invalid Payment' }, 402);
  }

  // Create subscription
  const subscription = await createSubscription({
    duration_hours,
    cost,
    userId: getUserId(c)
  });

  // Settle payment
  await nanda.settlePayment({
    sessionId: verification.sessionId,
    paymentPayload: payment.paymentPayload
  });

  return c.json({
    subscriptionId: subscription.id,
    token: subscription.token,
    expiresAt: subscription.expiresAt
  });
});
```

## x402 Protocol Details

### Payment Payload Structure

```typescript
interface X402PaymentPayload {
  scheme: 'exact';
  network: 'nanda-network';
  x402Version: 1;
  payload: {
    authorization: {
      from: string;        // Sender wallet ID
      to: string;          // Receiver wallet ID
      value: string;       // Amount in minor units
      validAfter: string;  // ISO 8601 timestamp
      validBefore: string; // ISO 8601 timestamp
      nonce: string;       // Unique nonce
    };
    signature: string;     // Cryptographic signature
  };
}
```

### Payment Requirements Structure

```typescript
interface X402PaymentRequirements {
  scheme: 'exact';
  network: 'nanda-network';
  maxAmountRequired: string; // Max amount in minor units
  resource: string;          // Resource identifier
  description?: string;      // Human-readable description
  extra?: Record<string, any>; // Additional metadata
}
```

### Response Headers

Services should include payment information in HTTP responses:

```typescript
// 402 Payment Required response
return c.json({
  error: 'Payment Required',
  x402: {
    cost: 500,                    // Cost in minor units
    description: 'Service description',
    currency: 'NP',
    facilitatorUrl: 'http://localhost:8080',
    scheme: 'exact',
    network: 'nanda-network'
  }
}, 402);
```

## Error Handling

### Payment Verification Errors

```typescript
try {
  const verification = await nanda.verifyPayment(payment);

  if (!verification.valid) {
    switch (verification.reason) {
      case 'Insufficient balance':
        return c.json({
          error: 'Insufficient Balance',
          message: verification.reason,
          suggestedAction: 'Add funds to your wallet'
        }, 402);

      case 'Payment expired':
        return c.json({
          error: 'Payment Expired',
          message: 'Payment authorization has expired',
          suggestedAction: 'Create a new payment authorization'
        }, 402);

      case 'Invalid signature':
        return c.json({
          error: 'Invalid Payment',
          message: 'Payment signature verification failed',
          suggestedAction: 'Check wallet configuration'
        }, 402);

      default:
        return c.json({
          error: 'Payment Verification Failed',
          message: verification.reason
        }, 402);
    }
  }
} catch (error) {
  console.error('Payment verification error:', error);

  return c.json({
    error: 'Payment Service Unavailable',
    message: 'Unable to verify payment at this time',
    suggestedAction: 'Try again later'
  }, 503);
}
```

### Settlement Errors

```typescript
try {
  const settlement = await nanda.settlePayment({
    sessionId: verification.sessionId,
    paymentPayload: payment.paymentPayload
  });

  if (!settlement.settled) {
    // Handle settlement failure
    console.error('Settlement failed:', settlement.reason);

    // Still return successful service response if work was completed
    return c.json({
      result: serviceResult,
      warning: 'Payment settlement delayed',
      message: 'Service completed but payment processing delayed'
    });
  }
} catch (error) {
  console.error('Settlement error:', error);

  // Log for manual reconciliation
  await logPendingSettlement({
    sessionId: verification.sessionId,
    paymentPayload: payment.paymentPayload,
    serviceResult,
    error: error.message
  });

  return c.json({
    result: serviceResult,
    warning: 'Payment settlement pending',
    message: 'Service completed, payment will be processed'
  });
}
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { NandaClient } from '@nanda/sdk';

describe('Payment Integration', () => {
  const mockClient = {
    verifyPayment: vi.fn(),
    settlePayment: vi.fn()
  };

  it('should verify valid payment', async () => {
    mockClient.verifyPayment.mockResolvedValue({
      valid: true,
      sessionId: 'test-session'
    });

    const result = await mockClient.verifyPayment({
      paymentPayload: mockPayload,
      paymentRequirements: mockRequirements
    });

    expect(result.valid).toBe(true);
    expect(result.sessionId).toBe('test-session');
  });

  it('should handle insufficient balance', async () => {
    mockClient.verifyPayment.mockResolvedValue({
      valid: false,
      reason: 'Insufficient balance. Available: 5.00 NP, Required: 10.00 NP'
    });

    const result = await mockClient.verifyPayment({
      paymentPayload: mockPayload,
      paymentRequirements: mockRequirements
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Insufficient balance');
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testClient } from 'hono/testing';
import app from '../src/app';

describe('API Integration', () => {
  it('should return 402 for premium endpoint without payment', async () => {
    const res = await testClient(app).post('/api/premium', {
      json: { data: 'test' }
    });

    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toBe('Payment Required');
    expect(data.x402).toBeDefined();
    expect(data.x402.cost).toBeGreaterThan(0);
  });

  it('should process request with valid payment', async () => {
    const res = await testClient(app).post('/api/premium', {
      json: { data: 'test' },
      headers: {
        'x-payment': JSON.stringify(validPaymentData)
      }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBeDefined();
  });
});
```

## Production Considerations

### Security

```typescript
// Validate payment amounts
const validatePaymentAmount = (payment: any, expectedCost: number) => {
  const paidAmount = parseInt(payment.paymentPayload.payload.authorization.value);

  if (paidAmount < expectedCost) {
    throw new Error(`Insufficient payment: ${paidAmount} < ${expectedCost}`);
  }

  // Allow small overpayment (within 5%)
  if (paidAmount > expectedCost * 1.05) {
    throw new Error(`Overpayment detected: ${paidAmount} > ${expectedCost * 1.05}`);
  }
};

// Rate limiting
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'minute'
});

const rateLimitMiddleware = async (c: any, next: any) => {
  const remaining = await limiter.removeTokens(1);

  if (remaining < 0) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  await next();
};
```

### Monitoring

```typescript
// Payment metrics
class PaymentMetrics {
  private metrics = {
    totalPayments: 0,
    successfulPayments: 0,
    failedPayments: 0,
    totalRevenue: 0
  };

  recordPayment(amount: number, success: boolean) {
    this.metrics.totalPayments++;

    if (success) {
      this.metrics.successfulPayments++;
      this.metrics.totalRevenue += amount;
    } else {
      this.metrics.failedPayments++;
    }
  }

  getStats() {
    return {
      ...this.metrics,
      successRate: this.metrics.successfulPayments / this.metrics.totalPayments
    };
  }
}

const metrics = new PaymentMetrics();

// Log payment events
const logPaymentEvent = (event: string, details: any) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    details
  }));
};
```

### Error Recovery

```typescript
// Retry failed settlements
class SettlementRetryQueue {
  private queue: Array<{
    sessionId: string;
    paymentPayload: any;
    retries: number;
  }> = [];

  async addFailedSettlement(sessionId: string, paymentPayload: any) {
    this.queue.push({
      sessionId,
      paymentPayload,
      retries: 0
    });
  }

  async processRetries() {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];

      if (item.retries >= 3) {
        // Move to manual review
        await logManualReview(item);
        this.queue.splice(i, 1);
        continue;
      }

      try {
        const result = await nanda.settlePayment({
          sessionId: item.sessionId,
          paymentPayload: item.paymentPayload
        });

        if (result.settled) {
          this.queue.splice(i, 1);
        } else {
          item.retries++;
        }
      } catch (error) {
        item.retries++;
      }
    }
  }
}
```

## Environment Configuration

```bash
# .env file
FACILITATOR_URL=http://localhost:8080
AGENT_NAME=my-service
LOG_LEVEL=info
PAYMENT_TIMEOUT=30000
RETRY_ATTEMPTS=3
METRICS_ENABLED=true
```

```typescript
// config.ts
export const config = {
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:8080',
  agentName: process.env.AGENT_NAME || 'default-agent',
  paymentTimeout: parseInt(process.env.PAYMENT_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
  metricsEnabled: process.env.METRICS_ENABLED === 'true'
};
```

## Troubleshooting

### Common Issues

1. **Payment verification fails**
   - Check facilitator URL connectivity
   - Verify payment payload format
   - Ensure wallet has sufficient balance

2. **Settlement timeouts**
   - Implement retry logic
   - Check network connectivity
   - Monitor facilitator health

3. **Invalid signatures**
   - Verify wallet configuration
   - Check payment payload integrity
   - Ensure correct network identifier

4. **Session expiration**
   - Implement session refresh logic
   - Check system clock synchronization
   - Monitor session duration settings

### Debugging

Enable debug logging:

```typescript
import debug from 'debug';

const log = debug('nanda:payments');

log('Payment verification started', { sessionId });
log('Payment verified successfully', { sessionId, amount });
log('Settlement completed', { transactionId });
```

Check facilitator health:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/metrics
```

This integration guide provides comprehensive coverage of x402 payment integration patterns using the NANDA ecosystem. Refer to the [API Reference](./api-reference.md) for detailed endpoint documentation.