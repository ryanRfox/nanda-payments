/**
 * NANDA x402 Middleware for Hono
 *
 * Custom middleware for NANDA Points payment integration.
 * Handles payment verification and settlement automatically.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { NandaClient } from '../client.js';

export interface NandaRouteConfig {
  /** Price in NANDA Points (e.g., 100.00) */
  price: number;
  /** Resource description */
  description?: string;
  /** MIME type (default: application/json) */
  mimeType?: string;
  /** Timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number;
}

export interface NandaPaymentMiddlewareOptions {
  /** NANDA Facilitator URL (default: http://localhost:3000) */
  facilitatorUrl?: string;
  /** Recipient wallet ID (UUID) */
  payTo: string;
  /** Route configurations: path -> config */
  routes: Record<string, NandaRouteConfig>;
}

/**
 * Create NANDA payment middleware for Hono
 *
 * @example
 * ```typescript
 * import { nandaPaymentMiddleware } from '@nanda/sdk';
 *
 * app.use(nandaPaymentMiddleware({
 *   facilitatorUrl: 'http://localhost:3000',
 *   payTo: 'service-wallet-uuid',
 *   routes: {
 *     '/alerts': { price: 100, description: 'Severe weather alerts' },
 *     '/premium': { price: 50, description: 'Premium content' },
 *   }
 * }));
 * ```
 */
export function nandaPaymentMiddleware(
  options: NandaPaymentMiddlewareOptions
): MiddlewareHandler {
  const facilitatorUrl = options.facilitatorUrl || 'http://localhost:3000';
  const client = new NandaClient({ facilitatorUrl });

  return async (c: Context, next: Next) => {
    const path = new URL(c.req.url).pathname;
    const routeConfig = options.routes[path];

    // Not a protected route - skip payment
    if (!routeConfig) {
      return next();
    }

    const paymentHeader = c.req.header('x-payment');

    // Convert price to minor units (100 NP = 10000 minor units)
    const amountMinor = Math.round(routeConfig.price * 100);

    // No payment provided - return 402 Payment Required
    if (!paymentHeader) {
      return c.json(
        {
          error: 'Payment Required',
          message: `This endpoint requires ${routeConfig.price.toFixed(2)} NP to access`,
          x402: {
            facilitatorUrl,
            paymentRequirements: {
              scheme: 'exact',
              network: 'nanda-points',
              payTo: options.payTo,
              maxAmountRequired: amountMinor,
              resource: c.req.url,
              description: routeConfig.description || `Access to ${path}`,
              mimeType: routeConfig.mimeType || 'application/json',
              maxTimeoutSeconds: routeConfig.maxTimeoutSeconds || 300,
              asset: 'NP',
            },
          },
        },
        402
      );
    }

    // Payment provided - verify and settle
    try {
      const payment = JSON.parse(paymentHeader);

      // Verify payment
      const verification = await client.verifyPayment({
        paymentPayload: payment.paymentPayload,
        paymentRequirements: {
          scheme: 'exact',
          network: 'nanda-points',
          payTo: options.payTo,
          maxAmountRequired: amountMinor,
          resource: c.req.url,
          description: routeConfig.description || `Access to ${path}`,
          mimeType: routeConfig.mimeType || 'application/json',
          maxTimeoutSeconds: routeConfig.maxTimeoutSeconds || 300,
          asset: 'NP',
        },
      });

      if (!verification.valid) {
        return c.json(
          {
            error: 'Payment verification failed',
            reason: verification.reason,
          },
          402
        );
      }

      // Settle payment
      const settlement = await client.settlePayment({
        sessionId: verification.sessionId!,
        paymentPayload: payment.paymentPayload,
      });

      if (!settlement.settled) {
        return c.json(
          {
            error: 'Payment settlement failed',
            reason: settlement.reason,
          },
          402
        );
      }

      // Store payment info in context for the route handler
      c.set('payment', {
        transactionId: settlement.transactionId,
        amount: amountMinor,
        amountFormatted: `${routeConfig.price.toFixed(2)} NP`,
      });

      // Payment successful - proceed to route handler
      return next();
    } catch (error) {
      console.error('Payment processing error:', error);
      return c.json(
        {
          error: 'Payment processing failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  };
}
