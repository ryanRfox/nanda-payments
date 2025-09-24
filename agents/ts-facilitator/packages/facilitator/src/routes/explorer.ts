import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { TransactionService } from '../services/transaction-service.js';
import type { WalletService } from '../services/wallet-service.js';
import type { AgentService } from '../services/agent-service.js';
import { NandaPoints } from '../models/wallet.js';

/**
 * Block Explorer Routes
 *
 * Public APIs for transaction visibility and network statistics.
 * All endpoints are free and rate-limited.
 */

// Query parameter schemas
const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const TransactionQuerySchema = z.object({
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  type: z.enum(['payment', 'settlement', 'refund']).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
}).merge(PaginationSchema);

const AgentNameSchema = z.object({
  agentName: z.string().min(1).max(100),
});

export function createExplorerRoutes(
  transactionService: TransactionService,
  walletService: WalletService,
  agentService: AgentService
) {
  const app = new Hono();

  /**
   * GET /api/v1/transactions
   * List recent transactions with pagination and filtering
   */
  app.get(
    '/api/v1/transactions',
    zValidator('query', TransactionQuerySchema),
    async (c) => {
      try {
        const query = c.req.valid('query');
        const { page, limit, ...filters } = query;
        const offset = (page - 1) * limit;

        const result = await transactionService.queryTransactions({
          ...filters,
          limit,
          offset,
        });

        return c.json({
          transactions: result.transactions.map(tx => ({
            ...tx,
            // Convert amount to display format
            amountNP: NandaPoints.fromMinor(tx.amount),
            amountFormatted: NandaPoints.format(tx.amount),
          })),
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
          summary: result.summary,
        });
      } catch (error) {
        console.error('Transactions query error:', error);
        return c.json({ error: 'Failed to fetch transactions' }, 500);
      }
    }
  );

  /**
   * GET /api/v1/transactions/:txId
   * Get transaction details by ID
   */
  app.get('/api/v1/transactions/:txId', async (c) => {
    try {
      const txId = c.req.param('txId');
      const transaction = await transactionService.getTransactionById(txId);

      if (!transaction) {
        return c.json({ error: 'Transaction not found' }, 404);
      }

      return c.json({
        ...transaction,
        amountNP: NandaPoints.fromMinor(transaction.amount),
        amountFormatted: NandaPoints.format(transaction.amount),
      });
    } catch (error) {
      console.error('Transaction fetch error:', error);
      return c.json({ error: 'Failed to fetch transaction' }, 500);
    }
  });

  /**
   * GET /api/v1/agents/:agentName/balance
   * Get agent's current balance
   */
  app.get(
    '/api/v1/agents/:agentName/balance',
    zValidator('param', AgentNameSchema),
    async (c) => {
      try {
        const { agentName } = c.req.valid('param');

        const agentWithWallet = await agentService.getAgentWithWallet(agentName);
        if (!agentWithWallet) {
          return c.json({ error: 'Agent not found' }, 404);
        }

        return c.json({
          agent_name: agentName,
          balance: agentWithWallet.wallet.balanceNP,
          balanceMinor: agentWithWallet.wallet.balanceMinor,
          balanceFormatted: agentWithWallet.wallet.formatted,
          currency: 'NP',
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Balance fetch error:', error);
        return c.json({ error: 'Failed to fetch balance' }, 500);
      }
    }
  );

  /**
   * GET /api/v1/agents/:agentName/history
   * Get agent's transaction history
   */
  app.get(
    '/api/v1/agents/:agentName/history',
    zValidator('param', AgentNameSchema),
    zValidator('query', PaginationSchema),
    async (c) => {
      try {
        const { agentName } = c.req.valid('param');
        const { page, limit } = c.req.valid('query');
        const offset = (page - 1) * limit;

        const result = await transactionService.getAgentTransactionHistory(
          agentName,
          limit,
          offset
        );

        return c.json({
          agent_name: agentName,
          transactions: result.transactions.map(tx => ({
            ...tx,
            amountNP: NandaPoints.fromMinor(tx.amount),
            amountFormatted: NandaPoints.format(tx.amount),
          })),
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        });
      } catch (error) {
        console.error('Agent history fetch error:', error);
        return c.json({ error: 'Failed to fetch transaction history' }, 500);
      }
    }
  );

  /**
   * GET /api/v1/stats
   * Get network statistics
   */
  app.get('/api/v1/stats', async (c) => {
    try {
      const [walletStats, agentStats, transactionSummary] = await Promise.all([
        walletService.getNetworkStats(),
        agentService.getAgentStats(),
        transactionService.getTransactionSummary(),
      ]);

      return c.json({
        wallets: {
          totalWallets: walletStats.totalWallets,
          activeWallets: walletStats.activeWallets,
          totalBalance: walletStats.totalBalanceNP,
          totalBalanceFormatted: NandaPoints.format(walletStats.totalBalance),
          averageBalance: NandaPoints.fromMinor(walletStats.averageBalance),
        },
        agents: {
          totalAgents: agentStats.totalAgents,
          activeAgents: agentStats.activeAgents,
          averageServiceCharge: agentStats.averageServiceCharge,
          topAgentsByServiceCharge: agentStats.topAgentsByServiceCharge,
        },
        transactions: {
          totalTransactions: transactionSummary.totalTransactions,
          totalVolume: NandaPoints.fromMinor(transactionSummary.totalVolume),
          totalVolumeFormatted: NandaPoints.format(transactionSummary.totalVolume),
          pendingTransactions: transactionSummary.pendingTransactions,
          completedTransactions: transactionSummary.completedTransactions,
          failedTransactions: transactionSummary.failedTransactions,
          averageTransactionValue: NandaPoints.fromMinor(transactionSummary.averageAmount),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Stats fetch error:', error);
      return c.json({ error: 'Failed to fetch network statistics' }, 500);
    }
  });

  return app;
}