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
 * Simplified Payment Flow Integration Tests
 *
 * Tests payment flows without relying on MongoDB transactions.
 * Focuses on core logic validation and data persistence.
 */

describe('Simplified Payment Flow Integration Tests', () => {
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

  describe('Payment Verification', () => {
    it('should verify valid payment with sufficient balance', async () => {
      const { paymentSessionService } = getTestServices();

      // Get sender and receiver wallets
      const senderWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      expect(senderWallet).toBeTruthy();
      expect(receiverWallet).toBeTruthy();
      expect(senderWallet!.balanceMinor).toBe(100000); // 1000 NP

      const amount = '500'; // 5.00 NP in minor units
      const resource = '/api/test-service';

      // Create payment payload and requirements
      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount,
      });

      const paymentRequirements = createMockX402Requirements({
        amount,
        resource,
        description: 'Test API service payment',
      });

      // Verify payment
      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.sessionId).toBeTruthy();
      expect(verifyResult.expiresAt).toBeTruthy();

      // Verify session was created
      const session = await paymentSessionService.getSession(verifyResult.sessionId!);
      expect(session).toBeTruthy();
      expect(session!.status).toBe('verified');
      expect(session!.amount).toBe(500);
      expect(session!.fromAgent).toBe('test-sender');
      expect(session!.toAgent).toBe('test-receiver');
    });

    it('should reject verification with insufficient balance', async () => {
      const { paymentSessionService } = getTestServices();

      // Use poor agent (0.50 NP balance)
      const poorWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-poor' });
      const receiverWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      expect(poorWallet!.balanceMinor).toBe(50); // 0.50 NP

      const paymentPayload = createMockX402Payload({
        fromWalletId: poorWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '100', // 1.00 NP (more than 0.50 NP balance)
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '100',
        resource: '/api/expensive-service',
      });

      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.reason).toContain('Insufficient balance');
      expect(verifyResult.reason).toContain('Available: 0.50 NP');
      expect(verifyResult.reason).toContain('Required: 1.00 NP');
    });

    it('should reject verification with invalid wallet', async () => {
      const { paymentSessionService } = getTestServices();

      const receiverWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: 'nonexistent-wallet-id',
        toWalletId: receiverWallet!.walletId,
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

    it('should reject verification with missing payment details', async () => {
      const { paymentSessionService } = getTestServices();

      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload: {}, // Empty payload
        paymentRequirements: createMockX402Requirements({
          amount: '100',
          resource: '/api/service',
        }),
      });

      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.reason).toContain('Missing required payment details');
    });
  });

  describe('Session Management', () => {
    it('should create sessions with correct expiration', async () => {
      const { paymentSessionService, config } = getTestServices();

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
        expiresAt: new Date(Date.now() + config.security.sessionExpirationMinutes * 60 * 1000).toISOString(),
      });

      expect(session.sessionId).toBeTruthy();
      expect(session.status).toBe('verified');
      expect(session.amount).toBe(100);

      const retrievedSession = await paymentSessionService.getSession(session.sessionId);
      expect(retrievedSession).toEqual(session);
    });

    it('should handle session expiration', async () => {
      const { paymentSessionService } = getTestServices();

      // Create session that's already expired
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
        expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      });

      // Trying to get expired session should return null and mark it as expired
      const expiredSession = await paymentSessionService.getSession(session.sessionId);
      expect(expiredSession).toBeNull();

      // Check that session was marked as expired in database
      const dbSession = await paymentSessionService.db.collections.paymentSessions.findOne({
        sessionId: session.sessionId,
      });
      expect(dbSession?.status).toBe('expired');
    });

    it('should list sessions with filtering', async () => {
      const { paymentSessionService } = getTestServices();

      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const session = await paymentSessionService.createSession({
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
        sessions.push(session);
      }

      // List all sessions
      const allSessions = await paymentSessionService.listSessions({ limit: 10 });
      expect(allSessions.sessions).toHaveLength(3);
      expect(allSessions.total).toBe(3);

      // Filter by agent
      const agentSessions = await paymentSessionService.listSessions({
        fromAgent: 'test-sender',
        limit: 10,
      });
      expect(agentSessions.sessions).toHaveLength(3);

      // Filter by status
      const verifiedSessions = await paymentSessionService.listSessions({
        status: 'verified',
        limit: 10,
      });
      expect(verifiedSessions.sessions).toHaveLength(3);
    });
  });

  describe('Balance Operations', () => {
    it('should accurately check wallet balances', async () => {
      const { walletService } = getTestServices();

      // Check initial balances
      const senderBalance = await walletService.getBalance('test-sender');
      const receiverBalance = await walletService.getBalance('test-receiver');
      const poorBalance = await walletService.getBalance('test-poor');

      expect(senderBalance).toMatchObject({
        balanceMinor: 100000,
        balanceNP: 1000,
        formatted: '1000.00 NP',
      });

      expect(receiverBalance).toMatchObject({
        balanceMinor: 100000,
        balanceNP: 1000,
        formatted: '1000.00 NP',
      });

      expect(poorBalance).toMatchObject({
        balanceMinor: 50,
        balanceNP: 0.5,
        formatted: '0.50 NP',
      });
    });

    it('should perform wallet transfers', async () => {
      const { walletService } = getTestServices();

      const senderWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      // Perform transfer
      const transferResult = await walletService.transfer(
        senderWallet!.walletId,
        receiverWallet!.walletId,
        500 // 5.00 NP
      );

      expect(transferResult.success).toBe(true);

      // Check updated balances
      const newSenderBalance = await walletService.getBalance(senderWallet!.walletId);
      const newReceiverBalance = await walletService.getBalance(receiverWallet!.walletId);

      expect(newSenderBalance?.balanceMinor).toBe(99500); // 995.00 NP
      expect(newReceiverBalance?.balanceMinor).toBe(100500); // 1005.00 NP
    });

    it('should reject transfers with insufficient balance', async () => {
      const { walletService } = getTestServices();

      const poorWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-poor' });
      const receiverWallet = await getTestServices().db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      // Try to transfer more than available
      const transferResult = await walletService.transfer(
        poorWallet!.walletId,
        receiverWallet!.walletId,
        100 // 1.00 NP (more than 0.50 NP balance)
      );

      expect(transferResult.success).toBe(false);
      expect(transferResult.error).toContain('Insufficient balance');
      expect(transferResult.error).toContain('Available: 0.50 NP');
      expect(transferResult.error).toContain('Required: 1.00 NP');
    });
  });

  describe('Data Validation', () => {
    it('should validate NANDA Points precision', async () => {
      const { walletService } = getTestServices();

      // Test NandaPoints utility functions
      const { NandaPoints } = await import('../../src/models/wallet.js');

      expect(NandaPoints.toMinor(10.50)).toBe(1050);
      expect(NandaPoints.fromMinor(1050)).toBe(10.50);
      expect(NandaPoints.format(1050)).toBe('10.50 NP');

      // Edge cases
      expect(NandaPoints.toMinor(0.01)).toBe(1);
      expect(NandaPoints.toMinor(0.005)).toBe(1); // Rounds up
      expect(NandaPoints.format(1)).toBe('0.01 NP');
    });

    it('should handle database constraints', async () => {
      const { db } = getTestServices();

      // Test unique constraints
      const duplicateAgent = {
        id: 'test-id-1',
        agent_name: 'test-sender', // Duplicate name
        label: 'Duplicate Agent',
        email: 'duplicate@test.com',
        description: 'Should fail due to unique constraint',
        serviceCharge: 100,
        walletId: 'wallet-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Should throw due to unique constraint on agent_name
      await expect(db.collections.agents.insertOne(duplicateAgent)).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      const { paymentSessionService } = getTestServices();

      // Test with invalid scheme
      const invalidVerifyResult = await paymentSessionService.verifyPayment({
        paymentPayload: createMockX402Payload({
          fromWalletId: 'wallet1',
          toWalletId: 'wallet2',
          amount: '100',
        }),
        paymentRequirements: {
          scheme: 'invalid-scheme', // Not 'exact'
          amount: '100',
          resource: '/api/test',
        },
      });

      expect(invalidVerifyResult.valid).toBe(false);
      expect(invalidVerifyResult.reason).toContain('Only "exact" payment scheme is supported');
    });
  });
});