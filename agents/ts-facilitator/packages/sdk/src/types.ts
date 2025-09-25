import { z } from 'zod';

/**
 * SDK Configuration
 */
export interface NandaSDKConfig {
  facilitatorUrl: string;
  apiKey?: string;
  timeout?: number; // Request timeout in milliseconds
}

/**
 * Agent Balance Response
 */
export const AgentBalanceResponseSchema = z.object({
  agent_name: z.string(),
  walletId: z.string(),
  balance: z.object({
    balanceMinor: z.number(),
    balanceNP: z.number(),
    formatted: z.string(),
  }),
});

export type AgentBalanceResponse = z.infer<typeof AgentBalanceResponseSchema>;

/**
 * Transaction Response
 */
export const TransactionResponseSchema = z.object({
  id: z.string(),
  fromWallet: z.string(),
  toWallet: z.string(),
  amount: z.number(),
  currency: z.string(),
  type: z.enum(['payment', 'settlement', 'refund']),
  status: z.enum(['pending', 'completed', 'failed']),
  createdAt: z.string(),
  settledAt: z.string().optional(),
  error: z.string().optional(),
  metadata: z.object({
    agent_from: z.string(),
    agent_to: z.string(),
    description: z.string().optional(),
    tool_name: z.string().optional(),
    session_id: z.string().optional(),
  }),
});

export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;

/**
 * Payment Session Response
 */
export const PaymentSessionResponseSchema = z.object({
  sessionId: z.string(),
  fromAgent: z.string(),
  toAgent: z.string(),
  amount: z.number(),
  currency: z.literal('NP'),
  status: z.enum(['pending', 'verified', 'settled', 'expired']),
  resource: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  settledAt: z.string().optional(),
});

export type PaymentSessionResponse = z.infer<typeof PaymentSessionResponseSchema>;

/**
 * Network Statistics (matches facilitator API structure)
 */
export const NetworkStatsResponseSchema = z.object({
  wallets: z.object({
    totalWallets: z.number(),
    activeWallets: z.number(),
    totalBalance: z.number(),
    totalBalanceFormatted: z.string(),
    averageBalance: z.number(),
  }),
  agents: z.object({
    totalAgents: z.number(),
    activeAgents: z.number(),
    averageServiceCharge: z.number(),
    topAgentsByServiceCharge: z.array(z.object({
      agent_name: z.string(),
      serviceCharge: z.number(),
    })),
  }),
  transactions: z.object({
    totalTransactions: z.number(),
    totalVolume: z.number(),
    totalVolumeFormatted: z.string(),
    pendingTransactions: z.number(),
    completedTransactions: z.number(),
    failedTransactions: z.number(),
    averageTransactionValue: z.number(),
  }),
  timestamp: z.string(),
});

export type NetworkStatsResponse = z.infer<typeof NetworkStatsResponseSchema>;

/**
 * SDK Error Types
 */
export class NandaSDKError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'NandaSDKError';
  }
}

/**
 * Payment creation input
 */
export interface CreatePaymentInput {
  fromAgent: string;
  toAgent: string;
  amount: number; // Amount in NP (will be converted to minor units)
  resource: string; // Resource being paid for
  description?: string;
}

/**
 * Verify payment input
 */
export interface VerifyPaymentInput {
  paymentPayload: unknown; // x402 payment payload
  paymentRequirements: unknown; // x402 payment requirements
}

/**
 * Settle payment input
 */
export interface SettlePaymentInput {
  sessionId: string;
  paymentPayload: unknown; // x402 payment payload
}