/**
 * Weather Agent Example - Using @nanda/sdk Middleware
 *
 * Demonstrates clean x402 integration using NANDA middleware:
 * - Free endpoint: /forecast (no payment required)
 * - Paid endpoint: /alerts (100 NP)
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { nandaPaymentMiddleware } from '@nanda/sdk';

const app = new Hono();

// Configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:3000';
const AGENT_WALLET_ID = process.env.AGENT_WALLET_ID || 'ac29a924-b17c-44b7-b94f-9d14db21e1b1';

// Enable CORS
app.use('/*', cors());

// Apply NANDA payment middleware (powered by x402-hono)
app.use(
  nandaPaymentMiddleware({
    facilitatorUrl: FACILITATOR_URL,
    payTo: AGENT_WALLET_ID,
    routes: {
      '/alerts': {
        price: 100, // 100.00 NP
        description: 'Severe weather alerts',
      },
    },
  })
);

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

// Paid endpoint: Get severe weather alerts
// Payment is automatically handled by middleware!
app.get('/alerts', (c) => {
  const location = c.req.query('location') || 'San Francisco';

  // Get payment info from middleware
  const payment = c.get('payment');

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
        onset: new Date(Date.now() + 3600000).toISOString(),
        expires: new Date(Date.now() + 7200000).toISOString(),
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
    payment,
    timestamp: new Date().toISOString(),
  });
});

// Start server
console.log('🌤️  Starting Weather Agent with NANDA Middleware...');
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
