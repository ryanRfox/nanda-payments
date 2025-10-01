import { randomUUID } from 'crypto';
import type { DatabaseService } from './database.js';
import {
  Wallet,
  CreateWalletInput,
  UpdateWalletBalanceInput,
  NandaPoints,
} from '../models/wallet.js';

/**
 * Wallet Service
 *
 * Manages NANDA Points wallets and balance operations.
 * Provides atomic balance updates and transaction support.
 */
export class WalletService {
  constructor(private db: DatabaseService) {}

  /**
   * Create a new wallet (simplified Coinbase pattern)
   * Agent name is optional - walletId is the primary identifier
   */
  async createWallet(input: Partial<CreateWalletInput> & {
    walletId?: string;
    initialBalance?: number;
  }): Promise<Wallet> {
    const now = new Date().toISOString();
    const wallet: Wallet = {
      walletId: input.walletId || randomUUID(),
      agent_name: input.agent_name || '', // Empty string if no agent
      currency: 'NP',
      scale: 2,
      balanceMinor: input.initialBalance || input.balanceMinor || 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collections.wallets.insertOne(wallet);
    return wallet;
  }

  /**
   * Get wallet by ID
   */
  async getWalletById(walletId: string): Promise<Wallet | null> {
    return await this.db.collections.wallets.findOne({ walletId });
  }

  /**
   * Get wallet by agent name
   */
  async getWalletByAgent(agentName: string): Promise<Wallet | null> {
    return await this.db.collections.wallets.findOne({ agent_name: agentName });
  }

  /**
   * Update wallet balance
   */
  async updateBalance(input: UpdateWalletBalanceInput): Promise<Wallet | null> {
    const now = new Date().toISOString();

    const result = await this.db.collections.wallets.findOneAndUpdate(
      { walletId: input.walletId },
      {
        $set: {
          balanceMinor: input.balanceMinor,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Transfer NP between wallets atomically
   */
  async transfer(
    fromWalletId: string,
    toWalletId: string,
    amountMinor: number
  ): Promise<{ success: boolean; fromBalance?: number; toBalance?: number; error?: string }> {
    if (!NandaPoints.isValidAmount(amountMinor) || amountMinor <= 0) {
      return { success: false, error: 'Invalid transfer amount' };
    }

    return await this.db.withTransaction(async () => {
      // Get current balances
      const fromWallet = await this.db.collections.wallets.findOne(
        { walletId: fromWalletId }
      );
      const toWallet = await this.db.collections.wallets.findOne(
        { walletId: toWalletId }
      );

      if (!fromWallet) {
        return { success: false, error: 'Source wallet not found' };
      }
      if (!toWallet) {
        return { success: false, error: 'Destination wallet not found' };
      }

      // Check sufficient balance
      if (fromWallet.balanceMinor < amountMinor) {
        return {
          success: false,
          error: `Insufficient balance. Available: ${NandaPoints.format(fromWallet.balanceMinor)}, Required: ${NandaPoints.format(amountMinor)}`
        };
      }

      const now = new Date().toISOString();
      const newFromBalance = fromWallet.balanceMinor - amountMinor;
      const newToBalance = toWallet.balanceMinor + amountMinor;

      // Update both wallets atomically
      await Promise.all([
        this.db.collections.wallets.updateOne(
          { walletId: fromWalletId },
          {
            $set: {
              balanceMinor: newFromBalance,
              updatedAt: now,
            },
          }
        ),
        this.db.collections.wallets.updateOne(
          { walletId: toWalletId },
          {
            $set: {
              balanceMinor: newToBalance,
              updatedAt: now,
            },
          }
        ),
      ]);

      return {
        success: true,
        fromBalance: newFromBalance,
        toBalance: newToBalance,
      };
    });
  }

  /**
   * Get wallet balance in both minor units and NP
   */
  async getBalance(walletId: string): Promise<{
    balanceMinor: number;
    balanceNP: number;
    formatted: string;
  } | null> {
    const wallet = await this.getWalletById(walletId);
    if (!wallet) return null;

    return {
      balanceMinor: wallet.balanceMinor,
      balanceNP: NandaPoints.fromMinor(wallet.balanceMinor),
      formatted: NandaPoints.format(wallet.balanceMinor),
    };
  }

  /**
   * List all wallets with pagination
   */
  async listWallets(limit = 20, offset = 0): Promise<{
    wallets: Wallet[];
    total: number;
  }> {
    const [wallets, total] = await Promise.all([
      this.db.collections.wallets
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .toArray(),
      this.db.collections.wallets.countDocuments({}),
    ]);

    return { wallets, total };
  }

  /**
   * Get network statistics for all wallets
   */
  async getNetworkStats(): Promise<{
    totalWallets: number;
    totalBalance: number; // In minor units
    totalBalanceNP: number;
    averageBalance: number; // In minor units
    activeWallets: number; // Wallets with balance > 0
  }> {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalWallets: { $sum: 1 },
          totalBalance: { $sum: '$balanceMinor' },
          averageBalance: { $avg: '$balanceMinor' },
          activeWallets: {
            $sum: { $cond: [{ $gt: ['$balanceMinor', 0] }, 1, 0] }
          },
        },
      },
    ];

    const result = await this.db.collections.wallets.aggregate(pipeline).toArray();
    const stats = result[0];

    if (!stats) {
      return {
        totalWallets: 0,
        totalBalance: 0,
        totalBalanceNP: 0,
        averageBalance: 0,
        activeWallets: 0,
      };
    }

    return {
      totalWallets: stats.totalWallets,
      totalBalance: stats.totalBalance,
      totalBalanceNP: NandaPoints.fromMinor(stats.totalBalance),
      averageBalance: Math.round(stats.averageBalance || 0),
      activeWallets: stats.activeWallets,
    };
  }
}