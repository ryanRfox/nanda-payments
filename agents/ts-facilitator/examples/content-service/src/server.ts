import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { NandaClient } from '@nanda/sdk';
import 'dotenv/config';

/**
 * Example Content Service with x402 Paywall Integration
 *
 * This example demonstrates a content service with tiered access:
 * - Free articles with preview/summary
 * - Premium articles requiring payment for full access
 * - Subscription-like access with time-based sessions
 */

const app = new Hono();

// Initialize NANDA client
const nandaClient = new NandaClient({
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:8080',
  agentName: 'content-service-demo',
});

// Mock content database
const mockArticles = [
  {
    id: 'free-001',
    title: 'Introduction to AI Agents',
    category: 'technology',
    tier: 'free',
    preview: 'AI agents are becoming increasingly important in modern software development...',
    content: `AI agents are becoming increasingly important in modern software development. They represent autonomous systems capable of perceiving their environment, making decisions, and taking actions to achieve specific goals.

In this comprehensive guide, we'll explore the fundamentals of AI agents, their architecture, and practical applications. We'll cover everything from simple reactive agents to complex learning systems that can adapt and improve over time.

Whether you're a developer looking to integrate AI agents into your applications or simply curious about this rapidly evolving field, this article provides the foundation you need to understand and work with AI agents effectively.`,
    wordCount: 850,
    publishedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 'premium-001',
    title: 'Advanced x402 Payment Integration Patterns',
    category: 'development',
    tier: 'premium',
    cost: 250, // 2.50 NP
    preview: 'Deep dive into sophisticated x402 integration patterns for production applications...',
    content: `Deep dive into sophisticated x402 integration patterns for production applications. This comprehensive guide covers advanced techniques for implementing micropayments at scale.

## Advanced Payment Flows

### Multi-step Verification
When dealing with complex workflows, you may need to verify payments across multiple steps. Here's how to implement transaction chains:

\`\`\`typescript
const sessionChain = await nandaClient.createSessionChain({
  steps: [
    { cost: 100, description: 'Data preprocessing' },
    { cost: 200, description: 'Analysis execution' },
    { cost: 150, description: 'Result formatting' }
  ]
});
\`\`\`

### Conditional Pricing
Implement dynamic pricing based on usage patterns, user tiers, or resource consumption:

\`\`\`typescript
const calculateCost = (user, request) => {
  const baseCost = 100;
  const tierMultiplier = user.tier === 'premium' ? 0.8 : 1.0;
  const complexityBonus = request.complexity * 50;
  return Math.round((baseCost + complexityBonus) * tierMultiplier);
};
\`\`\`

### Batch Payment Processing
For high-volume scenarios, batch multiple operations under a single payment:

\`\`\`typescript
const batchSession = await nandaClient.createBatchSession({
  operations: requests.map(req => ({
    id: req.id,
    cost: calculateCost(req),
    description: req.description
  })),
  totalCost: requests.reduce((sum, req) => sum + calculateCost(req), 0)
});
\`\`\`

## Error Recovery Patterns

### Payment Retry Logic
Implement robust retry mechanisms for transient failures:

\`\`\`typescript
const retryPayment = async (paymentData, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await nandaClient.verifyPayment(paymentData);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};
\`\`\`

### Partial Refund Handling
When operations fail partially, implement fair refund logic:

\`\`\`typescript
const handlePartialFailure = async (sessionId, completedSteps, totalSteps) => {
  const refundRatio = (totalSteps - completedSteps) / totalSteps;
  if (refundRatio > 0.1) { // Refund if >10% incomplete
    await nandaClient.requestPartialRefund(sessionId, refundRatio);
  }
};
\`\`\`

## Production Considerations

### Rate Limiting Integration
Combine payment requirements with rate limiting:

\`\`\`typescript
const rateLimitedPayment = async (userId, costNP) => {
  const usage = await getUserUsage(userId);
  if (usage.freeQuotaRemaining > 0) {
    await decrementFreeQuota(userId);
    return { requiresPayment: false };
  }
  return { requiresPayment: true, cost: costNP };
};
\`\`\`

### Monitoring and Analytics
Track payment success rates and user behavior:

\`\`\`typescript
const paymentMetrics = {
  totalAttempts: 0,
  successfulPayments: 0,
  failuresByReason: {},
  revenueByPeriod: {}
};

const trackPaymentEvent = (event, details) => {
  // Log to your analytics system
  analytics.track('payment_event', {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};
\`\`\`

This article continues with detailed examples of production deployment strategies, security considerations, and optimization techniques for high-volume x402 implementations.`,
    wordCount: 2200,
    publishedAt: '2024-01-20T14:00:00Z'
  },
  {
    id: 'premium-002',
    title: 'Building Scalable Payment Microservices',
    category: 'architecture',
    tier: 'premium',
    cost: 400, // 4.00 NP
    preview: 'Learn how to architect payment systems that scale to millions of transactions...',
    content: `Learn how to architect payment systems that scale to millions of transactions per day. This guide covers everything from service design to deployment strategies.

## Microservice Architecture for Payments

### Service Decomposition Strategy
When building payment systems at scale, proper service decomposition is crucial:

1. **Payment Verification Service** - Handles x402 verification logic
2. **Settlement Service** - Manages actual fund transfers
3. **Session Management Service** - Tracks payment sessions and lifecycle
4. **Analytics Service** - Processes payment data for insights
5. **Notification Service** - Handles payment confirmations and alerts

### Inter-Service Communication
Design resilient communication patterns between payment services:

\`\`\`typescript
// Event-driven architecture example
class PaymentEventBus {
  async publishPaymentEvent(event: PaymentEvent) {
    await this.messageQueue.publish('payment.events', event);
  }

  async subscribeToPaymentEvents(handler: PaymentEventHandler) {
    await this.messageQueue.subscribe('payment.events', handler);
  }
}
\`\`\`

### Data Consistency Patterns
Implement eventual consistency with compensation patterns:

\`\`\`typescript
// Saga pattern for distributed transactions
class PaymentSaga {
  async executePayment(paymentRequest: PaymentRequest) {
    const saga = new SagaOrchestrator();

    saga.addStep('verifyPayment', this.verifyPaymentStep);
    saga.addStep('reserveFunds', this.reserveFundsStep);
    saga.addStep('processService', this.processServiceStep);
    saga.addStep('settleFunds', this.settleFundsStep);

    return saga.execute(paymentRequest);
  }
}
\`\`\`

## Scaling Strategies

### Database Optimization
Optimize database performance for high-volume payments:

\`\`\`sql
-- Partitioned payment sessions table
CREATE TABLE payment_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  -- ... other fields
) PARTITION BY RANGE (UNIX_TIMESTAMP(created_at));
\`\`\`

### Caching Strategies
Implement multi-layer caching for payment validation:

\`\`\`typescript
class PaymentCache {
  private redis = new Redis(process.env.REDIS_URL);
  private memoryCache = new LRUCache({ maxSize: 1000 });

  async getPaymentStatus(sessionId: string) {
    // Check memory cache first
    let status = this.memoryCache.get(sessionId);
    if (status) return status;

    // Check Redis cache
    status = await this.redis.get(\`payment:\${sessionId}\`);
    if (status) {
      this.memoryCache.set(sessionId, JSON.parse(status));
      return JSON.parse(status);
    }

    // Fallback to database
    return this.fetchFromDatabase(sessionId);
  }
}
\`\`\`

### Load Balancing and Circuit Breakers
Implement resilience patterns for payment services:

\`\`\`typescript
class ResilientPaymentClient {
  private circuitBreaker = new CircuitBreaker(this.makePaymentRequest);

  async verifyPayment(paymentData: any) {
    try {
      return await this.circuitBreaker.fire(paymentData);
    } catch (error) {
      // Fallback to cached validation or queue for retry
      return this.handlePaymentFailure(paymentData, error);
    }
  }
}
\`\`\`

This comprehensive guide continues with detailed coverage of monitoring, security, compliance, and operational patterns for production payment systems.`,
    wordCount: 3100,
    publishedAt: '2024-01-25T16:30:00Z'
  }
];

// Payment middleware for content access
const requireContentPayment = (articleId: string) => {
  return async (c: any, next: any) => {
    const article = mockArticles.find(a => a.id === articleId);

    if (!article) {
      return c.json({ error: 'Article not found' }, 404);
    }

    if (article.tier === 'free') {
      c.set('article', article);
      return next();
    }

    // Premium article requires payment
    const paymentHeader = c.req.header('x-payment');

    if (!paymentHeader) {
      return c.json({
        error: 'Payment Required',
        article: {
          id: article.id,
          title: article.title,
          category: article.category,
          preview: article.preview,
          wordCount: article.wordCount,
          publishedAt: article.publishedAt
        },
        x402: {
          cost: article.cost,
          description: `Access to full article: "${article.title}"`,
          currency: 'NP',
          facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:8080',
        }
      }, 402);
    }

    try {
      const paymentData = JSON.parse(paymentHeader);
      const verification = await nandaClient.verifyPayment(paymentData);

      if (!verification.valid) {
        return c.json({
          error: 'Invalid Payment',
          reason: verification.reason
        }, 402);
      }

      c.set('article', article);
      c.set('paymentSession', verification.sessionId);

      await next();

      // Settle payment after content delivery
      if (verification.sessionId) {
        await nandaClient.settlePayment({
          sessionId: verification.sessionId,
          paymentPayload: paymentData.paymentPayload
        });
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      return c.json({
        error: 'Payment Processing Failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 402);
    }
  };
};

// Routes
app.get('/', (c) => {
  return c.json({
    service: 'NANDA Content Service Demo',
    version: '1.0.0',
    description: 'Content service with x402 paywall integration',
    features: [
      'Free article access',
      'Premium content with paywall',
      'Preview functionality',
      'Category-based organization'
    ]
  });
});

app.get('/articles', (c) => {
  const articles = mockArticles.map(article => ({
    id: article.id,
    title: article.title,
    category: article.category,
    tier: article.tier,
    cost: article.tier === 'premium' ? article.cost : undefined,
    preview: article.preview,
    wordCount: article.wordCount,
    publishedAt: article.publishedAt
  }));

  return c.json({
    articles,
    summary: {
      total: articles.length,
      free: articles.filter(a => a.tier === 'free').length,
      premium: articles.filter(a => a.tier === 'premium').length
    }
  });
});

app.get('/articles/category/:category', (c) => {
  const category = c.req.param('category');
  const articles = mockArticles
    .filter(article => article.category === category)
    .map(article => ({
      id: article.id,
      title: article.title,
      category: article.category,
      tier: article.tier,
      cost: article.tier === 'premium' ? article.cost : undefined,
      preview: article.preview,
      wordCount: article.wordCount,
      publishedAt: article.publishedAt
    }));

  return c.json({
    category,
    articles,
    count: articles.length
  });
});

app.get('/articles/:id/preview', (c) => {
  const articleId = c.req.param('id');
  const article = mockArticles.find(a => a.id === articleId);

  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }

  return c.json({
    id: article.id,
    title: article.title,
    category: article.category,
    tier: article.tier,
    preview: article.preview,
    wordCount: article.wordCount,
    publishedAt: article.publishedAt,
    paymentRequired: article.tier === 'premium',
    cost: article.tier === 'premium' ? article.cost : undefined
  });
});

app.get('/articles/:id',
  async (c, next) => {
    const articleId = c.req.param('id');
    return requireContentPayment(articleId)(c, next);
  },
  (c) => {
    const article = c.get('article');
    const paymentSession = c.get('paymentSession');

    return c.json({
      id: article.id,
      title: article.title,
      category: article.category,
      tier: article.tier,
      content: article.content,
      wordCount: article.wordCount,
      publishedAt: article.publishedAt,
      accessInfo: {
        accessedAt: new Date().toISOString(),
        paymentSession: paymentSession || null,
        cost: article.tier === 'premium' ? article.cost : 0
      }
    });
  }
);

// Subscription-like access endpoint
const subscriptionSchema = z.object({
  duration_hours: z.number().int().min(1).max(24).default(1)
});

app.post('/subscription/daily',
  zValidator('json', subscriptionSchema),
  async (c) => {
    const { duration_hours } = c.req.valid('json');
    const costPerHour = 50; // 0.50 NP per hour
    const totalCost = duration_hours * costPerHour;

    const paymentHeader = c.req.header('x-payment');

    if (!paymentHeader) {
      return c.json({
        error: 'Payment Required',
        subscription: {
          type: 'daily_access',
          duration_hours,
          cost_per_hour: costPerHour,
          total_cost: totalCost,
          description: `${duration_hours}h unlimited access to all premium content`
        },
        x402: {
          cost: totalCost,
          description: `Daily subscription: ${duration_hours} hours unlimited access`,
          currency: 'NP',
          facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:8080',
        }
      }, 402);
    }

    try {
      const paymentData = JSON.parse(paymentHeader);
      const verification = await nandaClient.verifyPayment(paymentData);

      if (!verification.valid) {
        return c.json({
          error: 'Invalid Payment',
          reason: verification.reason
        }, 402);
      }

      // Settle payment
      if (verification.sessionId) {
        await nandaClient.settlePayment({
          sessionId: verification.sessionId,
          paymentPayload: paymentData.paymentPayload
        });
      }

      // Create subscription token (in production, use JWT or session storage)
      const subscriptionToken = `sub_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const expiresAt = new Date(Date.now() + duration_hours * 60 * 60 * 1000);

      return c.json({
        subscription: {
          token: subscriptionToken,
          type: 'daily_access',
          duration_hours,
          cost: totalCost,
          expires_at: expiresAt.toISOString(),
          coverage: 'All premium articles'
        },
        instructions: 'Use this token in the Authorization header for premium article access'
      });

    } catch (error) {
      console.error('Subscription processing error:', error);
      return c.json({
        error: 'Subscription Processing Failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 402);
    }
  }
);

app.get('/categories', (c) => {
  const categories = [...new Set(mockArticles.map(a => a.category))];
  const categoryStats = categories.map(category => ({
    name: category,
    total_articles: mockArticles.filter(a => a.category === category).length,
    free_articles: mockArticles.filter(a => a.category === category && a.tier === 'free').length,
    premium_articles: mockArticles.filter(a => a.category === category && a.tier === 'premium').length
  }));

  return c.json({
    categories: categoryStats,
    total_categories: categories.length
  });
});

// Error handling
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500);
});

app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
    available_endpoints: [
      'GET /',
      'GET /articles',
      'GET /articles/:id/preview',
      'GET /articles/:id',
      'GET /categories'
    ]
  }, 404);
});

const port = parseInt(process.env.PORT || '3004');

console.log(`📰 Content Service with x402 paywall starting on port ${port}`);
console.log(`🆓 Free content: article previews, categories, free tier articles`);
console.log(`💎 Premium content: full articles require payment`);
console.log(`🔗 Facilitator: ${process.env.FACILITATOR_URL || 'http://localhost:8080'}`);

export default {
  port,
  fetch: app.fetch,
};