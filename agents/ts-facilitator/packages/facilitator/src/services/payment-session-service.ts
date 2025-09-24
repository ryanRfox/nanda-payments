import { randomUUID } from 'crypto';
import type { DatabaseService } from './database.js';
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

/**
 * Payment Session Service
 *
 * Manages x402 payment sessions for the verify/settle flow.
 * Handles session lifecycle, expiration, and state transitions.
 */
export class PaymentSessionService {
  constructor(
    private db: DatabaseService,
    private config: Config
  ) {}

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
   * Get payment session by ID
   */
  async getSession(sessionId: string): Promise<PaymentSession | null> {
    return await this.db.collections.paymentSessions.findOne({ sessionId });
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
      // TODO: Implement actual x402 payment verification
      // For now, simulate payment verification logic

      const { paymentPayload, paymentRequirements } = request;

      // Extract payment information (would be from x402 payload)
      const mockAmount = 1000; // 10.00 NP in minor units
      const mockFromAgent = 'requesting-agent';
      const mockToAgent = 'expert-agent';
      const mockResource = '/api/search';

      // Validate payment payload structure
      if (!paymentPayload || !paymentRequirements) {
        return {
          valid: false,
          reason: 'Invalid payment payload or requirements',
        };
      }

      // Create payment session
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.config.security.sessionExpirationMinutes * 60 * 1000
      );

      const session = await this.createSession({
        resourceServer: mockToAgent,
        resource: mockResource,
        amount: mockAmount,
        currency: 'NP',
        fromAgent: mockFromAgent,
        toAgent: mockToAgent,
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

      // Get payment session
      const session = await this.getSession(sessionId);
      if (!session) {
        return {
          settled: false,
          reason: 'Payment session not found',
        };
      }

      // Check session status and expiration
      if (session.status !== 'verified') {
        return {
          settled: false,
          reason: `Invalid session status: ${session.status}`,
        };
      }

      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      if (now > expiresAt) {
        return {
          settled: false,
          reason: 'Payment session expired',
        };
      }

      // TODO: Implement actual settlement logic with wallet service
      // For now, simulate successful settlement

      // Update session status
      await this.updateSession({
        sessionId,
        status: 'settled',
        settledAt: now.toISOString(),
      });

      // Mock balance updates
      const mockFromBalance = 90000; // 900.00 NP
      const mockToBalance = 110000;  // 1100.00 NP

      return {
        settled: true,
        transactionId: randomUUID(),
        balance: {
          from: mockFromBalance,
          to: mockToBalance,
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
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date().toISOString();

    const result = await this.db.collections.paymentSessions.deleteMany({
      expiresAt: { $lt: now },
      status: { $in: ['pending', 'verified'] }, // Don't delete settled sessions
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
  } = {}): Promise<{
    sessions: PaymentSession[];
    total: number;
  }> {
    const { status, fromAgent, toAgent, limit = 20, offset = 0 } = options;

    const query: any = {};
    if (status) query.status = status;
    if (fromAgent) query.fromAgent = fromAgent;
    if (toAgent) query.toAgent = toAgent;

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