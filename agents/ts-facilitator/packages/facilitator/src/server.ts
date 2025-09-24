#!/usr/bin/env node

/**
 * NANDA Facilitator Server
 *
 * High-performance x402 payment facilitator built with:
 * - Hono web framework for speed and TypeScript support
 * - MongoDB for NANDA Points storage and transaction history
 * - Comprehensive x402 protocol compliance
 * - Block explorer APIs for transaction visibility
 */

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
  const db = new DatabaseService(config.mongodb);
  await db.connect();

  // Initialize services
  const walletService = new WalletService(db);
  const agentService = new AgentService(db, walletService, config);
  const transactionService = new TransactionService(db, walletService);
  const paymentSessionService = new PaymentSessionService(db, config);

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
 * Create Hono application with all routes and middleware
 */
function createApp(services: AppState): Hono {
  const app = new Hono();

  // Global middleware
  app.use('*', logger());
  app.use('*', prettyJSON());
  app.use(
    '*',
    cors({
      origin: services.config.server.cors.origins,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Payment'],
    })
  );

  // Mount route groups
  app.route('/', createHealthRoutes(services.db, services.paymentSessionService));
  app.route('/', createFacilitatorRoutes(services.paymentSessionService));
  app.route('/', createExplorerRoutes(
    services.transactionService,
    services.walletService,
    services.agentService
  ));

  // 404 handler
  app.notFound((c) => {
    return c.json({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      endpoints: {
        facilitator: ['/verify', '/settle'],
        explorer: ['/api/v1/transactions', '/api/v1/agents/:name/balance', '/api/v1/stats'],
        health: ['/health', '/ready', '/metrics', '/version'],
      },
    }, 404);
  });

  // Global error handler
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({
      error: 'Internal Server Error',
      message: services.config.nodeEnv === 'development' ? err.message : 'An unexpected error occurred',
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
      // Cleanup expired payment sessions
      const cleanedSessions = await services.paymentSessionService.cleanupExpiredSessions();
      if (cleanedSessions > 0) {
        console.log(`🧹 Cleaned up ${cleanedSessions} expired sessions`);
      }

      // Close database connection
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
    console.log('📋 Available endpoints:');
    console.log('  • POST /verify - Verify x402 payment');
    console.log('  • POST /settle - Settle verified payment');
    console.log('  • GET /api/v1/transactions - List transactions');
    console.log('  • GET /api/v1/agents/:name/balance - Agent balance');
    console.log('  • GET /api/v1/stats - Network statistics');
    console.log('  • GET /health - Health check');
    console.log('  • GET /ready - Readiness probe');
    console.log('  • GET /metrics - Prometheus metrics');
    console.log('');
    console.log('💰 NANDA Points (NP) - MongoDB-backed payment system');
    console.log('🔗 x402 Protocol - HTTP-native payment verification');
    console.log('⚡ Hono Framework - High-performance TypeScript server');
    console.log('');

    // Start HTTP server
    const server = { port, fetch: app.fetch };

    console.log(`✅ NANDA Facilitator ready at http://${host}:${port}`);
    console.log(`🔍 Block Explorer: http://${host}:${port}/api/v1/stats`);
    console.log(`❤️  Health Check: http://${host}:${port}/health`);

    // Keep the process alive
    await new Promise(() => {});

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