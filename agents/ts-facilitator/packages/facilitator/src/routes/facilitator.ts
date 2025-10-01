import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  VerifyRequestSchema,
  SettleRequestSchema,
} from '../models/payment-session.js';
import type { PaymentSessionService } from '../services/payment-session-service.js';

/**
 * Core Facilitator Routes
 *
 * Implements the x402 facilitator endpoints:
 * - GET /supported - List supported payment kinds
 * - POST /verify - Verify payment payload against requirements
 * - POST /settle - Settle verified payment
 */
export function createFacilitatorRoutes(
  paymentSessionService: PaymentSessionService
) {
  const app = new Hono();

  /**
   * GET /supported
   * Returns supported payment kinds for x402 protocol discovery
   */
  app.get('/supported', (c) => {
    return c.json({
      supportedPaymentKinds: [
        {
          scheme: 'exact',
          network: 'nanda-points',
          version: 1,
        },
      ],
    });
  });

  /**
   * POST /verify
   * Verify payment payload against payment requirements
   */
  app.post(
    '/verify',
    zValidator('json', VerifyRequestSchema),
    async (c) => {
      try {
        const request = c.req.valid('json');
        const response = await paymentSessionService.verifyPayment(request);

        return c.json(response);
      } catch (error) {
        console.error('Verify endpoint error:', error);
        return c.json(
          {
            valid: false,
            reason: 'Internal server error during verification',
          },
          500
        );
      }
    }
  );

  /**
   * POST /settle
   * Settle a verified payment using session ID
   */
  app.post(
    '/settle',
    zValidator('json', SettleRequestSchema),
    async (c) => {
      try {
        const request = c.req.valid('json');
        const response = await paymentSessionService.settlePayment(request);

        return c.json(response);
      } catch (error) {
        console.error('Settle endpoint error:', error);
        return c.json(
          {
            settled: false,
            reason: 'Internal server error during settlement',
          },
          500
        );
      }
    }
  );

  return app;
}