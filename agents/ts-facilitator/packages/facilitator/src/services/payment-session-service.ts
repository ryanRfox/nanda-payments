import { randomUUID } from 'crypto';
import type { DatabaseService } from './database.js';
import type { WalletService } from './wallet-service.js';
import type { TransactionService } from './transaction-service.js';
import {
  PaymentSession,
  CreatePaymentSessionInput,
  UpdatePaymentSessionInput,
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
} from '../models/payment-session.js';
import type { Config } from '../models/config.js';
import { NandaPoints } from '../models/wallet.js';

/**
 * Payment Session Service
 *
 * Manages x402 payment sessions for the verify/settle flow.
 * Handles session lifecycle, expiration, and state transitions.
 */
export class PaymentSessionService {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: DatabaseService,
    private walletService: WalletService,
    private transactionService: TransactionService,
    private config: Config
  ) {
    // Start automatic cleanup of expired sessions
    this.startPeriodicCleanup();
  }

  /**
   * Extract payment details from x402 payload (handles different formats)
   */
  private extractPaymentDetails(paymentPayload: unknown, paymentRequirements: unknown): {
    fromWalletId: string;
    toWalletId: string;
    amount: string;
  } {
    let fromWalletId = '';
    let toWalletId = '';
    let amount = '';

    const payload = paymentPayload as Record<string, unknown>;
    const requirements = paymentRequirements as Record<string, unknown>;

    // Handle EVM-style payload
    if (payload?.payload) {
      const innerPayload = payload.payload as Record<string, unknown>;
      if (innerPayload?.authorization) {
        // EVM authorization format
        const auth = innerPayload.authorization as Record<string, unknown>;
        fromWalletId = String(auth.from || '');
        toWalletId = String(auth.to || '');
        amount = String(auth.value || '');
      } else {
        // Other EVM format
        fromWalletId = String(innerPayload.from || '');
        toWalletId = String(innerPayload.to || '');
        amount = String(innerPayload.value || innerPayload.amount || '');
      }
    } else {
      // Direct payload (custom NANDA format)
      fromWalletId = String(payload.from || '');
      toWalletId = String(payload.to || '');
      amount = String(payload.amount || '');
    }

    // Use payment requirements as fallback
    if (!amount) {
      amount = String(requirements.maxAmountRequired || requirements.amount || '');
    }
    if (!toWalletId) {
      toWalletId = String(requirements.recipientAddress || requirements.recipient || '');
    }

    return { fromWalletId, toWalletId, amount };
  }

  /**
   * Create a new payment session
   */
  async createSession(input: CreatePaymentSessionInput): Promise<PaymentSession> {
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.security.sessionExpirationMinutes * 60 * 1000
    );

    const session: PaymentSession = {
      sessionId,
      ...input,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.db.collections.paymentSessions.insertOne(session);
    return session;
  }

  /**
   * Get payment session by ID (validates expiration)
   */
  async getSession(sessionId: string): Promise<PaymentSession | null> {
    const session = await this.db.collections.paymentSessions.findOne({ sessionId });

    if (!session) {
      return null;
    }

    // Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    if (now > expiresAt && session.status !== 'settled') {
      // Mark as expired if not already settled
      await this.updateSession({
        sessionId,
        status: 'expired',
      });
      return null; // Return null for expired sessions
    }

    return session;
  }

  /**
   * Update payment session
   */
  async updateSession(updates: UpdatePaymentSessionInput): Promise<PaymentSession | null> {
    const { sessionId, ...updateFields } = updates;

    const result = await this.db.collections.paymentSessions.findOneAndUpdate(
      { sessionId },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Verify payment payload and create/update session
   */
  async verifyPayment(request: VerifyRequest): Promise<VerifyResponse> {
    try {
      const { paymentPayload, paymentRequirements } = request;

      // Step 1: Basic x402 payload validation
      if (!paymentPayload || !paymentRequirements) {
        return {
          valid: false,
          reason: 'Missing payment payload or requirements',
        };
      }

      if (paymentRequirements.scheme !== 'exact') {
        return {
          valid: false,
          reason: 'Only "exact" payment scheme is supported',
        };
      }

      // Step 2: Extract payment information from payload
      const { fromWalletId, toWalletId, amount: amountString } = this.extractPaymentDetails(paymentPayload, paymentRequirements);
      const resource = paymentRequirements.resource || 'unknown';

      if (!fromWalletId || !toWalletId || !amountString) {
        return {
          valid: false,
          reason: 'Missing required payment details: from, to, or amount',
        };
      }

      // Convert amount to NANDA Points minor units
      let amountMinor: number;
      try {
        // Assuming amount is in NP format like "10.50" or "0.001"
        const npAmount = parseFloat(amountString.replace('$', ''));
        amountMinor = NandaPoints.toMinor(npAmount);
      } catch {
        return {
          valid: false,
          reason: 'Invalid payment amount format',
        };
      }

      // Step 3: Find source and destination agents by wallet IDs
      const fromWallet = await this.db.collections.wallets.findOne({ walletId: fromWalletId });
      const toWallet = await this.db.collections.wallets.findOne({ walletId: toWalletId });

      if (!fromWallet || !toWallet) {
        return {
          valid: false,
          reason: 'Source or destination wallet not found in NANDA network',
        };
      }

      // Step 4: Verify sufficient balance
      const balance = await this.walletService.getBalance(fromWallet.walletId);
      if (!balance || balance.balanceMinor < amountMinor) {
        return {
          valid: false,
          reason: `Insufficient balance. Required: ${NandaPoints.format(amountMinor)}, Available: ${balance ? NandaPoints.format(balance.balanceMinor) : '0.00 NP'}`,
        };
      }

      // Step 5: Create payment session
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.config.security.sessionExpirationMinutes * 60 * 1000
      );

      const session = await this.createSession({
        resourceServer: toWallet.agent_name,
        resource,
        amount: amountMinor,
        currency: 'NP',
        fromAgent: fromWallet.agent_name,
        toAgent: toWallet.agent_name,
        status: 'verified',
        paymentRequirements,
        paymentPayload,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        valid: true,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      };

    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Settle payment using session
   */
  async settlePayment(request: SettleRequest): Promise<SettleResponse> {
    try {
      const { sessionId, paymentPayload } = request;

      // Step 1: Get and validate payment session
      const session = await this.getSession(sessionId);
      if (!session) {
        return {
          settled: false,
          reason: 'Payment session not found',
        };
      }

      // Step 2: Check session status and expiration
      if (session.status !== 'verified') {
        return {
          settled: false,
          reason: `Invalid session status: ${session.status}`,
        };
      }

      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      if (now > expiresAt) {
        // Mark session as expired
        await this.updateSession({
          sessionId,
          status: 'expired',
        });
        return {
          settled: false,
          reason: 'Payment session expired',
        };
      }

      // Step 3: Verify payment payload matches session (basic validation)
      // For NANDA Points, we compare the essential payment details
      const sessionFromWallet = await this.db.collections.wallets.findOne({ agent_name: session.fromAgent });
      const sessionToWallet = await this.db.collections.wallets.findOne({ agent_name: session.toAgent });

      if (!sessionFromWallet || !sessionToWallet) {
        return {
          settled: false,
          reason: 'Cannot validate session wallet details',
        };
      }

      // Extract current payload details for comparison
      const { fromWalletId: currentFromWallet, toWalletId: currentToWallet } = this.extractPaymentDetails(paymentPayload, {});

      if (currentFromWallet !== sessionFromWallet.walletId ||
          currentToWallet !== sessionToWallet.walletId) {
        return {
          settled: false,
          reason: 'Payment payload wallet addresses do not match verified session',
        };
      }

      // Step 4: Find wallets
      const fromWallet = await this.db.collections.wallets.findOne({
        agent_name: session.fromAgent
      });
      const toWallet = await this.db.collections.wallets.findOne({
        agent_name: session.toAgent
      });

      if (!fromWallet || !toWallet) {
        return {
          settled: false,
          reason: 'Wallet not found for transaction',
        };
      }

      // Step 5: Execute atomic transfer and create transaction record
      const transaction = await this.transactionService.createTransaction({
        fromWallet: fromWallet.walletId,
        toWallet: toWallet.walletId,
        amount: session.amount,
        currency: 'NP',
        type: 'payment',
        status: 'completed',
        metadata: {
          session_id: sessionId,
          agent_from: session.fromAgent,
          agent_to: session.toAgent,
          description: `x402 payment for ${session.resource}`,
        },
      });

      // Step 6: Update session status
      await this.updateSession({
        sessionId,
        status: 'settled',
        settledAt: now.toISOString(),
      });

      // Step 7: Get updated balances
      const fromBalance = await this.walletService.getBalance(fromWallet.walletId);
      const toBalance = await this.walletService.getBalance(toWallet.walletId);

      return {
        settled: true,
        transactionId: transaction.id,
        balance: {
          from: fromBalance?.balanceMinor || 0,
          to: toBalance?.balanceMinor || 0,
        },
      };

    } catch (error) {
      console.error('Payment settlement error:', error);
      return {
        settled: false,
        reason: error instanceof Error ? error.message : 'Settlement failed',
      };
    }
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  private startPeriodicCleanup(): void {
    // Clean up expired sessions every 5 minutes
    const intervalMs = 5 * 60 * 1000;

    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanupExpiredSessions();
        if (cleaned > 0) {
          console.log(`🧹 Auto-cleaned ${cleaned} expired payment sessions`);
        }
      } catch (error) {
        console.error('❌ Error during automatic session cleanup:', error);
      }
    }, intervalMs);

    console.log('⏰ Started automatic payment session cleanup (every 5 minutes)');
  }

  /**
   * Stop periodic cleanup
   */
  public stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 Stopped automatic payment session cleanup');
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date().toISOString();

    // First, mark expired sessions that aren't already marked
    await this.db.collections.paymentSessions.updateMany(
      {
        expiresAt: { $lt: now },
        status: { $in: ['pending', 'verified'] }
      },
      {
        $set: { status: 'expired' }
      }
    );

    // Then delete old expired sessions (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = await this.db.collections.paymentSessions.deleteMany({
      expiresAt: { $lt: oneDayAgo },
      status: 'expired'
    });

    return result.deletedCount || 0;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    settledSessions: number;
    averageSettlementTime: number; // in milliseconds
  }> {
    const now = new Date().toISOString();

    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgSettlementTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'settled'] },
                {
                  $subtract: [
                    { $dateFromString: { dateString: '$settledAt' } },
                    { $dateFromString: { dateString: '$createdAt' } },
                  ]
                },
                null,
              ]
            }
          },
        },
      },
    ];

    const [stats, expiredCount] = await Promise.all([
      this.db.collections.paymentSessions.aggregate(pipeline).toArray(),
      this.db.collections.paymentSessions.countDocuments({
        expiresAt: { $lt: now },
        status: { $ne: 'settled' },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    let avgSettlementTime = 0;

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
      if (stat._id === 'settled' && stat.avgSettlementTime) {
        avgSettlementTime = stat.avgSettlementTime;
      }
    });

    return {
      totalSessions: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      activeSessions: (statusCounts.pending || 0) + (statusCounts.verified || 0),
      expiredSessions: expiredCount,
      settledSessions: statusCounts.settled || 0,
      averageSettlementTime: Math.round(avgSettlementTime),
    };
  }

  /**
   * List sessions with filtering
   */
  async listSessions(options: {
    status?: string;
    fromAgent?: string;
    toAgent?: string;
    limit?: number;
    offset?: number;
    includeExpired?: boolean; // Option to include expired sessions
  } = {}): Promise<{
    sessions: PaymentSession[];
    total: number;
  }> {
    const { status, fromAgent, toAgent, limit = 20, offset = 0, includeExpired = false } = options;

    const query: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (status) query.status = status;
    if (fromAgent) query.fromAgent = fromAgent;
    if (toAgent) query.toAgent = toAgent;

    // Filter out expired sessions by default
    if (!includeExpired) {
      const now = new Date().toISOString();
      query.$or = [
        { status: 'settled' }, // Always include settled sessions
        { expiresAt: { $gte: now } } // Include non-expired sessions
      ];
    }

    const [sessions, total] = await Promise.all([
      this.db.collections.paymentSessions
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .toArray(),
      this.db.collections.paymentSessions.countDocuments(query),
    ]);

    return { sessions, total };
  }
}