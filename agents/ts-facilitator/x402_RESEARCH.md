# x402 Protocol Research - TypeScript Facilitator Implementation

## Table of Contents
1. [Protocol Overview](#protocol-overview)
2. [Facilitator Architecture](#facilitator-architecture)
3. [TypeScript Components Inventory](#typescript-components-inventory)
4. [Implementation Examples](#implementation-examples)
5. [Facilitator Implementations](#facilitator-implementations)
6. [API Specifications](#api-specifications)
7. [Development Resources](#development-resources)
8. [Recent Developments (2024-2025)](#recent-developments-2024-2025)
9. [NEW: Hono Integration & MCP Findings](#hono-integration--mcp-findings)
10. [NEW: NANDA Facilitator Architecture](#nanda-facilitator-architecture)

## Protocol Overview

### What is x402?
x402 is an open, internet-native payment protocol that enables instant, automatic stablecoin payments directly over HTTP. It revives the HTTP 402 Payment Required status code to create a standardized way for services to require payment before providing access to resources.

### Core Principles
- **HTTP Native**: Seamlessly complements existing HTTP requests
- **Chain Agnostic**: Works with multiple blockchain networks and tokens
- **Trust Minimizing**: Reduces reliance on intermediaries
- **Gasless**: Clients and servers don't need to handle gas fees
- **Minimal Integration**: As little as 1 line of code to add payments

### Key Features
- 0 protocol fees for customers and merchants
- Money in wallet in 2 seconds (not T+2 traditional banking)
- Supports micropayments and usage-based billing
- Enables machine-to-machine transactions
- Permissionless payment infrastructure

## Facilitator Architecture

### What is a Facilitator?
A facilitator is a service that handles the complex aspects of cryptocurrency payments:
- **Payment Verification**: Confirms client-submitted payment payloads match requirements
- **Payment Settlement**: Submits validated payments to blockchain and monitors confirmation
- **Chain Abstraction**: Removes need for servers to connect directly to blockchain

### Facilitator Endpoints
All facilitators expose two primary endpoints:
1. **`/verify`**: Verifies payment payloads against payment requirements
2. **`/settle`**: Settles payments on-chain after verification

### Payment Flow
1. Client requests resource from server
2. Server responds with 402 Payment Required + payment instructions
3. Client constructs and sends payment payload via X-PAYMENT header
4. Server verifies payment via facilitator `/verify` endpoint
5. If valid, facilitator settles payment via `/settle` endpoint
6. Server returns requested resource

## TypeScript Components Inventory

### Core Packages

#### 1. `x402` (npm)
- **Version**: 0.6.1 (latest as of research)
- **Purpose**: Core building blocks for x402 Payment Protocol in TypeScript
- **Use Cases**: Middleware implementations (Express, Hono, Next.js)
- **Installation**: `npm i x402`

#### 2. `x402-axios` (npm)
- **Purpose**: Axios interceptor for automatic x402 payment handling
- **Features**: Automatic payment detection and processing
- **Installation**: `npm install x402-axios`

#### 3. `x402-express` (npm)
- **Purpose**: Express.js middleware for x402 payments
- **Features**: One-line paywall implementation
- **Usage**: `paymentMiddleware("0xYourAddress", {"/endpoint": "$0.01"})`

#### 4. `x402-next` (npm)
- **Purpose**: Next.js integration for x402 payments
- **Features**: Server-side payment verification

#### 5. `@sei-js/x402` (npm)
- **Purpose**: SEI blockchain adapted x402 implementation
- **Features**: Core TypeScript types adapted for SEI network

### Framework Integrations

#### Express.js
```typescript
import { paymentMiddleware } from 'x402-express';

app.use(paymentMiddleware("0xYourAddress", {
  "/api/data": "$0.001",
  "/api/premium": "$0.10"
}));
```

#### Advanced Express Implementation
```typescript
import { createExactPaymentRequirements, verifyPayment } from 'x402';

app.get("/endpoint", async (req, res) => {
  const resource = `${req.protocol}://${req.headers.host}${req.originalUrl}`;
  const paymentRequirements = [createExactPaymentRequirements(
    "$0.001",
    "base-sepolia",
    resource,
    "Description of resource"
  )];

  const isValid = await verifyPayment(req, res, paymentRequirements);
  if (!isValid) return; // 402 response sent automatically

  // Serve protected content
  res.json({ data: "protected content" });
});
```

### Client Libraries

#### Axios Integration
```typescript
import axios from 'axios';
import { withPaymentInterceptor } from 'x402-axios';

const client = withPaymentInterceptor(axios.create(), {
  privateKey: process.env.PRIVATE_KEY,
  facilitatorConfig: { url: 'https://facilitator.x402.rs' }
});
```

#### Fetch Integration
```typescript
import { wrapFetchWithPayment } from 'x402';

const paymentFetch = wrapFetchWithPayment(fetch, {
  privateKey: process.env.PRIVATE_KEY,
  facilitatorUrl: 'https://facilitator.x402.rs'
});
```

### MCP (Model Context Protocol) Integration
```typescript
import { withX402Client } from '@modelcontextprotocol/x402';

const server = new Server({
  name: "x402-mcp-server",
  version: "1.0.0"
});

server.addTool({
  name: "fetch_paid_data",
  description: "Fetch data from paid API",
  inputSchema: { /* ... */ },
  handler: withX402Client(async (args) => {
    // Automatic payment handling
    return await fetch(args.url);
  })
});
```

## Implementation Examples

### Server Examples (from Coinbase x402 repo)

#### 1. Basic Express Server
```bash
# Setup
cd examples/typescript/servers/express
npm install
# Add your server's ethereum address to .env
echo "SERVER_ADDRESS=0xYourAddress" >> .env
npm run dev
```

#### 2. Advanced Server with Dynamic Pricing
```bash
# Setup
cd examples/typescript/servers/advanced
npm install
# Configure environment
npm run dev
```

### Client Examples

#### 1. Axios Client
```bash
# Setup
cd examples/typescript/clients/axios
npm install
# Add your private key to .env
echo "PRIVATE_KEY=your_private_key" >> .env
npm run dev
```

#### 2. MCP Server Example
```bash
# Setup
cd examples/typescript/mcp
npm install
# Configure environment variables
npm run dev
```

## Facilitator Implementations

### 1. Coinbase x402 Facilitator
- **URL**: Via Coinbase Developer Platform
- **Features**:
  - Fee-free USDC transactions on Base network
  - Production-ready
  - Integrated with CDP
- **Supported Networks**: Base, Base Sepolia
- **Cost**: Free (no facilitator fees)

### 2. x402.rs Facilitator
- **URL**: `https://facilitator.x402.rs/`
- **Implementation**: Rust-based, open-source
- **Features**:
  - High-performance
  - Fully auditable
  - Self-hostable
  - Production-ready
- **Supported Networks**: 10+ networks (Base, Solana, Avalanche, Polygon, etc.)
- **Cost**: No facilitator fees

### 3. Self-Hosted Facilitator
```bash
# Clone x402-rs repository
git clone https://github.com/x402-rs/x402-rs
cd x402-rs

# Configure environment
export SIGNER_TYPE=private-key
export PRIVATE_KEY=your_private_key
export BASE_RPC_URL=https://mainnet.base.org
export PORT=8080

# Run facilitator
cargo run --bin facilitator
```

## API Specifications

### Facilitator Configuration Type
```typescript
type FacilitatorConfig = {
  url: string; // URL of the x402 facilitator service
  createAuthHeaders?: CreateHeaders; // Optional authentication
}
```

### Payment Requirements Schema
```typescript
interface PaymentRequirements {
  scheme: string; // Currently "exact"
  amount: string; // Amount in token units
  token: string;  // Token contract address
  network: string; // Network identifier
  recipient: string; // Payment recipient address
  resource: string; // Protected resource URL
  description?: string; // Human-readable description
}
```

### Payment Payload Schema
```typescript
interface PaymentPayload {
  scheme: string;
  signature: string; // Cryptographic signature
  nonce: string;    // Unique payment identifier
  amount: string;   // Payment amount
  token: string;    // Token contract address
  network: string;  // Network identifier
  from: string;     // Payer address
  to: string;       // Recipient address
}
```

### Facilitator API Endpoints

#### Verify Endpoint
```http
POST /verify
Content-Type: application/json

{
  "paymentPayload": { /* PaymentPayload object */ },
  "paymentRequirements": { /* PaymentRequirements object */ }
}

Response:
{
  "valid": boolean,
  "reason"?: string // If invalid
}
```

#### Settle Endpoint
```http
POST /settle
Content-Type: application/json

{
  "paymentPayload": { /* PaymentPayload object */ }
}

Response:
{
  "settled": boolean,
  "transactionHash"?: string,
  "reason"?: string // If settlement failed
}
```

## Development Resources

### Official Repositories
- **Main Protocol**: https://github.com/coinbase/x402
- **Rust Implementation**: https://github.com/x402-rs/x402-rs
- **A2A Extension**: https://github.com/google-agentic-commerce/a2a-x402

### Documentation Sites
- **Official Docs**: https://docs.cdp.coinbase.com/x402/
- **Protocol Whitepaper**: https://www.x402.org/x402-whitepaper.pdf
- **GitBook Documentation**: https://x402.gitbook.io/x402
- **Cloudflare Integration**: https://developers.cloudflare.com/agents/x402/

### Setup Requirements
- **Node.js**: v20+ (v24+ recommended)
- **Dependencies**: viem, axios, dotenv
- **Wallet**: Ethereum-compatible wallet with USDC
- **Environment Variables**:
  - `PRIVATE_KEY`: Your wallet private key
  - `SERVER_ADDRESS`: Your server's Ethereum address
  - `FACILITATOR_URL`: Facilitator service URL

### Quick Start
```bash
# Install core package
npm install x402

# For Express.js
npm install x402-express

# For client-side
npm install x402-axios

# Example setup
mkdir my-x402-server
cd my-x402-server
npm init -y
npm install express x402-express
```

## Recent Developments (2024-2025)

### Major Announcements
1. **Coinbase x402 Launch**: Official launch of x402 protocol with fee-free USDC facilitator
2. **Cloudflare Partnership**: x402 Foundation established for AI-driven payments standard
3. **x402 Playground**: Live demonstration platform with testnet USDC distribution
4. **Base Network Integration**: Primary network support with 200ms payment processing
5. **AI Agent Focus**: Specialized tooling for autonomous agent payments

### Network Expansion
- **Current**: Base, Base Sepolia, Solana, Avalanche, Polygon
- **Roadmap**: Additional EVM chains, more token support
- **Performance**: 200ms payment confirmation times

### Ecosystem Growth
- Multiple facilitator implementations available
- Growing library of middleware integrations
- Community-driven extensions (A2A x402, SEI adaptation)
- Enterprise adoption increasing

### Technical Improvements
- Enhanced TypeScript type safety
- Improved error handling
- Better debugging tools
- Performance optimizations
- Security audits completed

## Key Considerations for Facilitator Development

### Architecture Decisions
1. **Self-hosted vs. Hosted**: Consider operational complexity vs. control
2. **Network Support**: Start with Base for simplicity, expand as needed
3. **Token Support**: USDC is most mature, but roadmap includes others
4. **Scaling**: Consider caching, rate limiting, and load balancing

### Security Considerations
1. **Private Key Management**: Use secure key storage (AWS KMS, etc.)
2. **Rate Limiting**: Prevent abuse and DoS attacks
3. **Input Validation**: Strictly validate all payment payloads
4. **Monitoring**: Log all transactions for audit trails

### Performance Optimizations
1. **Connection Pooling**: Reuse RPC connections
2. **Caching**: Cache verification results when safe
3. **Async Processing**: Handle settlements asynchronously
4. **Health Checks**: Implement comprehensive monitoring

### Development Best Practices
1. **Testing**: Unit tests for all payment flows
2. **Error Handling**: Graceful degradation on failures
3. **Documentation**: Clear API documentation
4. **Versioning**: Semantic versioning for API changes
5. **Backwards Compatibility**: Support protocol evolution

## NEW: Hono Integration & MCP Findings

### Hono Framework Integration (`@ecdysis/x402-hono`)

**Package Details:**
- **NPM**: `@ecdysis/x402-hono` v0.3.3-patched2
- **Purpose**: Hono middleware for x402 payment protocol
- **Installation**: `npm i @ecdysis/x402-hono`

**Why Hono Over Express:**
- **Performance**: 402,820 ops/sec vs Express ~10,000 ops/sec
- **TypeScript-First**: Built with TypeScript, excellent type safety
- **Modern Standards**: Web Standards API, universal runtime support
- **Lightweight**: Minimal overhead, perfect for microservices
- **Cross-Platform**: Runs on Cloudflare Workers, Node.js, Bun, Deno, Vercel
- **Active x402 Support**: Existing middleware available

**Basic Usage:**
```typescript
import { Hono } from 'hono';
import { paymentMiddleware } from '@ecdysis/x402-hono';

const app = new Hono();

app.use(paymentMiddleware("0xYourAddress", {
  "/api/endpoint": "$0.01",
  "/premium/data": "$0.10"
}));

app.get('/api/endpoint', (c) => {
  return c.json({ data: "protected content" });
});
```

**Configuration Options:**
- Price (USD or token amount)
- Network ("base" or "base-sepolia")
- Description, MIME type
- Maximum timeout seconds
- Custom paywall HTML
- Facilitator configuration with auth headers

### Model Context Protocol (MCP) Integration

**Key Findings:**
- **No standalone `x402-mcp` package** - integrates via official MCP SDK
- **Official Package**: `@modelcontextprotocol/sdk` v1.18.1
- **x402 Example**: Available in Coinbase x402 repo at `/examples/typescript/mcp`
- **Use Case**: Enables AI agents to make autonomous payments

**MCP Dependencies for x402:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.18.1",
    "viem": "^2.26.2",
    "axios": "^1.8.4",
    "zod": "^3.24.2"
  }
}
```

**MCP Server Capabilities:**
- **Resources**: Expose data (GET-like endpoints)
- **Tools**: Provide functionality (POST-like endpoints)
- **Prompts**: Define interaction patterns

**Example MCP Tool with x402:**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({
  name: "x402-mcp-server",
  version: "1.0.0"
});

server.addTool({
  name: "fetch_paid_data",
  description: "Fetch data from paid API",
  inputSchema: { /* ... */ },
  handler: withX402Client(async (args) => {
    // Automatic payment handling
    return await fetch(args.url);
  })
});
```

## NEW: NANDA Facilitator Architecture

### Recommended Technology Stack

**Framework Choice: Hono + TypeScript**
```json
{
  "runtime": "Node.js 20+",
  "framework": "Hono",
  "language": "TypeScript",
  "database": "MongoDB",
  "validation": "Zod",
  "crypto": "node:crypto",
  "testing": "Vitest",
  "deployment": "Docker + ngrok (dev)"
}
```

**Core Dependencies:**
```json
{
  "dependencies": {
    "hono": "^4.6.3",
    "@ecdysis/x402-hono": "^0.3.3-patched2",
    "x402": "^0.6.1",
    "mongodb": "^6.9.0",
    "zod": "^3.24.2",
    "@modelcontextprotocol/sdk": "^1.18.1"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.1",
    "@types/node": "^22.7.4",
    "tsx": "^4.19.1"
  }
}
```

### Proposed System Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Resource Server   │────│   NANDA Facilitator  │────│   MongoDB       │
│   (x402 enabled)    │    │   (Hono + TS)        │    │   (NP Wallets)  │
└─────────────────────┘    └──────────────────────┘    └─────────────────┘
                                      │
                           ┌──────────┴─────────┐
                           │   x402 SDK/Client  │
                           │   (Developer Tools) │
                           └────────────────────┘
```

### Extended MongoDB Schema

**NANDA Points (NP) Token:**
- **Currency**: "NP"
- **Scale**: 2 (precision to 2 decimal places)
- **Minor Units**: 1 NP = 100 minor units

**New Collections:**

```typescript
interface Transaction {
  id: string;
  transactionHash?: string; // For future blockchain compatibility
  fromWallet: string;
  toWallet: string;
  amount: number; // minor units (precision 2 for NP)
  currency: string; // "NP"
  type: "payment" | "settlement" | "refund";
  status: "pending" | "completed" | "failed";
  paymentPayload?: x402.PaymentPayload;
  paymentRequirements?: x402.PaymentRequirements;
  resource?: string; // API endpoint being paid for
  createdAt: string;
  settledAt?: string;
}

interface PaymentSession {
  sessionId: string;
  resourceServer: string;
  resource: string;
  amount: number;
  currency: string; // "NP"
  fromAgent: string;
  toAgent: string;
  status: "pending" | "verified" | "settled" | "expired";
  expiresAt: string;
  createdAt: string;
}
```

**Updated Wallet Schema:**
```typescript
interface Wallet {
  walletId: string;
  agent_name: string;
  currency: string; // "NP"
  scale: number; // 2
  balanceMinor: number; // Balance in minor units (1 NP = 100 minor)
  createdAt: string;
  updatedAt: string;
}
```

### Developer Experience Goals

**Target Developer API:**
```typescript
// Goal: Make it this simple for developers
import { nandaFacilitator } from '@nanda/x402-facilitator';

const app = new Hono();
app.use(nandaFacilitator({
  facilitatorUrl: 'https://facilitator.nanda.org',
  endpoints: {
    '/api/search': '10 NP',      // 10.00 NP
    '/api/summarize': '25 NP'    // 25.00 NP
  }
}));
```

### Implementation Phases

1. **Phase 1**: Core Facilitator (`/verify`, `/settle` endpoints)
2. **Phase 2**: NANDA Points integration with MongoDB
3. **Phase 3**: Developer SDK & middleware (`@nanda/x402-facilitator`)
4. **Phase 4**: MCP integration for AI agents
5. **Phase 5**: Future blockchain bridge capability

### Key Design Decisions

**Why MongoDB over Blockchain (Initial Phase):**
- **Faster Development**: No blockchain complexity during MVP
- **Cost Effective**: No gas fees or network costs
- **Flexible Schema**: Easy iteration during development
- **High Performance**: Sub-millisecond response times
- **Future Compatible**: Design allows blockchain bridge later

**Why Hono over Express:**
- **40x Performance**: Critical for high-throughput payment processing
- **TypeScript Native**: Better developer experience and type safety
- **Universal Runtime**: Deploy anywhere (Node.js, Edge, Cloudflare)
- **Smaller Bundle**: Faster cold starts and lower resource usage
- **Active x402 Ecosystem**: Existing middleware and community

### Security Considerations

1. **Payment Verification**: Cryptographic signature validation
2. **Rate Limiting**: Prevent abuse and DoS attacks
3. **Input Validation**: Strict Zod schemas for all inputs
4. **Audit Trails**: Log all payment transactions
5. **Key Management**: Secure private key storage (future blockchain use)

---

*Research compiled: September 2025*
*Protocol Version: x402 v0.6.1*
*Status: Production Ready*
*Updates: Added Hono integration, MCP findings, NANDA architecture*