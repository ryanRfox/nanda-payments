# NANDA Facilitator API Reference

Complete API reference for the NANDA TypeScript Facilitator service. The facilitator provides x402 payment verification and settlement services for the NANDA ecosystem.

## Base URL

```
http://localhost:3000  # Default development
```

## Authentication

Currently, the facilitator operates without authentication for development. In production, implement proper API key authentication or bearer token validation.

## Content Types

All API endpoints accept and return `application/json` unless otherwise specified.

## Error Responses

Standard HTTP status codes are used. Error responses follow this format:

```json
{
  "error": "Error Name",
  "message": "Detailed error description",
  "statusCode": 400
}
```

## Health & Status Endpoints

### GET /health

Health check endpoint for monitoring and load balancing.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

**Status Codes**:
- `200` - Service healthy
- `503` - Service unhealthy

---

### GET /ready

Readiness check with service dependencies status.

**Response**:
```json
{
  "ready": true,
  "services": {
    "database": "healthy",
    "sessionCleanup": "running"
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

**Status Codes**:
- `200` - Service ready
- `503` - Service not ready

---

### GET /metrics

Service metrics for monitoring and analytics.

**Response**:
```json
{
  "uptime": 3600,
  "sessions": {
    "totalSessions": 1250,
    "activeSessions": 45,
    "settledSessions": 1180,
    "expiredSessions": 25
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

**Status Codes**:
- `200` - Metrics retrieved successfully

## x402 Payment Endpoints

### POST /verify

Verify x402 payment authorization without settlement.

**Request Body**:
```json
{
  "paymentPayload": {
    "scheme": "exact",
    "network": "nanda-network",
    "x402Version": 1,
    "payload": {
      "authorization": {
        "from": "sender-wallet-id",
        "to": "receiver-wallet-id",
        "value": "1000",
        "validAfter": "2024-01-20T10:00:00.000Z",
        "validBefore": "2024-01-20T15:00:00.000Z",
        "nonce": "unique-nonce-12345"
      },
      "signature": "cryptographic-signature"
    }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "nanda-network",
    "maxAmountRequired": "1000",
    "resource": "/api/search",
    "description": "AI search service"
  }
}
```

**Response (Success)**:
```json
{
  "valid": true,
  "sessionId": "session_1234567890_abc123",
  "expiresAt": "2024-01-20T11:00:00.000Z"
}
```

**Response (Invalid Payment)**:
```json
{
  "valid": false,
  "reason": "Insufficient balance. Available: 5.00 NP, Required: 10.00 NP"
}
```

**Status Codes**:
- `200` - Verification completed (check `valid` field)
- `400` - Invalid request format
- `500` - Internal server error

---

### POST /settle

Settle a verified payment session and complete the transaction.

**Request Body**:
```json
{
  "sessionId": "session_1234567890_abc123",
  "paymentPayload": {
    "scheme": "exact",
    "network": "nanda-network",
    "x402Version": 1,
    "payload": {
      "authorization": {
        "from": "sender-wallet-id",
        "to": "receiver-wallet-id",
        "value": "1000",
        "validAfter": "2024-01-20T10:00:00.000Z",
        "validBefore": "2024-01-20T15:00:00.000Z",
        "nonce": "unique-nonce-12345"
      },
      "signature": "cryptographic-signature"
    }
  }
}
```

**Response (Success)**:
```json
{
  "settled": true,
  "transactionId": "tx_1234567890_def456",
  "balance": {
    "from": 99000,
    "to": 101000
  }
}
```

**Response (Failed)**:
```json
{
  "settled": false,
  "reason": "Payment session not found"
}
```

**Status Codes**:
- `200` - Settlement completed (check `settled` field)
- `400` - Invalid request format
- `500` - Internal server error

## Explorer Endpoints

### GET /api/v1/agents/{agentName}/balance

Get agent wallet balance information.

**Parameters**:
- `agentName` (path) - Agent name identifier

**Response**:
```json
{
  "agent_name": "my-agent",
  "walletId": "wallet_1234567890_xyz789",
  "balance": {
    "balanceMinor": 150000,
    "balanceNP": 1500,
    "formatted": "1500.00 NP"
  }
}
```

**Status Codes**:
- `200` - Balance retrieved successfully
- `404` - Agent not found

---

### GET /api/v1/transactions

List transactions with optional filtering and pagination.

**Query Parameters**:
- `agent_name` (optional) - Filter by agent name
- `status` (optional) - Filter by transaction status (`pending`, `completed`, `failed`)
- `limit` (optional) - Number of results (default: 20, max: 100)
- `offset` (optional) - Pagination offset (default: 0)
- `from_date` (optional) - Start date filter (ISO 8601)
- `to_date` (optional) - End date filter (ISO 8601)

**Response**:
```json
{
  "transactions": [
    {
      "id": "tx_1234567890_abc123",
      "amount": 1000,
      "currency": "NP",
      "type": "payment",
      "status": "completed",
      "createdAt": "2024-01-20T10:30:00.000Z",
      "completedAt": "2024-01-20T10:30:01.000Z",
      "metadata": {
        "agent_from": "sender-agent",
        "agent_to": "receiver-agent",
        "resource": "/api/search",
        "description": "AI search service",
        "sessionId": "session_1234567890_abc123"
      }
    }
  ],
  "total": 1250,
  "summary": {
    "totalAmount": 125000,
    "averageAmount": 100,
    "statusCounts": {
      "completed": 1180,
      "pending": 45,
      "failed": 25
    }
  }
}
```

**Status Codes**:
- `200` - Transactions retrieved successfully
- `400` - Invalid query parameters

---

### GET /api/v1/stats

Get network-wide statistics and analytics.

**Response**:
```json
{
  "totalAgents": 150,
  "totalTransactions": 12500,
  "totalVolume": 2500000,
  "averageTransactionAmount": 200,
  "topAgentsByVolume": [
    {
      "agent_name": "high-volume-agent",
      "totalVolume": 50000,
      "transactionCount": 500
    },
    {
      "agent_name": "popular-service",
      "totalVolume": 45000,
      "transactionCount": 300
    }
  ],
  "recentActivity": [
    {
      "agent_name": "recent-agent",
      "transactionCount": 25,
      "totalVolume": 5000,
      "period": "last_24h"
    }
  ],
  "networkHealth": {
    "activeAgents": 120,
    "transactionsPerSecond": 0.5,
    "averageSessionTime": 1.2
  }
}
```

**Status Codes**:
- `200` - Statistics retrieved successfully

## Data Models

### PaymentSession

Represents a verified but unsettled payment session.

```typescript
interface PaymentSession {
  sessionId: string;
  resourceServer: string;
  resource: string;
  amount: number;                 // Amount in minor units
  currency: 'NP';
  fromAgent: string;
  toAgent: string;
  status: 'verified' | 'settled' | 'expired' | 'failed';
  paymentRequirements: object;
  paymentPayload?: object;
  expiresAt: string;             // ISO 8601 timestamp
  settledAt?: string;            // ISO 8601 timestamp
  createdAt: string;             // ISO 8601 timestamp
}
```

### Transaction

Represents a completed payment transaction.

```typescript
interface Transaction {
  id: string;
  amount: number;                 // Amount in minor units
  currency: 'NP';
  type: 'payment' | 'refund' | 'adjustment';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;             // ISO 8601 timestamp
  completedAt?: string;          // ISO 8601 timestamp
  metadata: {
    agent_from: string;
    agent_to: string;
    resource?: string;
    description?: string;
    sessionId?: string;
  };
}
```

### Agent

Represents a payment agent in the network.

```typescript
interface Agent {
  id: string;
  agent_name: string;            // Unique agent identifier
  label: string;                 // Human-readable name
  email: string;
  description: string;
  serviceCharge: number;         // Service charge in minor units
  walletId: string;              // Associated wallet ID
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}
```

### Wallet

Represents a NANDA Points wallet.

```typescript
interface Wallet {
  walletId: string;              // Unique wallet identifier
  agent_name: string;            // Associated agent name
  currency: 'NP';
  scale: 2;                      // Decimal places (always 2 for NP)
  balanceMinor: number;          // Balance in minor units
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

## Error Codes

Standard HTTP status codes with specific error messages:

### 400 Bad Request
- Missing required fields
- Invalid JSON format
- Invalid parameter values
- Validation errors

### 402 Payment Required
- Used by client applications, not the facilitator API directly

### 404 Not Found
- Agent not found
- Session not found
- Resource not found

### 409 Conflict
- Duplicate agent name
- Session already settled
- Invalid state transitions

### 500 Internal Server Error
- Database connection issues
- Unexpected server errors
- External service failures

### 503 Service Unavailable
- Service not ready
- Database maintenance
- Temporary overload

## Rate Limiting

Currently no rate limiting is implemented. In production, consider:
- 100 requests per minute per IP for public endpoints
- 1000 requests per minute for authenticated API access
- 10 requests per second for payment endpoints

## SDK Integration

Use the official NANDA SDK for TypeScript/JavaScript:

```typescript
import { NandaClient } from '@nanda/sdk';

const client = new NandaClient({
  facilitatorUrl: 'http://localhost:3000'
});

// Verify payment
const verification = await client.verifyPayment({
  paymentPayload,
  paymentRequirements
});

// Settle payment
const settlement = await client.settlePayment({
  sessionId: verification.sessionId,
  paymentPayload
});
```

## WebSocket Support

Currently not implemented. Future versions may support:
- Real-time transaction notifications
- Balance change events
- Network statistics streaming

## Versioning

API versioning follows semantic versioning:
- Current version: `v1`
- Breaking changes will increment major version
- New features increment minor version
- Bug fixes increment patch version

Version is indicated in the URL path: `/api/v1/...`

## OpenAPI Specification

A full OpenAPI 3.0 specification is available at `/api/docs` (when implemented) for:
- Interactive API testing
- Code generation
- API documentation tools
- Client library generation