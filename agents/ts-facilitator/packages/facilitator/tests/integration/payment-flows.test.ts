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
 * Payment Flow Integration Tests
 *
 * Tests the complete end-to-end payment flows:
 * - x402 verify/settle flow
 * - Wallet balance validation
 * - Payment session lifecycle
 * - Error scenarios
 */

describe('Payment Flow Integration Tests', () => {
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

  describe('Successful Payment Flow', () => {
    it('should complete full verify -> settle flow', async () => {
      const { paymentSessionService, walletService } = getTestServices();

      // Get sender and receiver wallets
      const senderWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      expect(senderWallet).toBeTruthy();
      expect(receiverWallet).toBeTruthy();

      const amount = '5.00'; // 5 NP
      const resource = '/api/test-service';

      // Step 1: Create payment payload and requirements
      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '500', // 5.00 NP in minor units
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '500',
        resource,
        description: 'Test API service payment',
      });

      // Step 2: Verify payment
      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.sessionId).toBeTruthy();
      expect(verifyResult.expiresAt).toBeTruthy();

      // Step 3: Get initial balances
      const initialSenderBalance = await walletService.getBalance(senderWallet!.walletId);
      const initialReceiverBalance = await walletService.getBalance(receiverWallet!.walletId);

      expect(initialSenderBalance?.balanceMinor).toBe(100000); // 1000 NP default
      expect(initialReceiverBalance?.balanceMinor).toBe(100000); // 1000 NP default

      // Step 4: Settle payment
      const settleResult = await paymentSessionService.settlePayment({
        sessionId: verifyResult.sessionId!,
        paymentPayload,
      });

      expect(settleResult.settled).toBe(true);
      expect(settleResult.transactionId).toBeTruthy();
      expect(settleResult.balance?.from).toBe(99500); // 995 NP
      expect(settleResult.balance?.to).toBe(100500); // 1005 NP

      // Step 5: Verify final balances
      const finalSenderBalance = await walletService.getBalance(senderWallet!.walletId);
      const finalReceiverBalance = await walletService.getBalance(receiverWallet!.walletId);

      expect(finalSenderBalance?.balanceMinor).toBe(99500); // 995 NP
      expect(finalReceiverBalance?.balanceMinor).toBe(100500); // 1005 NP

      // Step 6: Verify payment session is marked as settled
      const finalSession = await paymentSessionService.getSession(verifyResult.sessionId!);
      expect(finalSession?.status).toBe('settled');
      expect(finalSession?.settledAt).toBeTruthy();
    });

    it('should create transaction record with correct metadata', async () => {
      const { paymentSessionService, transactionService } = getTestServices();

      const senderWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '300',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '300',
        resource: '/api/ai-search',
        description: 'AI Search API call',
      });

      // Verify and settle
      const verifyResult = await paymentSessionService.verifyPayment({ paymentPayload, paymentRequirements });
      const settleResult = await paymentSessionService.settlePayment({
        sessionId: verifyResult.sessionId!,
        paymentPayload,
      });

      // Get transaction
      const transaction = await transactionService.getTransactionById(settleResult.transactionId!);

      expect(transaction).toBeTruthy();
      expect(transaction!.amount).toBe(300);
      expect(transaction!.currency).toBe('NP');
      expect(transaction!.type).toBe('payment');
      expect(transaction!.status).toBe('completed');
      expect(transaction!.metadata.agent_from).toBe('test-sender');
      expect(transaction!.metadata.agent_to).toBe('test-receiver');
      expect(transaction!.metadata.session_id).toBe(verifyResult.sessionId);
      expect(transaction!.metadata.description).toContain('/api/ai-search');
    });
  });

  describe('Error Scenarios', () => {
    it('should reject verification with insufficient balance', async () => {
      const { paymentSessionService } = getTestServices();

      // Use poor agent (0.50 NP balance)
      const poorWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-poor' });
      const receiverWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

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

      const receiverWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

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

    it('should reject settlement with expired session', async () => {
      const { paymentSessionService, config } = getTestServices();

      const senderWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '100',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '100',
        resource: '/api/service',
      });

      // Verify payment
      const verifyResult = await paymentSessionService.verifyPayment({ paymentPayload, paymentRequirements });
      expect(verifyResult.valid).toBe(true);

      // Manually expire the session
      await paymentSessionService.updateSession({
        sessionId: verifyResult.sessionId!,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      });

      // Try to settle expired session
      const settleResult = await paymentSessionService.settlePayment({
        sessionId: verifyResult.sessionId!,
        paymentPayload,
      });

      expect(settleResult.settled).toBe(false);
      expect(settleResult.reason).toContain('Payment session expired');
    });

    it('should reject settlement with mismatched payload', async () => {
      const { paymentSessionService } = getTestServices();

      const senderWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const originalPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '100',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '100',
        resource: '/api/service',
      });

      // Verify with original payload
      const verifyResult = await paymentSessionService.verifyPayment({
        paymentPayload: originalPayload,
        paymentRequirements,
      });
      expect(verifyResult.valid).toBe(true);

      // Try to settle with different payload
      const differentPayload = createMockX402Payload({
        fromWalletId: receiverWallet!.walletId, // Swapped wallets
        toWalletId: senderWallet!.walletId,
        amount: '100',
      });

      const settleResult = await paymentSessionService.settlePayment({
        sessionId: verifyResult.sessionId!,
        paymentPayload: differentPayload,
      });

      expect(settleResult.settled).toBe(false);
      expect(settleResult.reason).toContain('Payment payload wallet addresses do not match');
    });

    it('should reject settlement with nonexistent session', async () => {
      const { paymentSessionService } = getTestServices();

      const paymentPayload = createMockX402Payload({
        fromWalletId: 'wallet1',
        toWalletId: 'wallet2',
        amount: '100',
      });

      const settleResult = await paymentSessionService.settlePayment({
        sessionId: 'nonexistent-session-id',
        paymentPayload,
      });

      expect(settleResult.settled).toBe(false);
      expect(settleResult.reason).toBe('Payment session not found');
    });
  });

  describe('Session Management', () => {
    it('should handle session expiration', async () => {
      const { paymentSessionService } = getTestServices();

      const senderWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await getTestServices().walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      const paymentPayload = createMockX402Payload({
        fromWalletId: senderWallet!.walletId,
        toWalletId: receiverWallet!.walletId,
        amount: '100',
      });

      const paymentRequirements = createMockX402Requirements({
        amount: '100',
        resource: '/api/service',
      });

      // Create session
      const verifyResult = await paymentSessionService.verifyPayment({ paymentPayload, paymentRequirements });
      expect(verifyResult.valid).toBe(true);

      // Verify session exists
      const activeSession = await paymentSessionService.getSession(verifyResult.sessionId!);
      expect(activeSession?.status).toBe('verified');

      // Expire the session
      await paymentSessionService.updateSession({
        sessionId: verifyResult.sessionId!,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      // Trying to get expired session should return null
      const expiredSession = await paymentSessionService.getSession(verifyResult.sessionId!);
      expect(expiredSession).toBeNull();
    });

    it('should cleanup expired sessions', async () => {
      const { paymentSessionService } = getTestServices();

      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const session = await paymentSessionService.createSession({
          resourceServer: 'test-server',
          resource: `/api/service-${i}`,
          amount: 100,
          currency: 'NP',
          fromAgent: 'test-sender',
          toAgent: 'test-receiver',
          status: 'verified',
          paymentRequirements: {},
          paymentPayload: {},
          expiresAt: new Date(Date.now() - 1000 * (i + 1)).toISOString(), // All expired
        });
        sessions.push(session);
      }

      // Run cleanup
      const cleanedCount = await paymentSessionService.cleanupExpiredSessions();
      expect(cleanedCount).toBe(0); // Should mark as expired, not delete immediately

      // Verify sessions are marked as expired
      for (const session of sessions) {
        const updatedSession = await paymentSessionService.db.collections.paymentSessions.findOne({
          sessionId: session.sessionId,
        });
        expect(updatedSession?.status).toBe('expired');
      }
    });
  });

  describe('Balance Operations', () => {
    it('should maintain accurate balances through multiple transactions', async () => {
      const { paymentSessionService, walletService } = getTestServices();

      const senderWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-sender' });
      const receiverWallet = await walletService.db.collections.wallets.findOne({ agent_name: 'test-receiver' });

      // Initial balances
      expect((await walletService.getBalance(senderWallet!.walletId))?.balanceMinor).toBe(100000);
      expect((await walletService.getBalance(receiverWallet!.walletId))?.balanceMinor).toBe(100000);

      // Transaction 1: 2.50 NP
      const tx1 = await paymentSessionService.verifyPayment({
        paymentPayload: createMockX402Payload({
          fromWalletId: senderWallet!.walletId,
          toWalletId: receiverWallet!.walletId,
          amount: '250',
        }),
        paymentRequirements: createMockX402Requirements({ amount: '250', resource: '/api/1' }),
      });
      await paymentSessionService.settlePayment({
        sessionId: tx1.sessionId!,
        paymentPayload: createMockX402Payload({
          fromWalletId: senderWallet!.walletId,
          toWalletId: receiverWallet!.walletId,
          amount: '250',
        }),
      });

      // Check intermediate balances
      expect((await walletService.getBalance(senderWallet!.walletId))?.balanceMinor).toBe(99750);
      expect((await walletService.getBalance(receiverWallet!.walletId))?.balanceMinor).toBe(100250);

      // Transaction 2: 7.25 NP
      const tx2 = await paymentSessionService.verifyPayment({
        paymentPayload: createMockX402Payload({
          fromWalletId: senderWallet!.walletId,
          toWalletId: receiverWallet!.walletId,
          amount: '725',
        }),
        paymentRequirements: createMockX402Requirements({ amount: '725', resource: '/api/2' }),
      });
      await paymentSessionService.settlePayment({
        sessionId: tx2.sessionId!,
        paymentPayload: createMockX402Payload({
          fromWalletId: senderWallet!.walletId,
          toWalletId: receiverWallet!.walletId,
          amount: '725',
        }),
      });

      // Check final balances: Sender should have 990.25 NP, Receiver should have 1009.75 NP
      expect((await walletService.getBalance(senderWallet!.walletId))?.balanceMinor).toBe(99025);
      expect((await walletService.getBalance(receiverWallet!.walletId))?.balanceMinor).toBe(100975);
    });
  });
});