#!/usr/bin/env node

/**
 * NANDA Facilitator Server
 *
 * x402 payment facilitator following:
 * - Cloudflare patterns: Hono app export
 * - Coinbase patterns: Simple verify/settle functions
 * - MongoDB for NANDA Points ledger interface
 * - Node.js native HTTP server for runtime
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// Configuration and models
import { loadConfig } from './models/config.js';

// Services
import { DatabaseService } from './services/database.js';
import { WalletService } from './services/wallet-service.js';
import { AgentService } from './services/agent-service.js';
import { TransactionService } from './services/transaction-service.js';
import { PaymentSessionService } from './services/payment-session-service.js';

// Routes
import { createFacilitatorRoutes } from './routes/facilitator.js';
import { createExplorerRoutes } from './routes/explorer.js';
import { createHealthRoutes } from './routes/health.js';

/**
 * Application state
 */
interface AppState {
  config: ReturnType<typeof loadConfig>;
  db: DatabaseService;
  walletService: WalletService;
  agentService: AgentService;
  transactionService: TransactionService;
  paymentSessionService: PaymentSessionService;
}

/**
 * Initialize services
 */
async function initializeServices(): Promise<AppState> {
  console.log('🚀 Initializing NANDA Facilitator...');

  // Load configuration
  const config = loadConfig();
  console.log(`📋 Configuration loaded for ${config.nodeEnv} environment`);

  // Initialize database
  const db = new DatabaseService(config);
  await db.connect();

  // Initialize services
  const walletService = new WalletService(db);
  const agentService = new AgentService(db, walletService, config);
  const transactionService = new TransactionService(db, walletService);
  const paymentSessionService = new PaymentSessionService(db, walletService, transactionService, config);

  console.log('✅ All services initialized');

  return {
    config,
    db,
    walletService,
    agentService,
    transactionService,
    paymentSessionService,
  };
}

/**
 * Create pure Hono application following Cloudflare patterns
 * Exports app directly like Cloudflare x402 reference
 */
export function createApp(services: AppState): Hono {
  const app = new Hono();

  // Middleware (Cloudflare pattern - minimal, focused)
  app.use('*', logger());
  app.use('*', cors({
    origin: services.config.server.cors.origins,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Payment', 'X-PAYMENT', 'X-Payment-Response', 'X-PAYMENT-RESPONSE'],
  }));
  app.use('*', prettyJSON());

  // Mount routes directly (simpler pattern)
  const healthRoutes = createHealthRoutes(services.db, services.paymentSessionService);
  const facilitatorRoutes = createFacilitatorRoutes(services.paymentSessionService);
  const explorerRoutes = createExplorerRoutes(
    services.transactionService,
    services.walletService,
    services.agentService
  );

  // Apply routes
  app.route('/', healthRoutes);
  app.route('/', facilitatorRoutes);
  app.route('/', explorerRoutes);

  // Simple 404 handler
  app.notFound((c) => c.json({
    error: 'Not Found',
    endpoints: {
      core: ['/verify', '/settle'],
      explorer: ['/api/v1/stats', '/api/v1/agents/:name/balance'],
      health: ['/health', '/ready'],
    },
  }, 404));

  // Simple error handler
  app.onError((err, c) => {
    console.error('Error:', err);
    return c.json({
      error: 'Internal Server Error',
      message: services.config.nodeEnv === 'development' ? err.message : undefined,
    }, 500);
  });

  return app;
}

/**
 * Setup graceful shutdown
 */
function setupGracefulShutdown(services: AppState) {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

    try {
      // Simple shutdown - close database connection
      await services.db.disconnect();

      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
}

/**
 * Main server startup
 */
async function main() {
  try {
    // Initialize services
    const services = await initializeServices();

    // Create Hono app
    const app = createApp(services);

    // Setup graceful shutdown
    setupGracefulShutdown(services);

    // Start server
    const { host, port } = services.config.server;

    console.log(`🌟 NANDA Facilitator starting on http://${host}:${port}`);
    console.log('📋 Core x402 endpoints:');
    console.log('  • POST /verify - Verify x402 payment');
    console.log('  • POST /settle - Settle verified payment');
    console.log('');
    console.log('🔍 Explorer endpoints:');
    console.log('  • GET /api/v1/stats - Network statistics');
    console.log('  • GET /api/v1/agents/:name/balance - Agent balance');
    console.log('');
    console.log('💰 NANDA Points - MongoDB ledger');
    console.log('');

    console.log(`✅ NANDA Facilitator ready at http://${host}:${port}`);
    console.log(`🔍 Block Explorer: http://${host}:${port}/api/v1/stats`);
    console.log(`❤️  Health Check: http://${host}:${port}/health`);

    // Use official Hono Node.js adapter (industry standard)
    // Proper Web Standards compliance with Node.js integration
    serve({
      fetch: app.fetch,
      port,
      hostname: host,
    }, () => {
      console.log(`🚀 Server listening on http://${host}:${port}`);
    });

  } catch (error) {
    console.error('❌ Failed to start NANDA Facilitator:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  });
}