import { z } from 'zod';

/**
 * Transaction Model
 *
 * Records all NANDA Points transfers between wallets.
 * Supports both immediate payments and x402 payment flows.
 */

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  transactionHash: z.string().optional(), // For future blockchain compatibility
  fromWallet: z.string().uuid(),
  toWallet: z.string().uuid(),
  amount: z.number().int().min(1), // Amount in minor units
  currency: z.literal('NP'),
  type: z.enum(['payment', 'settlement', 'refund']),
  status: z.enum(['pending', 'completed', 'failed']),

  // x402 Integration
  paymentPayload: z.any().optional(), // x402.PaymentPayload
  paymentRequirements: z.any().optional(), // x402.PaymentRequirements
  resource: z.string().optional(), // API endpoint being paid for

  // Metadata
  metadata: z.object({
    agent_from: z.string(),
    agent_to: z.string(),
    tool_name: z.string().optional(),
    session_id: z.string().optional(),
    description: z.string().optional(),
  }),

  // Timestamps
  createdAt: z.string(),
  settledAt: z.string().optional(),
  error: z.string().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

/**
 * Transaction creation input
 */
export const CreateTransactionSchema = TransactionSchema.omit({
  id: true,
  createdAt: true,
  settledAt: true,
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

/**
 * Transaction update input
 */
export const UpdateTransactionSchema = TransactionSchema.partial().extend({
  id: z.string().uuid(), // Required for identification
});

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

/**
 * Transaction query filters
 */
export const TransactionQuerySchema = z.object({
  agent_name: z.string().optional(),
  wallet_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  type: z.enum(['payment', 'settlement', 'refund']).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;

/**
 * Transaction summary for reporting
 */
export const TransactionSummarySchema = z.object({
  totalTransactions: z.number().int(),
  totalVolume: z.number().int(), // In minor units
  pendingTransactions: z.number().int(),
  completedTransactions: z.number().int(),
  failedTransactions: z.number().int(),
  averageAmount: z.number(),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
});

export type TransactionSummary = z.infer<typeof TransactionSummarySchema>;