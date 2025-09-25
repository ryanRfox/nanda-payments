/**
 * API Service Integration Tests
 *
 * Tests the complete x402 payment integration for the API service example.
 * This test suite validates both free and paid endpoints with mock payment data.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { NandaClient } from '../../shared/nanda-client.js';

// Mock the NandaClient to avoid requiring actual facilitator
vi.mock('../../shared/nanda-client.js', () => ({
  NandaClient: vi.fn().mockImplementation(() => ({
    verifyPayment: vi.fn(),
    settlePayment: vi.fn(),
  })),
}));

// Import the server after mocking dependencies
let app: Hono;
let mockNandaClient: any;

describe('API Service with x402 Integration', () => {
  beforeAll(async () => {
    // Dynamically import the server to ensure mocks are applied
    const serverModule = await import('../src/server.js');
    app = new Hono();

    // Get the default export which contains the fetch function
    const server = serverModule.default;
    if (server && typeof server.fetch === 'function') {
      // Use the server's fetch function
      app.fetch = server.fetch;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock NandaClient methods
    const { NandaClient } = require('../../shared/nanda-client.js');
    mockNandaClient = new NandaClient({
      facilitatorUrl: 'http://localhost:8080',
      agentName: 'test-agent',
    });
  });

  describe('Free Endpoints', () => {
    it('should return service information at root endpoint', async () => {
      const response = await app.request('/', { method: 'GET' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('NANDA API Service Demo');
      expect(data.version).toBe('1.0.0');
      expect(data.endpoints.free).toContain('GET /health - Health check');
      expect(data.endpoints.premium).toContain('POST /analyze - Text analysis (5.00 NP)');
    });

    it('should return health status', async () => {
      const response = await app.request('/health', { method: 'GET' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
    });

    it('should return service info', async () => {
      const response = await app.request('/info', { method: 'GET' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('API Service with x402 Integration');
      expect(data.features).toContain('Free basic endpoints');
      expect(data.paymentInfo.currency).toBe('NANDA Points (NP)');
    });
  });

  describe('Premium Endpoints - No Payment', () => {
    it('should return 402 for /analyze without payment header', async () => {
      const response = await app.request('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test text' })
      });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment Required');
      expect(data.x402.cost).toBe(500); // 5.00 NP in minor units
      expect(data.x402.description).toBe('Advanced text analysis');
      expect(data.x402.currency).toBe('NP');
    });

    it('should return 402 for /translate without payment header', async () => {
      const response = await app.request('/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello world', target_language: 'es' })
      });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment Required');
      expect(data.x402.cost).toBe(300); // 3.00 NP in minor units
      expect(data.x402.description).toBe('Language translation service');
    });

    it('should return 402 for /summarize without payment header', async () => {
      const response = await app.request('/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'This is a long text that needs to be summarized. It contains multiple sentences with various information. The text is long enough to meet minimum requirements for summarization.'
        })
      });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment Required');
      expect(data.x402.cost).toBe(200); // 2.00 NP in minor units
      expect(data.x402.description).toBe('Text summarization service');
    });

    it('should return 402 for /data/premium without payment header', async () => {
      const response = await app.request('/data/premium', { method: 'GET' });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment Required');
      expect(data.x402.cost).toBe(1000); // 10.00 NP in minor units
      expect(data.x402.description).toBe('Premium dataset access');
    });
  });

  describe('Premium Endpoints - With Valid Payment', () => {
    const mockPaymentHeader = JSON.stringify({
      paymentPayload: {
        scheme: 'exact',
        network: 'nanda-network',
        x402Version: 1,
        payload: {
          authorization: {
            from: 'test-user-wallet',
            to: 'api-service-wallet',
            value: '500',
            validAfter: '1000',
            validBefore: '2000',
            nonce: '123'
          },
          signature: 'mock-signature'
        }
      },
      paymentRequirements: {
        scheme: 'exact',
        network: 'nanda-network',
        maxAmountRequired: '500',
        resource: '/analyze',
        description: 'Advanced text analysis'
      }
    });

    beforeEach(() => {
      // Mock successful payment verification
      mockNandaClient.verifyPayment.mockResolvedValue({
        valid: true,
        sessionId: 'test-session-123',
        expiresAt: new Date(Date.now() + 300000).toISOString()
      });

      // Mock successful payment settlement
      mockNandaClient.settlePayment.mockResolvedValue({
        settled: true,
        transactionId: 'tx-123',
        balance: { from: 400, to: 1100 }
      });
    });

    it('should process /analyze with valid payment', async () => {
      const response = await app.request('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': mockPaymentHeader
        },
        body: JSON.stringify({
          text: 'This is test text for analysis',
          analysis_type: 'sentiment'
        })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analysis_type).toBe('sentiment');
      expect(data.result.score).toBeDefined();
      expect(data.result.label).toBeDefined();
      expect(data.cost).toBe('5.00 NP');
      expect(mockNandaClient.verifyPayment).toHaveBeenCalledOnce();
      expect(mockNandaClient.settlePayment).toHaveBeenCalledOnce();
    });

    it('should process /translate with valid payment', async () => {
      const response = await app.request('/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': mockPaymentHeader
        },
        body: JSON.stringify({
          text: 'Hello world',
          target_language: 'es'
        })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.original_text).toBe('Hello world');
      expect(data.target_language).toBe('es');
      expect(data.translated_text).toContain('[Translated to es]');
      expect(data.cost).toBe('3.00 NP');
    });

    it('should process /summarize with valid payment', async () => {
      const longText = 'This is a long text that needs to be summarized. It contains multiple sentences with various information. The text is long enough to meet minimum requirements for summarization. This adds more content to test the summarization feature properly.';

      const response = await app.request('/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': mockPaymentHeader
        },
        body: JSON.stringify({
          text: longText,
          max_sentences: 2
        })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.original_length).toBe(longText.length);
      expect(data.summary).toBeDefined();
      expect(data.compression_ratio).toBeDefined();
      expect(data.cost).toBe('2.00 NP');
    });

    it('should serve /data/premium with valid payment', async () => {
      const response = await app.request('/data/premium', {
        method: 'GET',
        headers: {
          'x-payment': mockPaymentHeader
        }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dataset).toBe('Premium Market Data');
      expect(data.records).toHaveLength(3);
      expect(data.records[0]).toHaveProperty('symbol');
      expect(data.records[0]).toHaveProperty('price');
      expect(data.cost).toBe('10.00 NP');
    });
  });

  describe('Premium Endpoints - Invalid Payment', () => {
    beforeEach(() => {
      // Mock invalid payment verification
      mockNandaClient.verifyPayment.mockResolvedValue({
        valid: false,
        reason: 'Insufficient balance'
      });
    });

    it('should return 402 for invalid payment', async () => {
      const invalidPaymentHeader = JSON.stringify({
        paymentPayload: { invalid: 'data' },
        paymentRequirements: { invalid: 'requirements' }
      });

      const response = await app.request('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': invalidPaymentHeader
        },
        body: JSON.stringify({ text: 'test text' })
      });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Invalid Payment');
      expect(data.reason).toBe('Insufficient balance');
    });
  });

  describe('Input Validation', () => {
    const mockPaymentHeader = JSON.stringify({
      paymentPayload: { mock: 'data' },
      paymentRequirements: { mock: 'requirements' }
    });

    beforeEach(() => {
      mockNandaClient.verifyPayment.mockResolvedValue({
        valid: true,
        sessionId: 'test-session',
        expiresAt: new Date(Date.now() + 300000).toISOString()
      });
      mockNandaClient.settlePayment.mockResolvedValue({
        settled: true,
        transactionId: 'tx-123'
      });
    });

    it('should validate analyze request schema', async () => {
      const response = await app.request('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': mockPaymentHeader
        },
        body: JSON.stringify({ text: '' }) // Empty text should fail validation
      });

      expect(response.status).toBe(400);
    });

    it('should validate translate request schema', async () => {
      const response = await app.request('/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': mockPaymentHeader
        },
        body: JSON.stringify({
          text: 'hello',
          target_language: 'invalid-lang' // Should be 2 characters
        })
      });

      expect(response.status).toBe(400);
    });

    it('should validate summarize request schema', async () => {
      const response = await app.request('/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': mockPaymentHeader
        },
        body: JSON.stringify({
          text: 'short' // Text too short for summarization (min 100 chars)
        })
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed payment JSON', async () => {
      const response = await app.request('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': 'invalid-json'
        },
        body: JSON.stringify({ text: 'test text' })
      });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment Processing Failed');
    });

    it('should handle payment verification errors', async () => {
      mockNandaClient.verifyPayment.mockRejectedValue(new Error('Network error'));

      const response = await app.request('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment': JSON.stringify({ mock: 'payment' })
        },
        body: JSON.stringify({ text: 'test text' })
      });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment Processing Failed');
      expect(data.message).toBe('Network error');
    });

    it('should handle 404 for unknown endpoints', async () => {
      const response = await app.request('/unknown', { method: 'GET' });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not Found');
      expect(data.message).toBe('The requested endpoint does not exist');
    });
  });
});