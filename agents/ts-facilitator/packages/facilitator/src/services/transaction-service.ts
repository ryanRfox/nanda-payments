import { randomUUID } from 'crypto';
import type { DatabaseService } from './database.js';
import type { WalletService } from './wallet-service.js';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQuery,
  TransactionSummary,
} from '../models/transaction.js';

/**
 * Transaction Service
 *
 * Manages NANDA Points transactions and provides transaction history.
 * Handles both immediate payments and x402 settlement flows.
 */
export class TransactionService {
  constructor(
    private db: DatabaseService,
    private walletService: WalletService
  ) {}

  /**
   * Create a new transaction with wallet transfer
   */
  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const transactionId = randomUUID();
    const now = new Date().toISOString();

    const transaction: Transaction = {
      id: transactionId,
      ...input,
      createdAt: now,
    };

    // Execute transfer and create transaction record
    return await this.db.withTransaction(async () => {
      // Perform wallet transfer
      const transferResult = await this.walletService.transfer(
        input.fromWallet,
        input.toWallet,
        input.amount
      );

      if (!transferResult.success) {
        throw new Error(transferResult.error || 'Transfer failed');
      }

      // Create transaction record
      if (input.status === 'completed') {
        transaction.settledAt = now;
      }

      await this.db.collections.transactions.insertOne(transaction);

      return transaction;
    });
  }

  /**
   * Update transaction status
   */
  async updateTransaction(updates: UpdateTransactionInput): Promise<Transaction | null> {
    const { id, ...updateFields } = updates;
    const now = new Date().toISOString();

    // Add settledAt timestamp if status is being set to completed
    if (updateFields.status === 'completed' && !updateFields.settledAt) {
      updateFields.settledAt = now;
    }

    const result = await this.db.collections.transactions.findOneAndUpdate(
      { id },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: string): Promise<Transaction | null> {
    return await this.db.collections.transactions.findOne({ id });
  }

  /**
   * Query transactions with filtering and pagination
   */
  async queryTransactions(query: TransactionQuery): Promise<{
    transactions: Transaction[];
    total: number;
    summary: {
      totalAmount: number;
      averageAmount: number;
      statusCounts: Record<string, number>;
    };
  }> {
    const {
      agent_name,
      wallet_id,
      status,
      type,
      from_date,
      to_date,
      limit,
      offset,
    } = query;

    // Build MongoDB query
    const mongoQuery: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (agent_name) {
      mongoQuery.$or = [
        { 'metadata.agent_from': agent_name },
        { 'metadata.agent_to': agent_name },
      ];
    }

    if (wallet_id) {
      mongoQuery.$or = [
        { fromWallet: wallet_id },
        { toWallet: wallet_id },
      ];
    }

    if (status) {
      mongoQuery.status = status;
    }

    if (type) {
      mongoQuery.type = type;
    }

    if (from_date || to_date) {
      mongoQuery.createdAt = {};
      if (from_date) {
        mongoQuery.createdAt.$gte = from_date;
      }
      if (to_date) {
        mongoQuery.createdAt.$lte = to_date;
      }
    }

    // Execute queries in parallel
    const [transactions, total, summaryStats] = await Promise.all([
      this.db.collections.transactions
        .find(mongoQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .toArray(),

      this.db.collections.transactions.countDocuments(mongoQuery),

      this.db.collections.transactions.aggregate([
        { $match: mongoQuery },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            averageAmount: { $avg: '$amount' },
            statusCounts: {
              $push: '$status'
            },
          },
        },
      ]).toArray(),
    ]);

    // Process status counts
    const statusCounts: Record<string, number> = {};
    if (summaryStats[0]?.statusCounts) {
      summaryStats[0].statusCounts.forEach((status: string) => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
    }

    const summary = {
      totalAmount: summaryStats[0]?.totalAmount || 0,
      averageAmount: Math.round(summaryStats[0]?.averageAmount || 0),
      statusCounts,
    };

    return { transactions, total, summary };
  }

  /**
   * Get transaction history for a specific agent
   */
  async getAgentTransactionHistory(
    agentName: string,
    limit = 20,
    offset = 0
  ): Promise<{
    transactions: Transaction[];
    total: number;
  }> {
    const result = await this.queryTransactions({
      agent_name: agentName,
      limit,
      offset,
    });

    return {
      transactions: result.transactions,
      total: result.total,
    };
  }

  /**
   * Get recent transactions across the network
   */
  async getRecentTransactions(limit = 50): Promise<Transaction[]> {
    return await this.db.collections.transactions
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get transaction summary statistics
   */
  async getTransactionSummary(dateRange?: {
    from: string;
    to: string;
  }): Promise<TransactionSummary> {
    const query: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (dateRange) {
      query.createdAt = {
        $gte: dateRange.from,
        $lte: dateRange.to,
      };
    }

    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalVolume: { $sum: '$amount' },
          averageAmount: { $avg: '$amount' },
          pendingTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
        },
      },
    ];

    const result = await this.db.collections.transactions.aggregate(pipeline).toArray();
    const stats = result[0];

    if (!stats) {
      return {
        totalTransactions: 0,
        totalVolume: 0,
        pendingTransactions: 0,
        completedTransactions: 0,
        failedTransactions: 0,
        averageAmount: 0,
        dateRange: dateRange || {
          from: new Date().toISOString(),
          to: new Date().toISOString(),
        },
      };
    }

    return {
      totalTransactions: stats.totalTransactions,
      totalVolume: stats.totalVolume,
      pendingTransactions: stats.pendingTransactions,
      completedTransactions: stats.completedTransactions,
      failedTransactions: stats.failedTransactions,
      averageAmount: Math.round(stats.averageAmount || 0),
      dateRange: dateRange || {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
        to: new Date().toISOString(),
      },
    };
  }

  /**
   * Get transactions by session ID (for x402 flows)
   */
  async getTransactionsBySession(sessionId: string): Promise<Transaction[]> {
    return await this.db.collections.transactions
      .find({ 'metadata.session_id': sessionId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Mark transaction as failed with error message
   */
  async markTransactionFailed(id: string, error: string): Promise<Transaction | null> {
    return await this.updateTransaction({
      id,
      status: 'failed',
      error,
    });
  }

  /**
   * Mark transaction as completed
   */
  async markTransactionCompleted(id: string): Promise<Transaction | null> {
    return await this.updateTransaction({
      id,
      status: 'completed',
    });
  }
}