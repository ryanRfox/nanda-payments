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
import {
  NandaX402Utils,
  NandaVerifyRequestSchema,
  NandaSettleRequestSchema,
  type NandaPaymentPayload,
  type NandaPaymentRequirements,
  NANDA_NETWORK,
} from '../models/x402-nanda.js';

/**
 * Payment Session Service
 *
 * Manages x402 payment sessions for the verify/settle flow.
 * Handles session lifecycle, expiration, and state transitions.
 */
export class PaymentSessionService {

  constructor(
    private db: DatabaseService,
    private walletService: WalletService,
    private transactionService: TransactionService,
    private config: Config
  ) {
    // No automatic cleanup - keep it simple like Coinbase pattern
  }

  /**
   * Extract payment details from x402 payload (handles x402 standard and legacy formats)
   */
  private extractPaymentDetails(paymentPayload: unknown, paymentRequirements: unknown): {
    fromWalletId: string;
    toWalletId: string;
    amount: string | number;
    isX402Compliant: boolean;
  } {
    // Try x402-compliant NANDA format first
    if (NandaX402Utils.isNandaPayload(paymentPayload)) {
      const nandaPayload = paymentPayload as NandaPaymentPayload;
      const { fromWalletId, toWalletId, amount } = NandaX402Utils.extractWalletIds(nandaPayload);
      return { fromWalletId, toWalletId, amount, isX402Compliant: true };
    }

    // Fall back to legacy formats for backward compatibility
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
      // Direct payload (legacy NANDA format)
      fromWalletId = String(payload.from || '');
      toWalletId = String(payload.to || '');
      amount = String(payload.amount || '');
    }

    // Use payment requirements as fallback
    if (!amount) {
      amount = String(requirements.maxAmountRequired || requirements.amount || '');
    }
    if (!toWalletId) {
      toWalletId = String(requirements.recipientAddress || requirements.recipient || requirements.payTo || '');
    }

    return { fromWalletId, toWalletId, amount, isX402Compliant: false };
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

      // Step 1: Try x402-compliant validation first
      try {
        const x402Request = NandaVerifyRequestSchema.parse({
          paymentPayload,
          paymentRequirements,
        });

        // If we reach here, it's a valid x402-compliant request
        return await this.processX402VerifyRequest(x402Request);

      } catch (x402Error) {
        // If x402 validation fails, try legacy format for backward compatibility
        console.log('x402 validation failed, trying legacy format:', x402Error);
      }

      // Step 2: Legacy format validation
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

      // Step 3: Extract payment information from legacy payload
      const { fromWalletId, toWalletId, amount: payloadAmount, isX402Compliant } = this.extractPaymentDetails(paymentPayload, paymentRequirements);
      const resource = paymentRequirements.resource || 'unknown';

      if (!fromWalletId || !toWalletId || (payloadAmount === null || payloadAmount === undefined || payloadAmount === '')) {
        return {
          valid: false,
          reason: 'Missing required payment details: from, to, or amount',
        };
      }

      // Convert amount to NANDA Points minor units
      let amountMinor: number;
      try {
        if (typeof payloadAmount === 'number') {
          // Already in minor units from x402 format
          amountMinor = payloadAmount;
        } else {
          // Legacy string format - assume NP format like "10.50" or "0.001"
          const npAmount = parseFloat(String(payloadAmount).replace('$', ''));
          amountMinor = NandaPoints.toMinor(npAmount);
        }
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
   * Process x402-compliant verify request (NANDA Points format)
   */
  private async processX402VerifyRequest(request: {
    paymentPayload: NandaPaymentPayload;
    paymentRequirements: NandaPaymentRequirements;
  }): Promise<VerifyResponse> {
    const { paymentPayload, paymentRequirements } = request;

    // Extract wallet IDs from x402 payload (amount is already in minor units)
    const { fromWalletId, toWalletId, amount: amountMinor } = NandaX402Utils.extractWalletIds(paymentPayload);

    // Validate that payTo matches the destination wallet
    if (paymentRequirements.payTo !== toWalletId) {
      return {
        valid: false,
        reason: 'Payment requirements payTo field does not match payload destination',
      };
    }

    // Validate amount matches maxAmountRequired (both are uInt minor units)
    if (amountMinor !== paymentRequirements.maxAmountRequired) {
      return {
        valid: false,
        reason: `Payment amount does not match required amount. Provided: ${amountMinor} (${NandaX402Utils.formatAmount(amountMinor)}), Required: ${paymentRequirements.maxAmountRequired} (${NandaX402Utils.formatAmount(paymentRequirements.maxAmountRequired)})`,
      };
    }

    // Amount validation: ensure non-negative integer (uInt validation)
    if (!Number.isInteger(amountMinor) || amountMinor < 0) {
      return {
        valid: false,
        reason: 'Payment amount must be a non-negative integer in minor units',
      };
    }

    // Find wallets by UUID
    const [fromWallet, toWallet] = await Promise.all([
      this.db.collections.wallets.findOne({ walletId: fromWalletId }),
      this.db.collections.wallets.findOne({ walletId: toWalletId }),
    ]);

    if (!fromWallet || !toWallet) {
      return {
        valid: false,
        reason: 'Source or destination wallet not found in NANDA network',
      };
    }

    // Verify sufficient balance
    const balance = await this.walletService.getBalance(fromWallet.walletId);
    if (!balance || balance.balanceMinor < amountMinor) {
      return {
        valid: false,
        reason: `Insufficient balance. Required: ${NandaPoints.format(amountMinor)}, Available: ${balance ? NandaPoints.format(balance.balanceMinor) : '0.00 NP'}`,
      };
    }

    // Create payment session
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (paymentRequirements.maxTimeoutSeconds || this.config.security.sessionExpirationMinutes * 60) * 1000
    );

    const session = await this.createSession({
      resourceServer: toWallet.agent_name,
      resource: paymentRequirements.resource,
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

  // Reference implementation: Coinbase x402 facilitators are stateless
  // Sessions expire naturally through database TTL or client-side handling
  // No periodic cleanup needed - keeps implementation simple

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