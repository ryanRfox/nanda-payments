# @nanda/facilitator

NANDA TypeScript Facilitator - x402 payment verification and settlement service for the NANDA ecosystem.

## Overview

The NANDA Facilitator is a high-performance service that enables HTTP 402 Payment Required functionality using NANDA Points (NP). It provides secure payment verification, session management, and transaction settlement for micropayment-enabled applications.

## Features

- ✅ **x402 Protocol Support** - Full HTTP 402 Payment Required implementation
- ✅ **Real-time Verification** - Instant payment authorization validation
- ✅ **Session Management** - Temporary payment sessions with expiration handling
- ✅ **Transaction Settlement** - Atomic balance transfers between wallets
- ✅ **MongoDB Storage** - Reliable data persistence with proper indexing
- ✅ **Auto-cleanup** - Automatic expired session cleanup
- ✅ **Health Monitoring** - Comprehensive health checks and metrics
- ✅ **REST API** - Complete RESTful API for integration
- ✅ **Type Safety** - Full TypeScript implementation with Zod validation
- ✅ **High Performance** - Built with Hono framework for optimal speed

## Quick Start

### Installation

```bash
npm install @nanda/facilitator
```

### Environment Setup

```bash
# Required environment variables
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=nanda_facilitator
PORT=8080

# Optional configuration
SESSION_EXPIRATION_MINUTES=60
PERIODIC_CLEANUP_MINUTES=30
LOG_LEVEL=info
```

### Running the Service

```bash
# Development mode
npm run dev

# Production build and start
npm run build
npm start

# Using Docker
docker build -t nanda-facilitator .
docker run -p 8080:8080 nanda-facilitator
```

## API Endpoints

### Health & Monitoring
- `GET /health` - Service health check
- `GET /ready` - Readiness probe with dependency checks
- `GET /metrics` - Service metrics and statistics

### x402 Payment Processing
- `POST /verify` - Verify payment authorization
- `POST /settle` - Settle verified payment session

### Data Explorer
- `GET /api/v1/agents/{name}/balance` - Get agent balance
- `GET /api/v1/transactions` - List transactions with filtering
- `GET /api/v1/stats` - Network-wide statistics

See [API Reference](../../docs/api-reference.md) for complete documentation.

## Architecture

### Core Components

```
┌─────────────────┐
│   HTTP Layer    │ ← Hono framework with Zod validation
│   (Routes)      │
└─────────────────┘
         │
┌─────────────────┐
│   Services      │ ← Business logic and payment processing
│   Layer         │
└─────────────────┘
         │
┌─────────────────┐
│   Data Layer    │ ← MongoDB with proper indexing
│   (Models)      │
└─────────────────┘
```

### Service Architecture

- **PaymentSessionService** - Manages payment verification and settlement
- **WalletService** - Handles balance queries and transfers
- **AgentService** - Manages agent registration and metadata
- **TransactionService** - Records and queries payment transactions
- **DatabaseService** - MongoDB connection and collection management

### Payment Flow

```
1. Client Request (no payment) → 402 Payment Required
2. Client obtains payment authorization from wallet
3. Client Request (with x-payment header) → Verify payment
4. Service processes request → Return result
5. Settlement → Complete transaction and update balances
```

## Configuration

### Database Configuration

```typescript
// MongoDB configuration with replica set support
const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'nanda_facilitator',
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
    }
  }
};
```

### Security Configuration

```typescript
const config = {
  security: {
    sessionExpirationMinutes: 60,
    maxSessionsPerAgent: 100,
    requireHttps: process.env.NODE_ENV === 'production',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*']
  }
};
```

### NANDA Points Configuration

```typescript
const config = {
  nandaPoints: {
    defaultBalanceMinor: 100000, // 1000.00 NP for new agents
    minTransferAmount: 1,        // 0.01 NP minimum
    maxTransferAmount: 1000000,  // 10000.00 NP maximum
    scale: 2                     // 2 decimal places
  }
};
```

## Data Models

### Payment Session

Temporary sessions created during payment verification:

```typescript
interface PaymentSession {
  sessionId: string;           // Unique session identifier
  resourceServer: string;      // Origin server
  resource: string;           // Resource being accessed
  amount: number;             // Cost in minor units
  currency: 'NP';
  fromAgent: string;          // Sender agent name
  toAgent: string;            // Receiver agent name
  status: 'verified' | 'settled' | 'expired' | 'failed';
  paymentRequirements: object;
  paymentPayload?: object;
  expiresAt: string;          // ISO 8601 expiration
  settledAt?: string;         // Settlement timestamp
  createdAt: string;          // Creation timestamp
}
```

### Transaction

Completed payment records:

```typescript
interface Transaction {
  id: string;                 // Unique transaction ID
  amount: number;             // Amount in minor units
  currency: 'NP';
  type: 'payment' | 'refund' | 'adjustment';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  metadata: {
    agent_from: string;
    agent_to: string;
    resource?: string;
    description?: string;
    sessionId?: string;
  };
}
```

### Wallet

Agent balance storage:

```typescript
interface Wallet {
  walletId: string;           // Unique wallet identifier
  agent_name: string;         // Associated agent
  currency: 'NP';
  scale: 2;                   // Decimal places
  balanceMinor: number;       // Balance in minor units
  createdAt: string;
  updatedAt: string;
}
```

## Development

### Project Structure

```
packages/facilitator/
├── src/
│   ├── models/              # Data models and schemas
│   │   ├── config.ts        # Configuration management
│   │   ├── agent.ts         # Agent model
│   │   ├── wallet.ts        # Wallet model and utilities
│   │   ├── transaction.ts   # Transaction model
│   │   └── payment-session.ts # Payment session model
│   ├── services/            # Business logic
│   │   ├── database.ts      # MongoDB service
│   │   ├── agent-service.ts # Agent management
│   │   ├── wallet-service.ts # Balance and transfers
│   │   ├── transaction-service.ts # Transaction logging
│   │   └── payment-session-service.ts # Payment processing
│   ├── routes/              # HTTP route handlers
│   │   ├── health.ts        # Health endpoints
│   │   ├── facilitator.ts   # x402 endpoints
│   │   └── explorer.ts      # Data query endpoints
│   ├── scripts/             # Utility scripts
│   │   └── seed.ts          # Database seeding
│   └── server.ts            # Main server entry point
├── tests/
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
├── dist/                   # Compiled JavaScript
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm test -- tests/integration

# Run specific test file
npm test -- tests/unit/wallet-service.test.ts
```

### Database Setup

The facilitator automatically creates necessary collections and indexes on startup:

```bash
# Start MongoDB (if using local instance)
mongod --dbpath ./data

# The facilitator will create:
# - agents collection (with unique index on agent_name)
# - wallets collection (with indexes on walletId and agent_name)
# - transactions collection (with indexes on agent fields and timestamp)
# - paymentSessions collection (with TTL index for auto-cleanup)
```

### Seeding Test Data

```bash
# Create test agents with wallets
npm run seed
```

This creates:
- `test-sender` agent with 1000.00 NP
- `test-receiver` agent with 1000.00 NP
- `test-poor` agent with 0.50 NP

## Monitoring and Operations

### Health Monitoring

```bash
# Basic health check
curl http://localhost:8080/health

# Detailed readiness check
curl http://localhost:8080/ready

# Service metrics
curl http://localhost:8080/metrics
```

### Logging

The facilitator uses structured logging:

```json
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "level": "info",
  "message": "Payment session created",
  "sessionId": "session_1234567890_abc123",
  "amount": 500,
  "fromAgent": "sender-agent",
  "toAgent": "receiver-agent"
}
```

### Periodic Cleanup

Expired sessions are automatically cleaned up:
- Default: every 30 minutes
- Configurable via `PERIODIC_CLEANUP_MINUTES`
- Manual cleanup: `POST /admin/cleanup` (if enabled)

### Performance Metrics

Key metrics tracked:
- Payment verification rate
- Settlement success rate
- Average session duration
- Database query performance
- Active sessions count
- Total transaction volume

## Production Deployment

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

### Environment Configuration

```bash
# Production environment variables
NODE_ENV=production
PORT=8080
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/nanda
MONGODB_DB_NAME=nanda_production

# Security
CORS_ORIGINS=https://app.example.com,https://api.example.com
SESSION_EXPIRATION_MINUTES=30
REQUIRE_HTTPS=true

# Monitoring
LOG_LEVEL=warn
METRICS_ENABLED=true
HEALTH_CHECK_TIMEOUT=5000
```

### Scaling Considerations

- **Horizontal scaling**: Multiple facilitator instances behind load balancer
- **Database scaling**: MongoDB replica sets for high availability
- **Session management**: Consider Redis for distributed session storage
- **Caching**: Implement Redis caching for frequently accessed data

### Security Checklist

- [ ] MongoDB authentication enabled
- [ ] Network security groups configured
- [ ] HTTPS enforced in production
- [ ] CORS origins restricted
- [ ] Request rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Structured logging without sensitive data
- [ ] Regular security updates

## SDK Integration

Use with the official NANDA SDK:

```typescript
import { NandaClient } from '@nanda/sdk';

const client = new NandaClient({
  facilitatorUrl: 'http://localhost:8080'
});

// Basic usage
const balance = await client.getAgentBalance('my-agent');
const verification = await client.verifyPayment(paymentData);
const settlement = await client.settlePayment(settlementData);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the full test suite
5. Submit a pull request

### Code Style

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## License

MIT - See [LICENSE](../../LICENSE) for details.

## Support

- [API Reference](../../docs/api-reference.md)
- [Integration Guide](../../docs/integration-guide.md)
- [Examples](../../examples/)
- [GitHub Issues](https://github.com/nanda/ts-facilitator/issues)