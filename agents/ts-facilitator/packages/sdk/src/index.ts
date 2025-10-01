/**
 * @nanda/sdk - JavaScript client for NANDA Facilitator x402 payments
 *
 * Easy-to-use SDK for interacting with the NANDA payment network.
 * Provides high-level methods for payment verification, settlement,
 * balance queries, and transaction history.
 */

import { NandaClient } from './client.js';
import type { NandaSDKConfig } from './types.js';

export { NandaClient } from './client.js';

export {
  type NandaSDKConfig,
  type AgentBalanceResponse,
  type TransactionResponse,
  type PaymentSessionResponse,
  type NetworkStatsResponse,
  type CreatePaymentInput,
  type VerifyPaymentInput,
  type SettlePaymentInput,
  NandaSDKError,
} from './types.js';

// Middleware exports
export {
  nandaPaymentMiddleware,
  type NandaPaymentMiddlewareOptions,
  type NandaRouteConfig,
} from './middleware/hono.js';

/**
 * Create a new NANDA client instance
 */
export function createNandaClient(config: NandaSDKConfig): NandaClient {
  return new NandaClient(config);
}

/**
 * Default export for convenience
 */
export default NandaClient;