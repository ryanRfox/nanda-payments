import { Hono } from 'hono';
import type { DatabaseService } from '../services/database.js';
import type { PaymentSessionService } from '../services/payment-session-service.js';

/**
 * Health and Monitoring Routes
 *
 * Service health checks and monitoring endpoints for observability.
 */
export function createHealthRoutes(
  db: DatabaseService,
  paymentSessionService: PaymentSessionService
) {
  const app = new Hono();

  /**
   * GET /health
   * Basic health check endpoint
   */
  app.get('/health', async (c) => {
    try {
      const dbHealth = await db.healthCheck();
      const timestamp = new Date().toISOString();

      const health = {
        status: 'healthy',
        timestamp,
        service: 'nanda-facilitator',
        version: '1.0.0',
        database: dbHealth,
      };

      return c.json(health);
    } catch (error) {
      console.error('Health check error:', error);
      return c.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'nanda-facilitator',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        503
      );
    }
  });

  /**
   * GET /ready
   * Readiness probe for Kubernetes/Docker deployments
   */
  app.get('/ready', async (c) => {
    try {
      // Check database connectivity
      const dbHealth = await db.healthCheck();

      if (dbHealth.status !== 'healthy') {
        return c.json(
          {
            ready: false,
            reason: 'Database not available',
            timestamp: new Date().toISOString(),
          },
          503
        );
      }

      return c.json({
        ready: true,
        timestamp: new Date().toISOString(),
        service: 'nanda-facilitator',
        capabilities: [
          'payment-verification',
          'payment-settlement',
          'transaction-history',
          'block-explorer',
        ],
      });
    } catch (error) {
      console.error('Readiness check error:', error);
      return c.json(
        {
          ready: false,
          reason: error instanceof Error ? error.message : 'Service not ready',
          timestamp: new Date().toISOString(),
        },
        503
      );
    }
  });

  /**
   * GET /metrics
   * Prometheus-compatible metrics endpoint
   */
  app.get('/metrics', async (c) => {
    try {
      const sessionStats = await paymentSessionService.getSessionStats();
      const timestamp = Date.now();

      // Generate Prometheus metrics
      const metrics = [
        '# HELP nanda_facilitator_sessions_total Total number of payment sessions',
        '# TYPE nanda_facilitator_sessions_total counter',
        `nanda_facilitator_sessions_total ${sessionStats.totalSessions} ${timestamp}`,
        '',
        '# HELP nanda_facilitator_sessions_active Active payment sessions',
        '# TYPE nanda_facilitator_sessions_active gauge',
        `nanda_facilitator_sessions_active ${sessionStats.activeSessions} ${timestamp}`,
        '',
        '# HELP nanda_facilitator_sessions_settled_total Settled payment sessions',
        '# TYPE nanda_facilitator_sessions_settled_total counter',
        `nanda_facilitator_sessions_settled_total ${sessionStats.settledSessions} ${timestamp}`,
        '',
        '# HELP nanda_facilitator_settlement_duration_ms Average settlement time in milliseconds',
        '# TYPE nanda_facilitator_settlement_duration_ms gauge',
        `nanda_facilitator_settlement_duration_ms ${sessionStats.averageSettlementTime} ${timestamp}`,
        '',
        '# HELP nanda_facilitator_up Service availability',
        '# TYPE nanda_facilitator_up gauge',
        `nanda_facilitator_up 1 ${timestamp}`,
      ].join('\n');

      return c.text(metrics, 200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      });
    } catch (error) {
      console.error('Metrics collection error:', error);
      return c.text('# Error collecting metrics', 500, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    }
  });

  /**
   * GET /version
   * Service version information
   */
  app.get('/version', (c) => {
    return c.json({
      service: 'nanda-facilitator',
      version: '1.0.0',
      protocol: 'x402',
      transport: 'http',
      features: [
        'payment-verification',
        'payment-settlement',
        'nanda-points',
        'mongodb-backend',
        'block-explorer',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}