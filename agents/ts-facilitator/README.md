# NANDA Payments Ecosystem

> TypeScript-first x402 payment ecosystem enabling AI agents to autonomously pay for services using NANDA Points (NP) - a MongoDB-backed token system providing cryptocurrency UX without blockchain complexity.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd nanda-payments/agents/ts-facilitator

# Install dependencies
pnpm install

# Start development environment
pnpm dev

# Access facilitator at http://localhost:3000
```

## 📋 Project Overview

### Three-Component Architecture

```
Requesting Agent (MCP Client) → Expert Agent (MCP Server) → NANDA Facilitator
        ↓                            ↓                           ↓
  Makes tool calls              x402 protected               Verifies & settles
  Sends payments               Proxies headers               MongoDB backend
```

### Core Components

1. **NANDA Facilitator** (`packages/facilitator/`) - Payment verification and settlement service
2. **Expert Agent** (`packages/mcp-server/`) - MCP server with x402 payment protection
3. **Requesting Agent** (`packages/mcp-client/`) - MCP client with payment capabilities
4. **Developer SDK** (`packages/sdk/`) - Simple middleware for integration

## 🛠️ Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Hono (TypeScript-first, 40x faster than Express)
- **Database**: MongoDB with atomic transactions
- **Token**: NANDA Points (NP) with 2 decimal precision
- **Protocol**: x402 Payment Protocol compliance
- **Integration**: Model Context Protocol (MCP) for AI agents

## 📖 Documentation

- **[Product Requirements](./PRODUCT_REQUIREMENTS.md)** - What we're building and why
- **[Technical Plan](./TECHNICAL_PLAN.md)** - Implementation roadmap and architecture
- **[Implementation Progress](./PROGRESS.md)** - Current status and milestones
- **[x402 Research](./x402_RESEARCH.md)** - Comprehensive protocol analysis

## 💰 NANDA Points (NP) Token

- **Currency**: NP (NANDA Points)
- **Precision**: 2 decimal places (1 NP = 100 minor units)
- **Storage**: MongoDB with atomic transaction support
- **Settlement**: Sub-50ms payment processing
- **Fees**: Zero protocol fees

## 🔌 Developer Experience

### Simple Integration
```typescript
import { nandaFacilitator } from '@nanda/x402-facilitator';

const app = new Hono();
app.use(nandaFacilitator({
  facilitatorUrl: 'https://facilitator.nanda.org',
  endpoints: {
    '/api/search': '10 NP',      // 10.00 NP per request
    '/api/summarize': '25 NP'    // 25.00 NP per request
  }
}));
```

### MCP Server Monetization
See the **before/after example** showing how to add payment requirements to existing MCP servers:

```typescript
// Before: Free tool
server.addTool({ name: "search", handler: searchHandler });

// After: Monetized tool (5 NP per search)
server.addTool({
  name: "search",
  handler: withNandaPayment(searchHandler, { price: "5 NP" })
});
```

### Streamable HTTP Transport
All MCP examples use HTTP transport for web compatibility:

```typescript
// MCP server with HTTP transport
const transport = new StreamableHTTPServerTransport('http://localhost:3000/mcp');
await server.connect(transport);
```

### Block Explorer API
```typescript
// Get transaction history
GET /api/v1/transactions

// Check agent balance
GET /api/v1/agents/claude-desktop/balance

// View network statistics
GET /api/v1/stats
```

## 📦 Package Structure

```
packages/
├── facilitator/     # Core payment service (Hono + MongoDB)
└── sdk/            # Developer middleware and utilities

examples/
├── expert-agent/
│   ├── before/     # Standard free MCP server
│   └── after/      # Same server with x402 monetization
├── requesting-agent/    # MCP client with payment capabilities
└── integrations/   # Framework-specific integration examples
    ├── express/    # Express.js integration
    ├── hono/       # Hono integration
    └── nextjs/     # Next.js integration
```

## 🚦 Project Status

**Current Phase**: Foundation - Week 1 (Project Setup)
**Overall Progress**: Planning Complete ✅, Implementation Started 🔄

### Completed ✅
- [x] Comprehensive x402 protocol research
- [x] Component architecture design
- [x] Technology stack selection (Hono + TypeScript + MongoDB)
- [x] Product requirements and technical planning
- [x] Project structure creation

### In Progress 🔄
- [ ] TypeScript configuration and development tooling
- [ ] Docker development environment
- [ ] Core facilitator implementation
- [ ] MongoDB connection and models

### Upcoming ⏳
- [ ] Payment verification engine (`/verify` endpoint)
- [ ] Payment settlement system (`/settle` endpoint)
- [ ] Block explorer API
- [ ] Developer SDK and middleware
- [ ] MCP integration examples

## 🏗️ Development

### Prerequisites
- Node.js 20+
- pnpm package manager
- MongoDB (via Docker or Atlas)
- ngrok (for development proxy)

### Development Commands
```bash
# Install dependencies for all packages
pnpm install

# Start facilitator in development mode
pnpm dev:facilitator

# Run tests
pnpm test

# Build all packages
pnpm build

# Format code
pnpm format

# Type check
pnpm type-check
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Required variables
MONGODB_URI=mongodb://localhost:27017
NP_DB_NAME=nanda_points
PORT=3000
NODE_ENV=development
```

## 🧪 Testing

### Test Strategy
- **Unit Tests**: >90% code coverage target
- **Integration Tests**: End-to-end payment flows
- **Performance Tests**: <10ms /verify, <50ms /settle
- **Security Tests**: Input validation and abuse prevention

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run performance tests
pnpm test:performance

# Run security tests
pnpm test:security
```

## 🌍 API Endpoints

### Core Facilitator
- `POST /verify` - Verify payment payload against requirements
- `POST /settle` - Settle verified payment atomically

### Block Explorer (Public)
- `GET /api/v1/transactions` - List transactions with pagination
- `GET /api/v1/transactions/:id` - Transaction details
- `GET /api/v1/agents/:name/balance` - Agent balance
- `GET /api/v1/agents/:name/history` - Payment history
- `GET /api/v1/stats` - Network statistics

### Health & Monitoring
- `GET /health` - Service health check
- `GET /ready` - Readiness probe
- `GET /metrics` - Prometheus metrics

## 🤝 Contributing

### Development Process
1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes with clear messages
4. **Test** thoroughly (all tests must pass)
5. **Submit** pull request with detailed description

### Code Standards
- **TypeScript**: Strict mode with full type safety
- **Testing**: All new code requires tests
- **Documentation**: Public APIs must be documented
- **Performance**: No performance regressions allowed

## 🔐 Security

### Security Features
- Input validation with Zod schemas
- Rate limiting per agent
- Audit trail for all transactions
- Cryptographic payment verification
- No sensitive data in logs

### Reporting Issues
- **Security vulnerabilities**: Email security@nanda.org
- **Bugs**: Create GitHub issue with reproduction steps
- **Feature requests**: Discussion in GitHub issues

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **x402 Protocol** - Building on the excellent foundation
- **Hono Framework** - TypeScript-first web framework
- **Model Context Protocol** - AI agent communication standard
- **MongoDB** - Document database with atomic transactions

## 📞 Support & Community

- **Documentation**: [Full API documentation](./docs/)
- **Examples**: [Integration examples](./examples/)
- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)

---

**Status**: 🚧 Active Development
**Version**: 1.0.0-alpha
**Last Updated**: September 2025