import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  clearTestData,
  getTestServices,
  createTestAgents,
  createMockX402Payload,
  createMockX402Requirements,
} from './test-setup.js';
import type { Agent } from '../../src/models/agent.js';

/**
 * Working Payment Integration Tests
 *
 * Focused test suite that validates core functionality without
 * relying on MongoDB transactions that require replica sets.
 */

describe('Working Payment Integration Tests', () => {
  let testAgents: Agent[];

  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await clearTestData();
    testAgents = await createTestAgents();
  });

  describe('Core Payment Verification', () => {
    it('should verify valid payment structure', async () => {
      const { paymentSessionService } = getTestServices();

      const senderWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      expect(senderWallet).toBeTruthy();
      expect(receiverWallet).toBeTruthy();
      expect(senderWallet!.balanceMinor).toBe(100000); // 1000 NP

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '500', // This gets converted to 50000 in our mock (500 NP, not 5.00 NP)
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '500',
        resource: '/api/test-service',
        description: 'Test API service payment',
      });

      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.sessionId).toBeTruthy();
      expect(verifyResult.expiresAt).toBeTruthy();

      // Verify session was created with correct amount conversion
      const session = await paymentSessionService.getSession(verifyResult.sessionId!);
      expect(session).toBeTruthy();
      expect(session!.status).toBe('verified');
      // Amount should be 50000 (500.00 NP) because our mock treats the string as NP amount
      expect(session!.amount).toBe(50000);
      expect(session!.fromAgent).toBe('test-sender');
      expect(session!.toAgent).toBe('test-receiver');
    });

    it('should reject verification with insufficient balance', async () => {
      const { paymentSessionService } = getTestServices();

      const poorWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-poor' });
      const receiverWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      expect(poorWallet!.balanceMinor).toBe(50); // 0.50 NP

      const paymentPayload = createMockX402Payload({
        fromWalletId: poorWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '1', // 1 NP (more than 0.50 NP balance)
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '1',
        resource: '/api/expensive-service',
      });

      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.reason).toContain('Insufficient balance');
      expect(verifyResult.reason).toContain('Available: 0.50 NP');
      expect(verifyResult.reason).toContain('Required: 1.00 NP'); // Our mock treats "1" as 1 NP
    });

    it('should reject verification with nonexistent wallets', async () => {
      const { paymentSessionService } = getTestServices();

      const paymentPayload = createMockX402Payload({
        fromWalletId: 'nonexistent-from-wallet',
        toWalletId: 'nonexistent-to-wallet',
        amount: '100',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '100',
        resource: '/api/service',
      });

      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.reason).toContain('Source or destination wallet not found');
    });

    it('should reject verification with invalid payment scheme', async () => {
      const { paymentSessionService } = getTestServices();

      const senderWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '100',
      });

      const paymentRequirements = {
        scheme: 'invalid-scheme', // Not 'exact'
        amount: '100',
        resource: '/api/test',
      };

      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.reason).toContain('Only "exact" payment scheme is supported');
    });
  });

  describe('Session Management', () => {
    it('should create and retrieve payment sessions', async () => {
      const { paymentSessionService, config } = getTestServices();

      const expiresAt = new Date(Date.now() + config.security.sessionExpirationMinutes * 60 * 1000);

      const session = await paymentSessionService.createSession({
        resourceServer: 'test-server',
        resource: '/api/test',
        amount: 100,
        currency: 'NP',
        fromAgent: 'test-sender',
        toAgent: 'test-receiver',
        status: 'verified',
        paymentRequirements: {},
        paymentPayload: {},
        expiresAt: expiresAt.toISOString(),
      });

      expect(session.sessionId).toBeTruthy();
      expect(session.status).toBe('verified');
      expect(session.amount).toBe(100);

      const retrievedSession = await paymentSessionService.getSession(session.sessionId);
      expect(retrievedSession).toEqual(session);
    });

    it('should update session status', async () => {
      const { paymentSessionService } = getTestServices();

      const session = await paymentSessionService.createSession({
        resourceServer: 'test-server',
        resource: '/api/test',
        amount: 100,
        currency: 'NP',
        fromAgent: 'test-sender',
        toAgent: 'test-receiver',
        status: 'verified',
        paymentRequirements: {},
        paymentPayload: {},
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      const updatedSession = await paymentSessionService.updateSession({
        sessionId: session.sessionId,
        status: 'settled',
        settledAt: new Date().toISOString(),
      });

      expect(updatedSession?.status).toBe('settled');
      expect(updatedSession?.settledAt).toBeTruthy();
    });

    it('should list sessions with filtering', async () => {
      const { paymentSessionService } = getTestServices();

      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        await paymentSessionService.createSession({
          resourceServer: 'test-server',
          resource: `/api/service-${i}`,
          amount: 100 * (i + 1),
          currency: 'NP',
          fromAgent: 'test-sender',
          toAgent: 'test-receiver',
          status: 'verified',
          paymentRequirements: {},
          paymentPayload: {},
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        });
      }

      const allSessions = await paymentSessionService.listSessions({ limit: 10 });
      expect(allSessions.sessions).toHaveLength(3);
      expect(allSessions.total).toBe(3);

      const agentSessions = await paymentSessionService.listSessions({
        fromAgent: 'test-sender',
        limit: 10,
      });
      expect(agentSessions.sessions).toHaveLength(3);
    });

    it('should get session statistics', async () => {
      const { paymentSessionService } = getTestServices();

      // Create sessions with different statuses
      await paymentSessionService.createSession({
        resourceServer: 'test-server',
        resource: '/api/verified',
        amount: 100,
        currency: 'NP',
        fromAgent: 'test-sender',
        toAgent: 'test-receiver',
        status: 'verified',
        paymentRequirements: {},
        paymentPayload: {},
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      await paymentSessionService.createSession({
        resourceServer: 'test-server',
        resource: '/api/settled',
        amount: 200,
        currency: 'NP',
        fromAgent: 'test-sender',
        toAgent: 'test-receiver',
        status: 'settled',
        paymentRequirements: {},
        paymentPayload: {},
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        settledAt: new Date().toISOString(),
      });

      const stats = await paymentSessionService.getSessionStats();
      expect(stats.totalSessions).toBeGreaterThanOrEqual(2);
      expect(stats.activeSessions).toBeGreaterThanOrEqual(1);
      expect(stats.settledSessions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Wallet Operations', () => {
    it('should get wallet balances by agent name', async () => {
      const { walletService } = getTestServices();

      // Get balance by wallet ID first to verify wallet exists
      const senderWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-sender' });
      expect(senderWallet).toBeTruthy();

      const balance = await walletService.getBalance(senderWallet!.walletId);
      expect(balance).toMatchObject({
        balanceMinor: 100000,
        balanceNP: 1000,
        formatted: '1000.00 NP',
      });
    });

    it('should validate NANDA Points utilities', async () => {
      const { NandaPoints } = await import('../../src/models/wallet.js');

      // Test conversions
      expect(NandaPoints.toMinor(10.50)).toBe(1050);
      expect(NandaPoints.fromMinor(1050)).toBe(10.50);
      expect(NandaPoints.format(1050)).toBe('10.50 NP');

      // Test edge cases
      expect(NandaPoints.toMinor(0.01)).toBe(1);
      expect(NandaPoints.toMinor(0.005)).toBe(1); // Rounds up
      expect(NandaPoints.format(1)).toBe('0.01 NP');
      expect(NandaPoints.format(0)).toBe('0.00 NP');
    });
  });

  describe('Database Operations', () => {
    it('should enforce unique constraints', async () => {
      const { db } = getTestServices();

      const duplicateAgent = {
        id: 'test-duplicate-id',
        agent_name: 'test-sender', // Duplicate name should fail
        label: 'Duplicate Agent',
        email: 'different@test.com', // Different email
        description: 'Should fail due to unique agent_name',
        serviceCharge: 100,
        walletId: 'different-wallet-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await expect(db.collections.agents.insertOne(duplicateAgent)).rejects.toThrow();
    });

    it('should handle database indexes', async () => {
      const { db } = getTestServices();

      // Test that we can query using indexed fields efficiently
      const agentByName = await db.collections.agents.findOne({ agent_name: 'test-sender' });
      expect(agentByName).toBeTruthy();

      const walletByAgentName = await db.collections.wallets.findOne({ agent_name: 'test-sender' });
      expect(walletByAgentName).toBeTruthy();

      const walletById = await db.collections.wallets.findOne({ walletId: walletByAgentName!.walletId });
      expect(walletById).toEqual(walletByAgentName);
    });

    it('should validate data persistence', async () => {
      const { paymentSessionService } = getTestServices();

      // Create session
      const session = await paymentSessionService.createSession({
        resourceServer: 'persistence-test',
        resource: '/api/persist',
        amount: 150,
        currency: 'NP',
        fromAgent: 'test-sender',
        toAgent: 'test-receiver',
        status: 'verified',
        paymentRequirements: { test: 'data' },
        paymentPayload: { test: 'payload' },
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      // Verify persistence by reading directly from database
      const dbSession = await getTestServices().db.collections.paymentSessions.findOne({
        sessionId: session.sessionId,
      });

      expect(dbSession).toBeTruthy();
      expect(dbSession!.sessionId).toBe(session.sessionId);
      expect(dbSession!.amount).toBe(150);
      expect(dbSession!.status).toBe('verified');
      expect(dbSession!.paymentRequirements).toEqual({ test: 'data' });
      expect(dbSession!.paymentPayload).toEqual({ test: 'payload' });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed payment data', async () => {
      const { paymentSessionService } = getTestServices();

      const result = await paymentSessionService.verifyPayment({
        paymentPayload: null as any,
        paymentRequirements: null as any,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing payment payload or requirements');
    });

    it('should handle missing session retrieval', async () => {
      const { paymentSessionService } = getTestServices();

      const session = await paymentSessionService.getSession('nonexistent-session-id');
      expect(session).toBeNull();
    });

    it('should handle settlement of nonexistent session', async () => {
      const { paymentSessionService } = getTestServices();

      const result = await paymentSessionService.settlePayment({
        sessionId: 'nonexistent-session-id',
        paymentPayload: {},
      });

      expect(result.settled).toBe(false);
      expect(result.reason).toBe('Payment session not found');
    });

    it('should handle empty payment data gracefully', async () => {
      const { paymentSessionService } = getTestServices();

      const result = await paymentSessionService.verifyPayment({
        paymentPayload: {},
        paymentRequirements: {},
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBeTruthy();
    });
  });
});