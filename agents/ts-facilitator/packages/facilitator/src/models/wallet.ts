import { z } from 'zod';

/**
 * Wallet Model
 *
 * Manages NANDA Points (NP) balances for agents.
 * Uses minor units for precise decimal handling (1 NP = 100 minor units).
 */

export const WalletSchema = z.object({
  walletId: z.string().uuid(),
  agent_name: z.string().min(1).max(100),
  currency: z.literal('NP'),
  scale: z.literal(2), // 2 decimal places
  balanceMinor: z.number().int().min(0), // Balance in minor units
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Wallet = z.infer<typeof WalletSchema>;

/**
 * Wallet creation input
 */
export const CreateWalletSchema = WalletSchema.omit({
  walletId: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateWalletInput = z.infer<typeof CreateWalletSchema>;

/**
 * Wallet balance update input
 */
export const UpdateWalletBalanceSchema = z.object({
  walletId: z.string().uuid(),
  balanceMinor: z.number().int().min(0),
});

export type UpdateWalletBalanceInput = z.infer<typeof UpdateWalletBalanceSchema>;

/**
 * Utility functions for NANDA Points conversion
 */
export class NandaPoints {
  private static readonly SCALE = 2;
  private static readonly MULTIPLIER = Math.pow(10, NandaPoints.SCALE);

  /**
   * Convert NP (major units) to minor units
   * Example: 10.50 NP -> 1050 minor units
   */
  static toMinor(np: number): number {
    return Math.round(np * NandaPoints.MULTIPLIER);
  }

  /**
   * Convert minor units to NP (major units)
   * Example: 1050 minor units -> 10.50 NP
   */
  static fromMinor(minor: number): number {
    return minor / NandaPoints.MULTIPLIER;
  }

  /**
   * Format NP amount for display
   * Example: 1050 minor units -> "10.50 NP"
   */
  static format(minor: number): string {
    const np = NandaPoints.fromMinor(minor);
    return `${np.toFixed(NandaPoints.SCALE)} NP`;
  }

  /**
   * Parse NP amount from string
   * Example: "10.50 NP" -> 1050 minor units
   * Example: "10.5" -> 1050 minor units
   * Example: "10" -> 1000 minor units
   */
  static parse(npString: string): number {
    // Remove "NP" suffix if present and trim whitespace
    const cleanString = npString.replace(/\s*NP\s*$/i, '').trim();
    const np = parseFloat(cleanString);

    if (isNaN(np) || np < 0) {
      throw new Error(`Invalid NP amount: ${npString}`);
    }

    return NandaPoints.toMinor(np);
  }

  /**
   * Validate that an amount is valid for transactions
   */
  static isValidAmount(minor: number): boolean {
    return Number.isInteger(minor) && minor >= 0;
  }
}