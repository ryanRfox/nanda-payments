import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  clearTestData,
  getTestServices,
  createTestAgents,
  createMockX402Payload,
  createMockX402Requirements,
} from './test-setup.js';
import { createFacilitatorRoutes } from '../../src/routes/facilitator.js';
import { createExplorerRoutes } from '../../src/routes/explorer.js';
import { createHealthRoutes } from '../../src/routes/health.js';
import type { Agent } from '../../src/models/agent.js';

/**
 * API Endpoint Integration Tests
 *
 * Tests the HTTP API endpoints by making actual requests to the Hono application.
 * Validates request/response handling, error cases, and data persistence.
 */

describe('API Endpoint Integration Tests', () => {
  let app: Hono;
  let testAgents: Agent[];

  beforeAll(async () => {
    await setupTestEnvironment();
    const services = getTestServices();

    // Create Hono app with all routes
    app = new Hono();
    app.route('/', createHealthRoutes(services.db, services.paymentSessionService));
    app.route('/', createFacilitatorRoutes(services.paymentSessionService));
    app.route('/', createExplorerRoutes(
      services.transactionService,
      services.walletService,
      services.agentService
    ));
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await clearTestData();
    testAgents = await createTestAgents();
  });

  describe('Health Endpoints', () => {
    it('should return health status', async () => {
      const response = await app.request('/health');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
      });
    });

    it('should return readiness status', async () => {
      const response = await app.request('/ready');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        ready: true,
        services: expect.objectContaining({
          database: 'healthy',
        }),
      });
    });

    it('should return metrics', async () => {
      const response = await app.request('/metrics');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        uptime: expect.any(Number),
        sessions: expect.objectContaining({
          totalSessions: expect.any(Number),
          activeSessions: expect.any(Number),
        }),
      });
    });
  });

  describe('Facilitator Endpoints', () => {
    it('should verify valid payment', async () => {
      const { walletService } = getTestServices();

      const senderWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '500',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '500',
        resource: '/api/test',
      });

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPayload,
          paymentRequirements,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        valid: true,
        sessionId: expect.any(String),
        expiresAt: expect.any(String),
      });
    });

    it('should reject invalid payment verification', async () => {
      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPayload: {},
          paymentRequirements: { scheme: 'invalid' },
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        valid: false,
        reason: expect.any(String),
      });
    });

    it('should settle valid payment session', async () => {
      const { paymentSessionService, walletService } = getTestServices();

      // First create a valid session
      const senderWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '300',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '300',
        resource: '/api/test',
      });

      // Verify first
      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      // Then settle via API
      const response = await app.request('/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: verifyResult.sessionId,
          paymentPayload,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        settled: true,
        transactionId: expect.any(String),
        balance: {
          from: 99700, // 997.00 NP
          to: 100300,  // 1003.00 NP
        },
      });
    });

    it('should reject settlement for nonexistent session', async () => {
      const response = await app.request('/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'nonexistent-session',
          paymentPayload: {},
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        settled: false,
        reason: 'Payment session not found',
      });
    });
  });

  describe('Explorer Endpoints', () => {
    it('should get agent balance', async () => {
      const response = await app.request('/api/v1/agents/test-sender/balance');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        agent_name: 'test-sender',
        walletId: expect.any(String),
        balance: {
          balanceMinor: 100000,
          balanceNP: 1000,
          formatted: '1000.00 NP',
        },
      });
    });

    it('should return 404 for nonexistent agent', async () => {
      const response = await app.request('/api/v1/agents/nonexistent/balance');

      expect(response.status).toBe(404);
    });

    it('should list transactions', async () => {
      // First create a transaction
      const { paymentSessionService, walletService } = getTestServices();

      const senderWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '250',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '250',
        resource: '/api/test',
      });

      // Create transaction
      const verifyResult = await paymentSessionService.verifyPayment({ paymentPayload, paymentRequirements });
      await paymentSessionService.settlePayment({
        sessionId: verifyResult.sessionId!,
        paymentPayload,
      });

      // List transactions
      const response = await app.request('/api/v1/transactions');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        transactions: expect.arrayContaining([
          expect.objectContaining({
            amount: 250,
            currency: 'NP',
            type: 'payment',
            status: 'completed',
            metadata: expect.objectContaining({
              agent_from: 'test-sender',
              agent_to: 'test-receiver',
            }),
          }),
        ]),
        total: 1,
        summary: expect.objectContaining({
          totalAmount: 250,
          averageAmount: 250,
          statusCounts: { completed: 1 },
        }),
      });
    });

    it('should get network statistics', async () => {
      const response = await app.request('/api/v1/stats');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        totalAgents: 3,
        totalTransactions: expect.any(Number),
        totalVolume: expect.any(Number),
        averageTransactionAmount: expect.any(Number),
        topAgentsByVolume: expect.any(Array),
        recentActivity: expect.any(Array),
      });
    });

    it('should filter transactions by agent', async () => {
      // Create a transaction first
      const { paymentSessionService, walletService } = getTestServices();

      const senderWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '100',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '100',
        resource: '/api/test',
      });

      const verifyResult = await paymentSessionService.verifyPayment({ paymentPayload, paymentRequirements });
      await paymentSessionService.settlePayment({
        sessionId: verifyResult.sessionId!,
        paymentPayload,
      });

      // Filter by sender agent
      const response = await app.request('/api/v1/transactions?agent_name=test-sender&limit=10');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.transactions).toHaveLength(1);
      expect(data.transactions[0]).toMatchObject({
        metadata: expect.objectContaining({
          agent_from: 'test-sender',
        }),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
    });

    it('should handle missing required fields', async () => {
      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await app.request('/unknown-endpoint');

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toMatchObject({
        error: 'Not Found',
      });
    });
  });

  describe('Data Persistence', () => {
    it('should persist payment sessions across API calls', async () => {
      const { walletService } = getTestServices();

      const senderWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '200',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '200',
        resource: '/api/persistence-test',
      });

      // Verify payment
      const verifyResponse = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentPayload, paymentRequirements }),
      });

      const verifyData = await verifyResponse.json();
      expect(verifyData.valid).toBe(true);

      // Settle payment in separate request
      const settleResponse = await app.request('/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: verifyData.sessionId,
          paymentPayload,
        }),
      });

      const settleData = await settleResponse.json();
      expect(settleData.settled).toBe(true);

      // Verify transaction persisted
      const transactionsResponse = await app.request('/api/v1/transactions');
      const transactionsData = await transactionsResponse.json();

      expect(transactionsData.transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: settleData.transactionId,
            amount: 200,
            status: 'completed',
          }),
        ])
      );
    });
  });
});