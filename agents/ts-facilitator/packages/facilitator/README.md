# NANDA Facilitator

A TypeScript x402 payment facilitator for NANDA Points micropayments using MongoDB.

## Overview

The NANDA Facilitator implements the x402 Payment Required protocol for HTTP micropayments using NANDA Points (NP) with MongoDB as the ledger. It provides payment verification and settlement services following Coinbase's reference facilitator patterns.

### Key Features

- **x402 Protocol**: Full HTTP 402 Payment Required implementation
- **Payment Verification**: `/verify` endpoint for payment authorization
- **Payment Settlement**: `/settle` endpoint for completing transactions
- **NANDA Points**: Custom currency with 2 decimal places (1 NP = 100 minor units)
- **MongoDB Integration**: Atomic transactions with replica set support
- **Hono**: Uses Hono framework without additional adapters
- **Health Monitoring**: Built-in health checks and metrics

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB 6.0+ (standalone for development, replica set for production)

### Installation

```bash
npm install
```

### Environment Setup

Create `.env` file:

```bash
# Development (standalone MongoDB)
NODE_ENV=development
HOST=localhost
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017
NP_DB_NAME=nanda_points
MONGODB_USE_TRANSACTIONS=false

# Production (replica set required)
# NODE_ENV=production
# MONGODB_URI=mongodb://mongo1,mongo2,mongo3/?replicaSet=rs0
# MONGODB_USE_TRANSACTIONS=true
```

### Running the Facilitator

```bash
# Development mode with auto-reload
npm run dev

# Build and run production
npm run build
npm start
```

The facilitator will start on `http://localhost:3000` with these endpoints:

- `POST /verify` - Verify x402 payment
- `POST /settle` - Settle verified payment
- `GET /api/v1/stats` - Network statistics
- `GET /api/v1/agents/:name/balance` - Agent balance
- `GET /health` - Health check

### Database Setup

The facilitator automatically creates MongoDB collections and indexes on startup. No manual setup required.

## API Endpoints

### x402 Payment Processing

#### POST /verify
Verifies an x402 payment payload against requirements.

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": {
      "walletId": "sender-wallet",
      "agentName": "sender",
      "toWalletId": "receiver-wallet",
      "toAgentName": "receiver",
      "amount": "1.00"
    },
    "paymentRequirements": {
      "scheme": "exact",
      "cost": 100,
      "currency": "NP",
      "resource": "/protected-resource"
    }
  }'
```

Response:
```json
{
  "valid": true,
  "sessionId": "session_123",
  "expiresAt": "2024-01-01T12:00:00.000Z"
}
```

#### POST /settle
Settles a verified payment session.

```bash
curl -X POST http://localhost:3000/settle \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "paymentPayload": {}
  }'
```

Response:
```json
{
  "settled": true,
  "transactionId": "txn_456",
  "balance": {
    "from": 9900,
    "to": 10100
  }
}
```

### Explorer Endpoints

#### GET /api/v1/agents/:name/balance
Get agent balance and wallet information.

```bash
curl http://localhost:3000/api/v1/agents/test-agent/balance
```

#### GET /api/v1/stats
Get network-wide statistics.

```bash
curl http://localhost:3000/api/v1/stats
```

#### GET /health
Basic health check.

```bash
curl http://localhost:3000/health
```

## Architecture

### Core Services

- **PaymentSessionService**: Manages x402 payment verification and settlement
- **WalletService**: Handles balance queries and transfers
- **AgentService**: Manages agent registration and wallets
- **TransactionService**: Records and queries payment history
- **DatabaseService**: MongoDB connection and operations

### Data Models

#### Wallet
```typescript
interface Wallet {
  walletId: string;        // Unique identifier
  agent_name: string;      // Associated agent
  currency: 'NP';
  scale: 2;               // 2 decimal places
  balanceMinor: number;   // Balance in minor units (1 NP = 100)
  createdAt: string;
  updatedAt: string;
}
```

#### Transaction
```typescript
interface Transaction {
  id: string;             // Unique transaction ID
  amount: number;         // Amount in minor units
  currency: 'NP';
  type: 'payment' | 'refund' | 'adjustment';
  status: 'pending' | 'completed' | 'failed';
  fromWallet: string;
  toWallet: string;
  metadata: {
    agent_from: string;
    agent_to: string;
    session_id?: string;
  };
  createdAt: string;
  completedAt?: string;
}
```

#### PaymentSession
```typescript
interface PaymentSession {
  sessionId: string;           // Unique session ID
  resourceServer: string;      // Origin server
  resource: string;           // Protected resource
  amount: number;             // Cost in minor units
  currency: 'NP';
  fromAgent: string;          // Sender
  toAgent: string;            // Receiver
  status: 'verified' | 'settled' | 'expired' | 'failed';
  expiresAt: string;          // Session expiration
  createdAt: string;
}
```

## Configuration

The facilitator loads configuration from environment variables:

```typescript
// Server settings
PORT=3000
HOST=localhost

// Database
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=nanda_points

// Session management
SESSION_EXPIRATION_MINUTES=60
PERIODIC_CLEANUP_MINUTES=5

// CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Development

### Project Structure

```
packages/facilitator/
├── src/
│   ├── models/              # Type definitions
│   │   ├── config.ts
│   │   ├── agent.ts
│   │   ├── wallet.ts
│   │   ├── transaction.ts
│   │   └── payment-session.ts
│   ├── services/            # Business logic
│   │   ├── database.ts
│   │   ├── agent-service.ts
│   │   ├── wallet-service.ts
│   │   ├── transaction-service.ts
│   │   └── payment-session-service.ts
│   ├── routes/              # HTTP endpoints
│   │   ├── health.ts
│   │   ├── facilitator.ts   # x402 endpoints
│   │   └── explorer.ts      # Data endpoints
│   ├── scripts/
│   │   └── seed.ts          # Test data seeding
│   └── server.ts            # Main server
├── tests/                   # Test files
├── package.json
└── README.md
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Type check
npm run type-check

# Lint code
npm run lint
```

### Database Seeding

Create test agents with initial balances:

```bash
npm run seed
```

This creates:
- `test-sender` with 1000.00 NP
- `test-receiver` with 1000.00 NP
- `test-poor` with 0.50 NP

## x402 Protocol Implementation

The facilitator implements the x402 Payment Required protocol:

1. **Client requests protected resource** without payment
2. **Server responds with 402** including payment requirements
3. **Client obtains payment authorization** from wallet
4. **Client requests resource with X-PAYMENT header**
5. **Facilitator verifies payment** via `/verify` endpoint
6. **Server processes request** and returns content
7. **Payment is settled** via `/settle` endpoint

### Supported Headers

- `X-PAYMENT`: Client payment payload (case-insensitive)
- `X-PAYMENT-RESPONSE`: Server payment requirements (case-insensitive)

### Payment Schemes

Currently supports `"exact"` payment scheme:
- Payment amount must exactly match requirement cost
- Cost specified in minor units (1 NP = 100 minor units)

## NANDA Points Currency

NANDA Points (NP) is the native currency:

- **Symbol**: NP
- **Scale**: 2 decimal places
- **Minor Units**: 1 NP = 100 minor units
- **Example**: 1.50 NP = 150 minor units

All internal calculations use minor units for precision.

## Deployment

### Production Environment

Production requires a MongoDB replica set for atomic transaction support.

```bash
# Build the application
npm run build

# Configure environment
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0
NP_DB_NAME=nanda_production
MONGODB_USE_TRANSACTIONS=true
CORS_ORIGINS=https://app.example.com

# Start the server
npm start
```

## Integration

### Using with NANDA SDK

```typescript
import { NandaClient } from '@nanda/sdk';

const client = new NandaClient({
  facilitatorUrl: 'http://localhost:3000'
});

// Check health
const health = await client.health();

// Verify payment
const verification = await client.verifyPayment({
  paymentPayload: { /* payment data */ },
  paymentRequirements: { /* requirements */ }
});

// Settle payment
if (verification.valid) {
  const settlement = await client.settlePayment({
    sessionId: verification.sessionId,
    paymentPayload: {}
  });
}
```

## Design Decisions

### MongoDB Standalone
- Uses standalone MongoDB (no replica sets)
- Simplified transaction handling for development
- Auto-created indexes for performance

### Pure Hono Framework
- No additional adapters or middleware
- Uses Node.js native HTTP server
- Minimal dependencies for reliability

### Coinbase Pattern Alignment
- Simple verify/settle functions
- Stateless payment verification
- Clear separation of concerns

## Monitoring

### Health Checks
- `GET /health` - Basic service health
- Database connectivity validation
- Automatic session cleanup every 5 minutes

### Logging
Structured JSON logs for all operations:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Payment verified",
  "sessionId": "session_123",
  "amount": 100,
  "fromAgent": "sender"
}
```

## License

MIT