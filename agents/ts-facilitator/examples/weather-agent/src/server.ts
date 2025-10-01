/**
 * Weather Agent Example
 *
 * Demonstrates x402 payment integration with:
 * - Free endpoint: /forecast (no payment required)
 * - Paid endpoint: /alerts (100 NP = 10000 minor units)
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:3000';
const AGENT_WALLET_ID = 'ac29a924-b17c-44b7-b94f-9d14db21e1b1'; // weather-agent wallet from MongoDB

// Alert cost: 100 NP = 10000 minor units
const ALERT_COST = 10000;

// Enable CORS
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'weather-agent',
    version: '1.0.0',
    endpoints: {
      forecast: { path: '/forecast', cost: 'free' },
      alerts: { path: '/alerts', cost: '100.00 NP' },
    },
  });
});

// Free endpoint: Get weather forecast
app.get('/forecast', (c) => {
  const location = c.req.query('location') || 'San Francisco';

  return c.json({
    location,
    forecast: {
      today: {
        temperature: 72,
        conditions: 'Partly Cloudy',
        humidity: 65,
        windSpeed: 10,
      },
      tomorrow: {
        temperature: 68,
        conditions: 'Sunny',
        humidity: 60,
        windSpeed: 8,
      },
      threeDay: {
        temperature: 70,
        conditions: 'Clear',
        humidity: 55,
        windSpeed: 12,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Paid endpoint: Get severe weather alerts (requires 100 NP payment)
app.get('/alerts', async (c) => {
  const paymentHeader = c.req.header('x-payment');
  const location = c.req.query('location') || 'San Francisco';

  // No payment provided - return 402 Payment Required
  if (!paymentHeader) {
    return c.json(
      {
        error: 'Payment Required',
        message: 'This endpoint requires payment to access severe weather alerts',
        x402: {
          facilitatorUrl: FACILITATOR_URL,
          paymentRequirements: {
            scheme: 'exact',
            network: 'nanda-points',
            payTo: AGENT_WALLET_ID,
            maxAmountRequired: ALERT_COST,
            resource: `http://localhost:${PORT}/alerts?location=${location}`,
            description: `Severe weather alerts for ${location}`,
            mimeType: 'application/json',
            maxTimeoutSeconds: 300,
            asset: 'NP',
          },
        },
      },
      402
    );
  }

  // Payment provided - verify it
  try {
    const payment = JSON.parse(paymentHeader);

    // Verify payment with facilitator
    const verifyResponse = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: payment.paymentPayload,
        paymentRequirements: {
          scheme: 'exact',
          network: 'nanda-points',
          payTo: AGENT_WALLET_ID,
          maxAmountRequired: ALERT_COST,
          resource: `http://localhost:${PORT}/alerts?location=${location}`,
          description: `Severe weather alerts for ${location}`,
          mimeType: 'application/json',
          maxTimeoutSeconds: 300,
          asset: 'NP',
        },
      }),
    });

    const verification = await verifyResponse.json();

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
    const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: verification.sessionId,
        paymentPayload: payment.paymentPayload,
      }),
    });

    const settlement = await settleResponse.json();

    if (!settlement.settled) {
      return c.json(
        {
          error: 'Payment settlement failed',
          reason: settlement.reason,
        },
        402
      );
    }

    // Payment successful - return severe weather alerts
    return c.json({
      location,
      alerts: [
        {
          id: 'alert-001',
          type: 'Severe Thunderstorm Warning',
          severity: 'severe',
          headline: 'Severe Thunderstorm Warning issued for San Francisco County',
          description:
            'A severe thunderstorm capable of producing damaging winds up to 70 mph and quarter-size hail is expected. Take shelter immediately.',
          onset: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          expires: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
          urgency: 'immediate',
          certainty: 'likely',
        },
        {
          id: 'alert-002',
          type: 'Flash Flood Watch',
          severity: 'moderate',
          headline: 'Flash Flood Watch in effect for coastal areas',
          description:
            'Heavy rainfall expected. Low-lying areas and areas near streams may experience flooding.',
          onset: new Date(Date.now() + 7200000).toISOString(),
          expires: new Date(Date.now() + 21600000).toISOString(),
          urgency: 'expected',
          certainty: 'possible',
        },
      ],
      payment: {
        transactionId: settlement.transactionId,
        amount: ALERT_COST,
        amountFormatted: '100.00 NP',
      },
      timestamp: new Date().toISOString(),
    });
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
});

// Start server
console.log('🌤️  Starting Weather Agent...');
console.log(`📍 Port: ${PORT}`);
console.log(`💰 Facilitator: ${FACILITATOR_URL}`);
console.log(`👛 Wallet ID: ${AGENT_WALLET_ID}`);
console.log('');
console.log('📋 Endpoints:');
console.log(`  • GET /health - Health check`);
console.log(`  • GET /forecast?location=<city> - Free weather forecast`);
console.log(`  • GET /alerts?location=<city> - Severe weather alerts (100 NP)`);
console.log('');

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`✅ Weather Agent ready at http://localhost:${PORT}`);
