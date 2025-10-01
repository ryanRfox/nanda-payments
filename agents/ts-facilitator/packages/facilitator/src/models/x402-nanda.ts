/**
 * NANDA-specific x402 Protocol Schemas
 *
 * Extends the x402 protocol to support NANDA Points as a custom network,
 * while maintaining compatibility with the standard x402 structure.
 */

import { z } from 'zod';

/**
 * NANDA Points network identifier
 */
export const NANDA_NETWORK = 'nanda-points' as const;

/**
 * Extended network schema that includes NANDA Points
 */
export const NandaNetworkSchema = z.enum([
  'base-sepolia',
  'base',
  'avalanche-fuji',
  'avalanche',
  'iotex',
  'solana-devnet',
  'solana',
  'sei',
  'sei-testnet',
  'nanda-points', // Our custom network
]);

export type NandaNetwork = z.infer<typeof NandaNetworkSchema>;

/**
 * NANDA Points payload for x402 payments
 * Contains wallet IDs and amounts in minor units (uInt)
 *
 * Amount Format:
 * - ALWAYS in minor units (unsigned integer)
 * - Scale: 2 decimal places (precision = 2)
 * - Example: amount = 100 represents 1.00 NP in display
 * - Example: amount = 1 represents 0.01 NP in display
 * - No negative values allowed (uInt validation)
 */
export const NandaPayloadSchema = z.object({
  from: z.string().uuid('Source wallet ID must be a valid UUID'),
  to: z.string().uuid('Destination wallet ID must be a valid UUID'),
  amount: z.number().int().nonnegative('Amount must be a non-negative integer in minor units'),
  description: z.string().optional(),
});

export type NandaPayload = z.infer<typeof NandaPayloadSchema>;

/**
 * x402-compliant payment payload for NANDA Points
 */
export const NandaPaymentPayloadSchema = z.object({
  x402Version: z.literal(1),
  scheme: z.literal('exact'),
  network: z.literal(NANDA_NETWORK),
  payload: NandaPayloadSchema,
});

export type NandaPaymentPayload = z.infer<typeof NandaPaymentPayloadSchema>;

/**
 * x402-compliant payment requirements for NANDA Points
 *
 * Maximum Amount Format:
 * - ALWAYS in minor units (unsigned integer)
 * - Scale: 2 decimal places (precision = 2)
 * - Example: maxAmountRequired = 100 means max 1.00 NP
 * - Example: maxAmountRequired = 1 means max 0.01 NP
 */
export const NandaPaymentRequirementsSchema = z.object({
  scheme: z.literal('exact'),
  network: z.literal(NANDA_NETWORK),
  maxAmountRequired: z.number().int().nonnegative('Max amount must be a non-negative integer in minor units'),
  resource: z.string().url('Resource must be a valid URL'),
  description: z.string().min(1, 'Description is required'),
  mimeType: z.string().default('application/json'),
  maxTimeoutSeconds: z.number().positive().default(300),
  payTo: z.string().uuid('PayTo must be a valid wallet UUID'),
  asset: z.literal('NP'), // NANDA Points identifier
});

export type NandaPaymentRequirements = z.infer<typeof NandaPaymentRequirementsSchema>;

/**
 * Complete x402 verify request for NANDA Points
 */
export const NandaVerifyRequestSchema = z.object({
  paymentPayload: NandaPaymentPayloadSchema,
  paymentRequirements: NandaPaymentRequirementsSchema,
});

export type NandaVerifyRequest = z.infer<typeof NandaVerifyRequestSchema>;

/**
 * x402 verify response
 */
export const NandaVerifyResponseSchema = z.object({
  valid: z.boolean(),
  sessionId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

export type NandaVerifyResponse = z.infer<typeof NandaVerifyResponseSchema>;

/**
 * Complete x402 settle request for NANDA Points
 */
export const NandaSettleRequestSchema = z.object({
  sessionId: z.string().uuid(),
  paymentPayload: NandaPaymentPayloadSchema,
});

export type NandaSettleRequest = z.infer<typeof NandaSettleRequestSchema>;

/**
 * x402 settle response
 */
export const NandaSettleResponseSchema = z.object({
  settled: z.boolean(),
  transactionId: z.string().uuid().optional(),
  balance: z.object({
    from: z.number().nonnegative(),
    to: z.number().nonnegative(),
  }).optional(),
  reason: z.string().optional(),
});

export type NandaSettleResponse = z.infer<typeof NandaSettleResponseSchema>;

/**
 * Utility functions for NANDA Points x402 integration
 */
export class NandaX402Utils {
  /**
   * Create a valid x402 payment payload for NANDA Points
   *
   * @param from Source wallet UUID
   * @param to Destination wallet UUID
   * @param amount Amount in minor units (uInt) - e.g., 100 = 1.00 NP
   */
  static createPaymentPayload(from: string, to: string, amount: number): NandaPaymentPayload {
    return {
      x402Version: 1,
      scheme: 'exact',
      network: NANDA_NETWORK,
      payload: {
        from,
        to,
        amount,
      },
    };
  }

  /**
   * Create valid x402 payment requirements for NANDA Points
   *
   * @param maxAmountRequired Maximum amount in minor units (uInt) - e.g., 100 = max 1.00 NP
   * @param resource Service resource URL
   * @param description Human-readable description
   * @param payTo Destination wallet UUID
   * @param options Additional configuration options
   */
  static createPaymentRequirements(
    maxAmountRequired: number,
    resource: string,
    description: string,
    payTo: string,
    options: {
      mimeType?: string;
      maxTimeoutSeconds?: number;
    } = {}
  ): NandaPaymentRequirements {
    return {
      scheme: 'exact',
      network: NANDA_NETWORK,
      maxAmountRequired,
      resource,
      description,
      mimeType: options.mimeType || 'application/json',
      maxTimeoutSeconds: options.maxTimeoutSeconds || 300,
      payTo,
      asset: 'NP',
    };
  }

  /**
   * Validate x402 payment payload for NANDA Points
   */
  static validatePaymentPayload(payload: unknown): NandaPaymentPayload {
    return NandaPaymentPayloadSchema.parse(payload);
  }

  /**
   * Validate x402 payment requirements for NANDA Points
   */
  static validatePaymentRequirements(requirements: unknown): NandaPaymentRequirements {
    return NandaPaymentRequirementsSchema.parse(requirements);
  }

  /**
   * Check if a payment payload is for NANDA Points network
   */
  static isNandaPayload(payload: unknown): payload is NandaPaymentPayload {
    try {
      const parsed = NandaPaymentPayloadSchema.parse(payload);
      return parsed.network === NANDA_NETWORK;
    } catch {
      return false;
    }
  }

  /**
   * Check if payment requirements are for NANDA Points network
   */
  static isNandaRequirements(requirements: unknown): requirements is NandaPaymentRequirements {
    try {
      const parsed = NandaPaymentRequirementsSchema.parse(requirements);
      return parsed.network === NANDA_NETWORK;
    } catch {
      return false;
    }
  }

  /**
   * Extract wallet IDs and amount from x402 NANDA payload
   */
  static extractWalletIds(payload: NandaPaymentPayload): {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
  } {
    return {
      fromWalletId: payload.payload.from,
      toWalletId: payload.payload.to,
      amount: payload.payload.amount,
    };
  }

  /**
   * Convert major units (display amount) to minor units (storage amount)
   * @param majorAmount Amount in NP (e.g., 1.50)
   * @returns Amount in minor units (e.g., 150)
   */
  static toMinorUnits(majorAmount: number): number {
    return Math.round(majorAmount * 100);
  }

  /**
   * Convert minor units (storage amount) to major units (display amount)
   * @param minorAmount Amount in minor units (e.g., 150)
   * @returns Amount in NP (e.g., 1.50)
   */
  static toMajorUnits(minorAmount: number): number {
    return minorAmount / 100;
  }

  /**
   * Format minor units for display
   * @param minorAmount Amount in minor units
   * @returns Formatted string (e.g., "1.50 NP")
   */
  static formatAmount(minorAmount: number): string {
    return `${this.toMajorUnits(minorAmount).toFixed(2)} NP`;
  }
}