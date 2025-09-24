# NANDA Payments Ecosystem - Technical Implementation Plan

## Project Overview

**Repository Structure**: `/agents/ts-facilitator/`
**Primary Technology**: Hono + TypeScript + MongoDB
**Development Approach**: Test-driven development with comprehensive documentation
**Timeline**: 8 weeks from project start

## Architecture Decision Records

### ADR-001: Framework Selection - Hono over Express
**Decision**: Use Hono as the web framework for the facilitator
**Reasoning**:
- 40x performance improvement (402K vs 10K ops/sec)
- TypeScript-first design with excellent type safety
- Universal runtime support (Node.js, Edge, Cloudflare)
- Existing x402 middleware ecosystem
**Trade-offs**: Smaller community but active development and x402 support

### ADR-002: Database - MongoDB over PostgreSQL
**Decision**: Use MongoDB for primary data storage
**Reasoning**:
- Document model fits agent/wallet/transaction data naturally
- Atomic transaction support for payment operations
- Excellent TypeScript integration
- Horizontal scaling capabilities
- No blockchain complexity during MVP phase
**Trade-offs**: Less mature than PostgreSQL but sufficient for use case

### ADR-003: Token Design - NANDA Points (NP)
**Decision**: Implement custom NP token with 2 decimal precision
**Reasoning**:
- Familiar cryptocurrency UX without blockchain overhead
- Precise micropayment support (0.01 NP minimum)
- Future blockchain bridge compatibility
- Fast settlement times (sub-50ms)
**Trade-offs**: Custom implementation vs existing solutions

## Technical Stack

### Core Dependencies
```json
{
  "production": {
    "hono": "^4.6.3",
    "x402": "^0.6.1",
    "@ecdysis/x402-hono": "^0.3.3-patched2",
    "mongodb": "^6.9.0",
    "zod": "^3.24.2",
    "@modelcontextprotocol/sdk": "^1.18.1"
  },
  "development": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.1",
    "@types/node": "^22.7.4",
    "tsx": "^4.19.1"
  }
}
```

### MCP Transport Requirements
- **Streamable HTTP**: Use `StreamableHTTPServerTransport` and `StreamableHTTPClientTransport`
- **HTTP Endpoints**: MCP server accessible via HTTP POST/GET (not stdio)
- **Session Management**: Support for session resumability and redelivery
- **Server-Sent Events**: GET endpoint for streaming responses
- **Web Compatibility**: Enable integration with web-based clients and Claude Web

### Development Tools
- **Runtime**: Node.js 20+
- **Package Manager**: pnpm (for monorepo support)
- **Testing**: Vitest with TypeScript support
- **Linting**: ESLint + Prettier with TypeScript rules
- **Validation**: Zod for runtime type checking
- **Documentation**: TypeDoc for API docs
- **Development Proxy**: ngrok for local testing

## Project Structure

```
/agents/ts-facilitator/
├── packages/
│   ├── facilitator/           # Core facilitator service
│   │   ├── src/
│   │   │   ├── routes/        # API route handlers
│   │   │   ├── services/      # Business logic
│   │   │   ├── models/        # Data models & schemas
│   │   │   ├── middleware/    # Custom middleware
│   │   │   └── utils/         # Utility functions
│   │   ├── tests/             # Test suites
│   │   └── package.json
│   │
│   └── sdk/                   # Developer SDK
│       ├── src/
│       │   ├── middleware/    # Framework middleware
│       │   ├── client/        # Client utilities
│       │   └── types/         # TypeScript definitions
│       └── package.json
│
├── examples/
│   ├── expert-agent/          # Before/after Expert Agent examples
│   │   ├── before/            # Standard free MCP server
│   │   └── after/             # Same server with x402 monetization
│   ├── requesting-agent/      # Requesting Agent example
│   │   └── src/
│   │       └── client.ts      # MCP client with payments
│   └── integrations/          # Framework-specific examples
│       ├── express/           # Express.js integration
│       ├── hono/              # Hono integration
│       └── nextjs/            # Next.js integration
│
├── docs/                      # Documentation
├── scripts/                   # Build & deployment scripts
└── docker/                    # Docker configurations
```

## Database Design

### Collections Schema

#### Agents Collection
```typescript
interface Agent {
  id: string;
  agent_name: string;           // Unique identifier
  label: string;                // Display name
  description: string;
  version: string;
  walletId: string;             // Reference to wallet
  serviceCharge: number;        // Default charge per request
  endpoints: {
    static: string[];
    adaptive_resolver: {
      url: string;
      policies: string[];
    }
  };
  created_at: string;
  updated_at: string;
}

// Indexes
db.agents.createIndex({ "agent_name": 1 }, { unique: true })
db.agents.createIndex({ "walletId": 1 }, { unique: true })
```

#### Wallets Collection
```typescript
interface Wallet {
  walletId: string;             // UUID
  agent_name: string;           // Owner agent
  currency: "NP";               // Always NP for now
  scale: 2;                     // 2 decimal places
  balanceMinor: number;         // Balance in minor units (1 NP = 100 minor)
  createdAt: string;
  updatedAt: string;
}

// Indexes
db.wallets.createIndex({ "walletId": 1 }, { unique: true })
db.wallets.createIndex({ "agent_name": 1 }, { unique: true })
db.wallets.createIndex({ "balanceMinor": 1 }) // For balance queries
```

#### Transactions Collection
```typescript
interface Transaction {
  id: string;                   // UUID
  transactionHash?: string;     // Future blockchain compatibility
  fromWallet: string;           // Payer wallet ID
  toWallet: string;            // Recipient wallet ID
  amount: number;              // Amount in minor units
  currency: "NP";
  type: "payment" | "settlement" | "refund";
  status: "pending" | "completed" | "failed";
  paymentPayload?: x402.PaymentPayload;
  paymentRequirements?: x402.PaymentRequirements;
  resource?: string;           // API endpoint being paid for
  metadata?: {
    agent_from: string;        // Source agent name
    agent_to: string;          // Destination agent name
    tool_name?: string;        // MCP tool name
    session_id?: string;       // Payment session ID
  };
  createdAt: string;
  settledAt?: string;
  error?: string;              // Error message if failed
}

// Indexes
db.transactions.createIndex({ "id": 1 }, { unique: true })
db.transactions.createIndex({ "fromWallet": 1, "createdAt": -1 })
db.transactions.createIndex({ "toWallet": 1, "createdAt": -1 })
db.transactions.createIndex({ "status": 1, "createdAt": -1 })
db.transactions.createIndex({ "type": 1, "createdAt": -1 })
```

#### Payment Sessions Collection
```typescript
interface PaymentSession {
  sessionId: string;           // UUID
  resourceServer: string;      // Expert agent identifier
  resource: string;            // Specific endpoint/tool
  amount: number;              // Amount in minor units
  currency: "NP";
  fromAgent: string;           // Requesting agent
  toAgent: string;             // Expert agent
  status: "pending" | "verified" | "settled" | "expired";
  paymentRequirements: x402.PaymentRequirements;
  paymentPayload?: x402.PaymentPayload;
  expiresAt: string;           // Session expiration
  createdAt: string;
  verifiedAt?: string;
  settledAt?: string;
}

// Indexes
db.paymentSessions.createIndex({ "sessionId": 1 }, { unique: true })
db.paymentSessions.createIndex({ "status": 1, "expiresAt": 1 })
db.paymentSessions.createIndex({ "fromAgent": 1, "createdAt": -1 })
db.paymentSessions.createIndex({ "toAgent": 1, "createdAt": -1 })
```

## API Specification

### Core Facilitator Endpoints

#### POST /verify
**Purpose**: Verify payment payload against requirements
**Request**:
```typescript
{
  paymentPayload: x402.PaymentPayload;
  paymentRequirements: x402.PaymentRequirements;
}
```
**Response**:
```typescript
{
  valid: boolean;
  sessionId?: string;          // If valid, for tracking
  reason?: string;             // If invalid
  expiresAt?: string;          // Session expiration
}
```

#### POST /settle
**Purpose**: Settle verified payment
**Request**:
```typescript
{
  sessionId: string;           // From /verify response
  paymentPayload: x402.PaymentPayload;
}
```
**Response**:
```typescript
{
  settled: boolean;
  transactionId?: string;      // If successful
  reason?: string;             // If failed
  balance?: {                  // Updated balances
    from: number;
    to: number;
  }
}
```

### Block Explorer API

#### GET /api/v1/transactions
**Purpose**: List recent transactions with pagination
**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (max 100, default: 20)
- `status`: Filter by status
- `type`: Filter by transaction type
- `agent`: Filter by agent name

**Response**:
```typescript
{
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

#### GET /api/v1/transactions/:txId
**Purpose**: Get transaction details by ID
**Response**: `Transaction`

#### GET /api/v1/agents/:agentName/balance
**Purpose**: Get agent's current balance
**Response**:
```typescript
{
  agent_name: string;
  balance: number;             // In major units (NP)
  balanceMinor: number;        // In minor units
  currency: "NP";
  lastUpdated: string;
}
```

#### GET /api/v1/agents/:agentName/history
**Purpose**: Get agent's transaction history
**Query Parameters**: Same as `/transactions`
**Response**: Same as `/transactions` but filtered by agent

#### GET /api/v1/stats
**Purpose**: Get network statistics
**Response**:
```typescript
{
  totalTransactions: number;
  totalVolume: number;         // In NP
  activeAgents: number;
  averageTransactionValue: number;
  transactionsLast24h: number;
  volumeLast24h: number;
}
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

#### Week 1: Project Setup
- [ ] **Day 1-2**: Repository structure and tooling
  - Create monorepo structure with pnpm workspaces
  - Setup TypeScript configuration with strict mode
  - Configure ESLint, Prettier, and Vitest
  - Setup Docker development environment
  - Configure MongoDB connection with environment variables

- [ ] **Day 3-5**: Core facilitator skeleton
  - Implement Hono server with basic routing
  - Add MongoDB connection and health checks
  - Create Zod schemas for all data models
  - Implement basic middleware (logging, error handling)
  - Setup development scripts and hot reload

#### Week 2: Database & Models
- [ ] **Day 1-3**: MongoDB schema implementation
  - Create all collection schemas with proper indexes
  - Implement data access layer with atomic operations
  - Add database migration system
  - Create seed script for development data
  - Add database testing utilities

- [ ] **Day 4-5**: Core data models
  - Implement Agent, Wallet, Transaction models
  - Add PaymentSession management
  - Create utility functions for balance operations
  - Add comprehensive unit tests for models
  - Performance testing for database operations

### Phase 2: Core Features (Weeks 3-4)

#### Week 3: Payment Verification
- [ ] **Day 1-3**: /verify endpoint implementation
  - Implement payment payload validation
  - Add payment requirements verification
  - Create payment session management
  - Add cryptographic signature verification
  - Implement balance checking logic

- [ ] **Day 4-5**: Error handling and edge cases
  - Add comprehensive error handling
  - Implement rate limiting per agent
  - Add payment session expiration
  - Create detailed logging for debugging
  - Add integration tests for /verify

#### Week 4: Payment Settlement
- [ ] **Day 1-3**: /settle endpoint implementation
  - Implement atomic balance transfers
  - Add transaction record creation
  - Create settlement validation logic
  - Add idempotency support
  - Implement settlement rollback on failure

- [ ] **Day 4-5**: NANDA Points engine
  - Complete NP token transfer logic
  - Add balance validation and constraints
  - Implement transaction history tracking
  - Create settlement notification system
  - Add comprehensive integration tests

### Phase 3: Integration & APIs (Weeks 5-6)

#### Week 5: Block Explorer API
- [ ] **Day 1-3**: Public API implementation
  - Implement all block explorer endpoints
  - Add pagination and filtering
  - Create agent balance APIs
  - Add transaction history endpoints
  - Implement network statistics

- [ ] **Day 4-5**: API optimization and caching
  - Add Redis caching for frequently accessed data
  - Implement API rate limiting
  - Add response compression
  - Create API documentation with OpenAPI
  - Performance testing and optimization

#### Week 6: Developer SDK
- [ ] **Day 1-3**: SDK core implementation
  - Create Hono middleware for x402 payments
  - Implement client utilities for payments
  - Add TypeScript type definitions
  - Create configuration management
  - Add SDK documentation and examples

- [ ] **Day 4-5**: Framework integrations
  - Create Express.js middleware compatibility
  - Add Next.js integration example
  - Implement MCP server/client examples
  - Create comprehensive usage guides
  - Add SDK testing and validation

### Phase 4: Polish & Launch (Weeks 7-8)

#### Week 7: Testing & Security
- [ ] **Day 1-3**: Comprehensive testing
  - Achieve >90% code coverage
  - Add end-to-end test scenarios
  - Create load testing scripts
  - Add security testing (input validation, injection)
  - Implement chaos engineering tests

- [ ] **Day 4-5**: Security hardening
  - Security audit of payment flows
  - Add input sanitization
  - Implement secure logging (no sensitive data)
  - Add monitoring and alerting
  - Create security documentation

#### Week 8: Documentation & Launch
- [ ] **Day 1-3**: Documentation completion
  - Complete API documentation
  - Create developer guides and tutorials
  - Add troubleshooting guides
  - Create video tutorials for key workflows
  - Setup documentation website

- [ ] **Day 4-5**: Launch preparation
  - Create deployment configurations
  - Setup monitoring and observability
  - Prepare demo applications
  - Create community resources (GitHub templates)
  - Final testing and bug fixes

## Testing Strategy

### Unit Testing
- **Target Coverage**: >90% code coverage
- **Framework**: Vitest with TypeScript support
- **Focus Areas**:
  - Data model validation and operations
  - Payment verification logic
  - Settlement engine correctness
  - API endpoint behavior

### Integration Testing
- **Database Operations**: Test with real MongoDB instance
- **API Endpoints**: End-to-end request/response validation
- **Payment Flows**: Complete payment scenarios
- **Error Handling**: Failure scenarios and recovery

### Performance Testing
- **Load Testing**: 10,000+ concurrent requests
- **Database Performance**: Query optimization validation
- **Memory Usage**: Monitor for memory leaks
- **Response Times**: Verify <10ms for /verify, <50ms for /settle

### Security Testing
- **Input Validation**: Malicious payload testing
- **Authentication**: API access control validation
- **Rate Limiting**: Abuse prevention testing
- **Data Privacy**: Ensure no sensitive data exposure

## Deployment Strategy

### Development Environment
- **Database**: MongoDB running in Docker
- **Application**: tsx for TypeScript execution
- **Proxy**: ngrok for external access during development
- **Monitoring**: Local logging and basic health checks

### Production Environment
- **Container**: Multi-stage Docker build
- **Database**: MongoDB Atlas or self-hosted cluster
- **Load Balancer**: nginx or cloud load balancer
- **Monitoring**: Prometheus + Grafana stack
- **Logging**: Structured JSON logs with correlation IDs

### Configuration Management
```typescript
interface Config {
  server: {
    port: number;
    host: string;
    cors: {
      origins: string[];
    };
  };
  database: {
    uri: string;
    name: string;
    maxConnections: number;
  };
  nandaPoints: {
    currency: "NP";
    scale: 2;
    defaultBalance: number;
  };
  security: {
    rateLimitWindow: number;
    rateLimitMax: number;
    sessionExpirationMinutes: number;
  };
}
```

## Monitoring & Observability

### Metrics to Track
- **Payment Volume**: Transactions per second/minute/hour
- **Response Times**: P50, P95, P99 latencies for all endpoints
- **Error Rates**: Error percentage by endpoint and error type
- **Agent Activity**: Active agents, new registrations, payment frequency
- **Database Performance**: Query times, connection pool utilization

### Logging Strategy
- **Structured Logs**: JSON format with correlation IDs
- **Log Levels**: DEBUG, INFO, WARN, ERROR with appropriate usage
- **Sensitive Data**: Never log payment details or wallet information
- **Audit Trail**: All payment operations with non-sensitive metadata

### Health Checks
- **Liveness**: Basic server responsiveness
- **Readiness**: Database connectivity and payment processing capability
- **Deep Health**: End-to-end payment flow validation

## Risk Mitigation

### Technical Risks
- **Database Performance**: Implement caching and query optimization early
- **Payment Atomicity**: Use MongoDB transactions for all payment operations
- **Concurrency Issues**: Design for high concurrency from the start
- **API Compatibility**: Version all APIs and maintain backward compatibility

### Operational Risks
- **Data Loss**: Implement robust backup and recovery procedures
- **Service Downtime**: Design for graceful degradation and quick recovery
- **Security Breaches**: Implement defense in depth and incident response plans
- **Scaling Issues**: Design for horizontal scaling from day one

## Success Criteria

### Technical Milestones
- [ ] All tests passing with >90% coverage
- [ ] Performance benchmarks met (<10ms /verify, <50ms /settle)
- [ ] Security audit completed with no high-severity findings
- [ ] API documentation complete with working examples

### Quality Gates
- [ ] Code review approval from at least 2 reviewers
- [ ] Performance testing validation under load
- [ ] Security testing with no critical vulnerabilities
- [ ] Documentation review and approval

### Launch Readiness
- [ ] Production deployment tested and validated
- [ ] Monitoring and alerting configured
- [ ] Developer documentation published
- [ ] Community resources and examples available

---

*Document Version: 1.0*
*Last Updated: September 2025*
*Status: Active Development Plan*