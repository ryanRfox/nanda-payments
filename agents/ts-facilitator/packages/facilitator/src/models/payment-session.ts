import { z } from 'zod';

/**
 * Payment Session Model
 *
 * Manages temporary state for x402 payment flows.
 * Sessions are created during /verify and consumed during /settle.
 */

export const PaymentSessionSchema = z.object({
  sessionId: z.string().uuid(),
  resourceServer: z.string(), // Expert agent identifier
  resource: z.string(), // Specific endpoint/tool
  amount: z.number().int().min(1), // Amount in minor units
  currency: z.literal('NP'),
  fromAgent: z.string(), // Requesting agent
  toAgent: z.string(), // Expert agent
  status: z.enum(['pending', 'verified', 'settled', 'expired']),

  // x402 Data
  paymentRequirements: z.any(), // x402.PaymentRequirements
  paymentPayload: z.any().optional(), // x402.PaymentPayload (set during verify)

  // Timestamps
  expiresAt: z.string(),
  createdAt: z.string(),
  verifiedAt: z.string().optional(),
  settledAt: z.string().optional(),
});

export type PaymentSession = z.infer<typeof PaymentSessionSchema>;

/**
 * Payment session creation input
 */
export const CreatePaymentSessionSchema = PaymentSessionSchema.omit({
  sessionId: true,
  createdAt: true,
  verifiedAt: true,
  settledAt: true,
});

export type CreatePaymentSessionInput = z.infer<typeof CreatePaymentSessionSchema>;

/**
 * Payment session update input
 */
export const UpdatePaymentSessionSchema = PaymentSessionSchema.partial().extend({
  sessionId: z.string().uuid(), // Required for identification
});

export type UpdatePaymentSessionInput = z.infer<typeof UpdatePaymentSessionSchema>;

/**
 * Verify request schema (x402 /verify endpoint)
 */
export const VerifyRequestSchema = z.object({
  paymentPayload: z.any(), // x402.PaymentPayload
  paymentRequirements: z.any(), // x402.PaymentRequirements
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

/**
 * Verify response schema
 */
export const VerifyResponseSchema = z.object({
  valid: z.boolean(),
  sessionId: z.string().uuid().optional(),
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;

/**
 * Settle request schema (x402 /settle endpoint)
 */
export const SettleRequestSchema = z.object({
  sessionId: z.string().uuid(),
  paymentPayload: z.any(), // x402.PaymentPayload
});

export type SettleRequest = z.infer<typeof SettleRequestSchema>;

/**
 * Settle response schema
 */
export const SettleResponseSchema = z.object({
  settled: z.boolean(),
  transactionId: z.string().uuid().optional(),
  reason: z.string().optional(),
  balance: z.object({
    from: z.number().int(),
    to: z.number().int(),
  }).optional(),
});

export type SettleResponse = z.infer<typeof SettleResponseSchema>;