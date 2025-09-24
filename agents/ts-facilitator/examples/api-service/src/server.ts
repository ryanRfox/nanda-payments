import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { NandaClient } from '@nanda/sdk';
import 'dotenv/config';

/**
 * Example REST API Service with x402 Payment Protection
 *
 * This example shows how to integrate x402 payments into a standard REST API.
 * Premium endpoints require NANDA Points, while basic endpoints remain free.
 */

const app = new Hono();

// Initialize NANDA client
const nandaClient = new NandaClient({
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:8080',
  agentName: 'api-service-demo',
});

// Middleware to check x402 payments
const requirePayment = (costNP: number, description: string) => {
  return async (c: any, next: any) => {
    const paymentHeader = c.req.header('x-payment');

    if (!paymentHeader) {
      return c.json({
        error: 'Payment Required',
        x402: {
          cost: costNP,
          description,
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

      // Store session for settlement after processing
      c.set('paymentSession', verification.sessionId);

      await next();

      // Settle payment after successful processing
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

// Free endpoints
app.get('/', (c) => {
  return c.json({
    service: 'NANDA API Service Demo',
    version: '1.0.0',
    endpoints: {
      free: [
        'GET /health - Health check',
        'GET /info - Service information'
      ],
      premium: [
        'POST /analyze - Text analysis (5.00 NP)',
        'POST /translate - Language translation (3.00 NP)',
        'POST /summarize - Text summarization (2.00 NP)',
        'GET /data/premium - Premium dataset access (10.00 NP)'
      ]
    }
  });
});

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/info', (c) => {
  return c.json({
    service: 'API Service with x402 Integration',
    features: [
      'Free basic endpoints',
      'Premium endpoints with NP payments',
      'Automatic payment verification',
      'Real-time settlement'
    ],
    paymentInfo: {
      currency: 'NANDA Points (NP)',
      facilitator: process.env.FACILITATOR_URL || 'http://localhost:8080',
      agent: 'api-service-demo'
    }
  });
});

// Premium endpoints with payment protection
const analyzeSchema = z.object({
  text: z.string().min(1).max(5000),
  analysis_type: z.enum(['sentiment', 'keywords', 'entities', 'summary']).optional().default('sentiment')
});

app.post('/analyze',
  requirePayment(500, 'Advanced text analysis'), // 5.00 NP
  zValidator('json', analyzeSchema),
  async (c) => {
    const { text, analysis_type } = c.req.valid('json');

    // Simulate analysis processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockResults = {
      sentiment: {
        score: Math.random() * 2 - 1,
        magnitude: Math.random(),
        label: Math.random() > 0.5 ? 'positive' : 'negative'
      },
      keywords: {
        keywords: ['example', 'analysis', 'text', 'processing'],
        confidence: Math.random()
      },
      entities: {
        entities: [
          { text: 'example entity', type: 'PERSON', confidence: 0.95 }
        ]
      },
      summary: {
        summary: text.substring(0, Math.min(100, text.length)) + '...',
        confidence: 0.85
      }
    };

    return c.json({
      text: text.substring(0, 50) + '...',
      analysis_type,
      result: mockResults[analysis_type],
      processed_at: new Date().toISOString(),
      cost: '5.00 NP'
    });
  }
);

const translateSchema = z.object({
  text: z.string().min(1).max(2000),
  target_language: z.string().length(2),
  source_language: z.string().length(2).optional()
});

app.post('/translate',
  requirePayment(300, 'Language translation service'), // 3.00 NP
  zValidator('json', translateSchema),
  async (c) => {
    const { text, target_language, source_language } = c.req.valid('json');

    // Simulate translation processing
    await new Promise(resolve => setTimeout(resolve, 800));

    return c.json({
      original_text: text,
      translated_text: `[Translated to ${target_language}]: ${text}`,
      source_language: source_language || 'auto-detected',
      target_language,
      confidence: 0.92,
      processed_at: new Date().toISOString(),
      cost: '3.00 NP'
    });
  }
);

const summarizeSchema = z.object({
  text: z.string().min(100).max(10000),
  max_sentences: z.number().int().min(1).max(10).optional().default(3)
});

app.post('/summarize',
  requirePayment(200, 'Text summarization service'), // 2.00 NP
  zValidator('json', summarizeSchema),
  async (c) => {
    const { text, max_sentences } = c.req.valid('json');

    // Simulate summarization processing
    await new Promise(resolve => setTimeout(resolve, 600));

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const summaryCount = Math.min(max_sentences, sentences.length);
    const summary = sentences.slice(0, summaryCount).join('. ') + '.';

    return c.json({
      original_length: text.length,
      summary,
      summary_length: summary.length,
      compression_ratio: (summary.length / text.length).toFixed(2),
      sentences_used: summaryCount,
      processed_at: new Date().toISOString(),
      cost: '2.00 NP'
    });
  }
);

app.get('/data/premium',
  requirePayment(1000, 'Premium dataset access'), // 10.00 NP
  async (c) => {
    // Simulate data retrieval
    await new Promise(resolve => setTimeout(resolve, 1200));

    return c.json({
      dataset: 'Premium Market Data',
      records: [
        { symbol: 'AAPL', price: 150.25, volume: 1000000, timestamp: '2024-01-01T12:00:00Z' },
        { symbol: 'GOOGL', price: 2800.50, volume: 750000, timestamp: '2024-01-01T12:00:00Z' },
        { symbol: 'MSFT', price: 420.75, volume: 900000, timestamp: '2024-01-01T12:00:00Z' }
      ],
      metadata: {
        source: 'Premium Market Feed',
        updated: new Date().toISOString(),
        access_level: 'premium'
      },
      cost: '10.00 NP'
    });
  }
);

// Error handling
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    available_endpoints: '/'
  }, 404);
});

const port = parseInt(process.env.PORT || '3003');

console.log(`🚀 API Service with x402 payments starting on port ${port}`);
console.log(`💰 Free endpoints: /, /health, /info`);
console.log(`💎 Premium endpoints: /analyze, /translate, /summarize, /data/premium`);
console.log(`🔗 Facilitator: ${process.env.FACILITATOR_URL || 'http://localhost:8080'}`);

export default {
  port,
  fetch: app.fetch,
};