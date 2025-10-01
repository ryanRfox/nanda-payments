# 🚀 NANDA SDK

<div align="center">

**A powerful TypeScript SDK for seamless x402 micropayments and agent wallet management**

[![npm version](https://badge.fury.io/js/@nanda/sdk.svg)](https://badge.fury.io/js/@nanda/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

*Enable micropayments in your applications with the NANDA payment facilitator network*

</div>

## ✨ Features

- 🎯 **Type-Safe**: Full TypeScript support with comprehensive type definitions
- ⚡ **x402 Protocol**: Native HTTP 402 Payment Required protocol support
- 🔒 **Secure Payments**: Built-in verify/settle payment flows
- 💰 **Wallet Management**: Real-time agent balance tracking and monitoring
- 📊 **Network Analytics**: Comprehensive network statistics and insights
- 🚀 **Easy Integration**: Simple, intuitive API designed for developers
- ⏱️ **Timeout Control**: Configurable request timeouts and error handling
- 🔍 **Payment Sessions**: Secure session-based payment processing

## 🛠 Installation

```bash
npm install @nanda/sdk
```

## 🚀 Quick Start

```typescript
import { NandaClient } from '@nanda/sdk';

// Initialize the client
const client = new NandaClient({
  facilitatorUrl: 'http://localhost:3000',
  timeout: 5000,
});

// Check facilitator health
const health = await client.health();
console.log('🟢 Network status:', health.status);

// Get agent balance
const balance = await client.getAgentBalance('my-agent');
console.log('💰 Balance:', balance.balance.formatted);

// View network statistics
const stats = await client.getNetworkStats();
console.log('📊 Total volume:', stats.transactions.totalVolumeFormatted);
```

## ⚙️ Configuration

### NandaSDKConfig

```typescript
interface NandaSDKConfig {
  facilitatorUrl: string;    // Facilitator base URL
  apiKey?: string;          // Optional API key for authentication
  timeout?: number;         // Request timeout in milliseconds (default: 5000)
}
```

### Environment Setup

```typescript
// Development
const client = new NandaClient({
  facilitatorUrl: 'http://localhost:3000',
});

// Production
const client = new NandaClient({
  facilitatorUrl: process.env.NANDA_FACILITATOR_URL,
  apiKey: process.env.NANDA_API_KEY,
  timeout: 10000,
});
```

## 📚 API Reference

### 🏥 Health Check

Check facilitator health and availability:

```typescript
const health = await client.health();

interface HealthResponse {
  status: string;         // "healthy" | "degraded" | "unhealthy"
  timestamp: string;      // ISO 8601 timestamp
  uptime?: number;        // Uptime in milliseconds
}
```

### 📊 Network Statistics

Get comprehensive network analytics:

```typescript
const stats = await client.getNetworkStats();

interface NetworkStatsResponse {
  wallets: {
    totalWallets: number;
    activeWallets: number;
    totalBalance: number;            // Total balance in minor units
    totalBalanceFormatted: string;   // "1,234.56 NP"
    averageBalance: number;
  };
  agents: {
    totalAgents: number;
    activeAgents: number;
    averageServiceCharge: number;
    topAgentsByServiceCharge: Array<{
      agent_name: string;
      serviceCharge: number;
    }>;
  };
  transactions: {
    totalTransactions: number;
    totalVolume: number;             // Total volume in minor units
    totalVolumeFormatted: string;    // "12,345.67 NP"
    pendingTransactions: number;
    completedTransactions: number;
    failedTransactions: number;
    averageTransactionValue: number;
  };
  timestamp: string;
}
```

### 💰 Agent Balance

Retrieve agent wallet balance and information:

```typescript
const balance = await client.getAgentBalance('agent-name');

interface AgentBalanceResponse {
  agent_name: string;
  walletId: string;
  balance: {
    balanceMinor: number;      // Balance in minor units (1 NP = 100 minor)
    balanceNP: number;         // Balance in NANDA Points (10.50)
    formatted: string;         // "10.50 NP"
  };
}
```

### 🔐 x402 Payment Verification

Verify a payment payload before settlement using the **x402 protocol standard**:

```typescript
const verifyResult = await client.verifyPayment({
  paymentPayload: {
    x402Version: 1,
    scheme: 'exact',
    network: 'nanda-points',
    payload: {
      from: 'sender-wallet-uuid',
      to: 'recipient-wallet-uuid',
      amount: '5.00',
    },
  },
  paymentRequirements: {
    scheme: 'exact',
    network: 'nanda-points',
    maxAmountRequired: '5.00',
    resource: 'https://example.com/api/search',
    description: 'AI search query',
    mimeType: 'application/json',
    maxTimeoutSeconds: 300,
    payTo: 'recipient-wallet-uuid',
    asset: 'NP',
  },
});

interface VerifyPaymentResponse {
  valid: boolean;
  sessionId?: string;       // Session ID for settlement
  expiresAt?: string;       // ISO 8601 expiration time
  reason?: string;          // Error message if verification failed
}
```

### ⚡ x402 Payment Settlement

Complete a verified payment session with the **same x402-compliant payload**:

```typescript
const settleResult = await client.settlePayment({
  sessionId: 'session-uuid',
  paymentPayload: {
    x402Version: 1,
    scheme: 'exact',
    network: 'nanda-points',
    payload: {
      from: 'sender-wallet-uuid',
      to: 'recipient-wallet-uuid',
      amount: '5.00',
    },
  },
});

interface SettlePaymentResponse {
  settled: boolean;
  transactionId?: string;   // Transaction ID if successful
  balance?: {
    from: number;          // Sender's new balance (minor units)
    to: number;            // Recipient's new balance (minor units)
  };
  reason?: string;         // Error message if settlement failed
}
```

## 🚨 Error Handling

The SDK provides comprehensive error handling with structured error types:

```typescript
import { NandaSDKError } from '@nanda/sdk';

try {
  const balance = await client.getAgentBalance('nonexistent-agent');
} catch (error) {
  if (error instanceof NandaSDKError) {
    console.error('SDK Error:', {
      message: error.message,
      statusCode: error.statusCode,    // HTTP status code
      code: error.code,                // Error code identifier
      response: error.response,        // Raw response data
    });

    // Handle specific errors
    switch (error.statusCode) {
      case 404:
        console.log('❌ Agent not found');
        break;
      case 402:
        console.log('💰 Payment required');
        break;
      case 500:
        console.log('🔥 Server error - please try again');
        break;
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## 💡 Practical Examples

### 🏪 Complete Agent-to-Agent Payment

```typescript
import { NandaClient } from '@nanda/sdk';

async function executePayment() {
  const client = new NandaClient({
    facilitatorUrl: 'http://localhost:3000',
  });

  try {
    // Step 1: Check sender balance
    const senderBalance = await client.getAgentBalance('client-agent');
    console.log('💰 Sender balance:', senderBalance.balance.formatted);

    // Step 2: Verify payment capability
    const verifyResult = await client.verifyPayment({
      paymentPayload: {
        from: 'client-wallet-id',
        to: 'service-wallet-id',
        amount: '10.00',
      },
      paymentRequirements: {
        scheme: 'exact',
        cost: 1000,  // 10.00 NP in minor units
        currency: 'NP',
        resource: '/ai/analyze',
        description: 'Document analysis service',
      },
    });

    if (!verifyResult.valid) {
      throw new Error(`❌ Payment verification failed: ${verifyResult.reason}`);
    }

    console.log('✅ Payment verified, session:', verifyResult.sessionId);

    // Step 3: Execute payment
    const settleResult = await client.settlePayment({
      sessionId: verifyResult.sessionId,
      paymentPayload: {
        from: 'client-wallet-id',
        to: 'service-wallet-id',
        amount: '10.00',
      },
    });

    if (!settleResult.settled) {
      throw new Error(`❌ Payment settlement failed: ${settleResult.reason}`);
    }

    console.log('🎉 Payment completed successfully!');
    console.log('📋 Transaction ID:', settleResult.transactionId);
    console.log('💰 New balances:', settleResult.balance);

    return settleResult.transactionId;

  } catch (error) {
    console.error('Payment failed:', error);
    throw error;
  }
}
```

### 📊 Real-time Network Monitor

```typescript
import { NandaClient } from '@nanda/sdk';

class NetworkMonitor {
  private client: NandaClient;
  private intervalId?: NodeJS.Timeout;

  constructor(facilitatorUrl: string) {
    this.client = new NandaClient({ facilitatorUrl });
  }

  async start(intervalMs: number = 30000) {
    console.log('🚀 Starting NANDA network monitor...');

    this.intervalId = setInterval(async () => {
      try {
        const [health, stats] = await Promise.all([
          this.client.health(),
          this.client.getNetworkStats(),
        ]);

        console.clear();
        console.log(`
╭─────────────────────────────────────────────────────────────╮
│                    🌐 NANDA Network Status                   │
├─────────────────────────────────────────────────────────────┤
│ Status: ${health.status === 'healthy' ? '🟢 Healthy' : '🔴 Issues'}                                   │
│ Last Updated: ${new Date().toLocaleTimeString()}                              │
├─────────────────────────────────────────────────────────────┤
│ 🏪 Agents: ${stats.agents.totalAgents.toString().padStart(8)}                                   │
│ 💳 Wallets: ${stats.wallets.totalWallets.toString().padStart(7)}                                   │
│ ⚡ Transactions: ${stats.transactions.totalTransactions.toLocaleString().padStart(4)}                               │
│ 💰 Total Volume: ${stats.transactions.totalVolumeFormatted.padStart(12)}                   │
│ 📈 Avg Transaction: ${(stats.transactions.averageTransactionValue / 100).toFixed(2).padStart(8)} NP               │
╰─────────────────────────────────────────────────────────────╯
        `);

        if (stats.agents.topAgentsByServiceCharge.length > 0) {
          console.log('🏆 Top Agents by Service Charge:');
          stats.agents.topAgentsByServiceCharge.slice(0, 3).forEach((agent, i) => {
            console.log(`   ${i + 1}. ${agent.agent_name} - ${agent.serviceCharge} NP`);
          });
        }

      } catch (error) {
        console.error('❌ Monitor error:', error);
      }
    }, intervalMs);

    console.log('✅ Network monitor started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('⏹️ Network monitor stopped');
    }
  }
}

// Usage
const monitor = new NetworkMonitor('http://localhost:3000');
monitor.start();

// Stop after 5 minutes
setTimeout(() => monitor.stop(), 5 * 60 * 1000);
```

## 🔒 HTTP 402 Payment Required Implementation

### 🌤️ Complete MCP Server Integration Guide

This section shows how to integrate NANDA payments into your MCP server using the **Weather Alerts Service** as a real-world example.

#### Step 1: Basic MCP Server Setup

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { NandaClient } from '@nanda/sdk';

// Initialize NANDA client
const nandaClient = new NandaClient({
  facilitatorUrl: 'http://localhost:3000',
  timeout: 10000,
});

// Create MCP server
const server = new Server({
  name: 'weather-mcp-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {},
  }
});

// Your weather service wallet (expert agent)
const WEATHER_SERVICE_WALLET = 'your-weather-service-wallet-uuid';
```

#### Step 2: Protected Tool Implementation

```typescript
// Add the weather alerts tool with NANDA payment protection
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  if (name === 'get-alerts') {
    try {
      // Step 2.1: Create x402-compliant payment requirements
      const paymentRequirements = {
        scheme: 'exact',
        network: 'nanda-points',
        maxAmountRequired: '1.00', // 1.00 NP charge
        resource: `mcp://weather-service/get-alerts`,
        description: 'Weather alerts service access - Get severe weather warnings',
        mimeType: 'application/json',
        maxTimeoutSeconds: 300,
        payTo: WEATHER_SERVICE_WALLET,
        asset: 'NP',
      };

      // Step 2.2: Extract client wallet info from MCP arguments
      const clientWalletId = args.clientWallet as string;
      if (!clientWalletId) {
        throw new Error('Client wallet ID required for payment');
      }

      // Step 2.3: Create payment payload
      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'nanda-points',
        payload: {
          from: clientWalletId,
          to: WEATHER_SERVICE_WALLET,
          amount: '1.00',
        },
      };

      // Step 2.4: Verify payment with NANDA facilitator
      console.log('🔍 Verifying payment for weather alerts...');
      const verifyResult = await nandaClient.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      if (!verifyResult.valid) {
        throw new Error(`❌ Payment verification failed: ${verifyResult.reason}`);
      }

      // Step 2.5: Settle the payment
      console.log('💰 Settling payment...');
      const settleResult = await nandaClient.settlePayment({
        sessionId: verifyResult.sessionId!,
        paymentPayload,
      });

      if (!settleResult.settled) {
        throw new Error(`❌ Payment settlement failed: ${settleResult.reason}`);
      }

      console.log('✅ Payment completed successfully!');

      // Step 2.6: Provide the weather service
      const weatherAlerts = await getWeatherAlerts(args);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            payment: {
              transactionId: settleResult.transactionId,
              amount: '1.00 NP',
              balance: settleResult.balance,
            },
            data: weatherAlerts
          }, null, 2)
        }]
      };

    } catch (error) {
      console.error('Weather alerts service error:', error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            paymentRequired: {
              description: 'This tool requires 1.00 NP payment',
              instructions: 'Ensure your client wallet has sufficient NANDA Points balance'
            }
          }, null, 2)
        }],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Mock weather service function
async function getWeatherAlerts(args: any) {
  return {
    location: args.location || 'Default Location',
    alerts: [
      {
        severity: 'moderate',
        title: 'Thunderstorm Warning',
        description: 'Severe thunderstorms expected with heavy rain and lightning',
        validUntil: '2024-12-01T18:00:00Z'
      }
    ],
    timestamp: new Date().toISOString()
  };
}
```

#### Step 3: Tool Registration

```typescript
// Register the weather alerts tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: 'get-alerts',
      description: 'Get severe weather alerts for a location (requires 1.00 NP payment)',
      inputSchema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'Location to get weather alerts for'
          },
          clientWallet: {
            type: 'string',
            description: 'Client wallet UUID for payment processing'
          }
        },
        required: ['location', 'clientWallet']
      }
    }]
  };
});
```

#### Step 4: Client Usage Example

```typescript
// How a Claude AI client would use this MCP server
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mcpClient = new Client({
  name: 'claude-ai-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

// Using the weather tool with payment
async function getWeatherWithPayment() {
  const result = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'get-alerts',
      arguments: {
        location: 'San Francisco, CA',
        clientWallet: 'claude-ai-wallet-uuid' // Claude's wallet for payment
      }
    }
  });

  console.log('Weather data received:', result);
}
```

#### Step 5: Error Handling & Recovery

```typescript
// Enhanced error handling for common payment scenarios
async function handlePaymentFlow(clientWallet: string, amount: string) {
  try {
    // Check client balance first
    const clientBalance = await nandaClient.getAgentBalance(clientWallet);
    const requiredAmount = parseFloat(amount) * 100; // Convert to minor units

    if (clientBalance.balance.minor < requiredAmount) {
      return {
        success: false,
        error: 'Insufficient balance',
        details: {
          required: `${amount} NP`,
          available: clientBalance.balance.formatted,
          shortfall: `${((requiredAmount - clientBalance.balance.minor) / 100).toFixed(2)} NP`
        }
      };
    }

    // Proceed with payment verification and settlement...
    // ... (payment logic from above)

  } catch (error) {
    // Network or facilitator errors
    if (error.message.includes('timeout')) {
      return {
        success: false,
        error: 'Payment network timeout',
        retryable: true,
        details: 'The NANDA payment network is currently experiencing delays'
      };
    }

    if (error.message.includes('facilitator')) {
      return {
        success: false,
        error: 'Payment facilitator unavailable',
        retryable: true,
        details: 'Unable to connect to NANDA payment facilitator'
      };
    }

    // Unknown errors
    return {
      success: false,
      error: 'Payment processing failed',
      details: error.message
    };
  }
}
```

#### Key Integration Points

**🔑 Essential Requirements:**
1. **Client Wallet**: MCP tools must request client's wallet UUID for payment
2. **x402 Compliance**: Use exact schema format for paymentPayload and paymentRequirements
3. **Error Handling**: Provide clear feedback for insufficient funds, network issues, etc.
4. **Session Management**: Always settle payments after verification
5. **Balance Checking**: Verify client has sufficient funds before attempting payment

**⚡ Best Practices:**
- Cache payment sessions to avoid double-charging
- Implement retry logic for network timeouts
- Provide detailed error messages with actionable steps
- Log all payment transactions for debugging
- Use descriptive resource URLs for payment tracking

### Client Configuration Discovery

The x402 protocol provides automatic client configuration through the 402 response headers. When your client receives a 402 response, it learns:

- **Network**: `"nanda-points"` (NANDA Points network)
- **Facilitator**: `http://localhost:3000` (payment processing endpoint)
- **Asset**: `"NP"` (NANDA Points currency)
- **Requirements**: Payment structure and validation rules

### 🔒 x402 HTTP Integration

```typescript
import { NandaClient } from '@nanda/sdk';

// Middleware for handling x402 payments in HTTP services
class X402PaymentMiddleware {
  private client: NandaClient;

  constructor(facilitatorUrl: string) {
    this.client = new NandaClient({ facilitatorUrl });
  }

  async handleRequest(req: Request): Promise<Response> {
    const paymentHeader = req.headers.get('X-Payment');

    if (!paymentHeader) {
      // No payment provided, return 402 Payment Required
      return new Response('Payment Required', {
        status: 402,
        headers: {
          'X-Payment-Response': JSON.stringify({
            scheme: 'exact',
            cost: 500,  // 5.00 NP
            currency: 'NP',
            resource: req.url,
            description: 'API access fee',
          }),
        },
      });
    }

    try {
      // Parse payment payload
      const paymentPayload = JSON.parse(paymentHeader);

      // Verify payment
      const verification = await this.client.verifyPayment({
        paymentPayload,
        paymentRequirements: {
          scheme: 'exact',
          cost: 500,
          currency: 'NP',
          resource: req.url,
          description: 'API access fee',
        },
      });

      if (!verification.valid) {
        return new Response(`Payment verification failed: ${verification.reason}`, {
          status: 402,
        });
      }

      // Settle payment
      const settlement = await this.client.settlePayment({
        sessionId: verification.sessionId!,
        paymentPayload,
      });

      if (!settlement.settled) {
        return new Response(`Payment settlement failed: ${settlement.reason}`, {
          status: 402,
        });
      }

      // Payment successful, proceed with request
      console.log('✅ Payment processed:', settlement.transactionId);
      return new Response('Access granted', { status: 200 });

    } catch (error) {
      console.error('Payment processing error:', error);
      return new Response('Payment processing error', { status: 500 });
    }
  }
}
```

## 🔧 NANDA Points (NP)

The NANDA network uses NANDA Points as its native currency:

```typescript
// NANDA Points specifications
const NPSpecs = {
  scale: 2,                    // 2 decimal places
  minorUnitsPerNP: 100,       // 1 NP = 100 minor units
  minAmount: 1,               // 0.01 NP minimum
  maxAmount: 999999999,       // 9,999,999.99 NP maximum
  format: 'X.XX NP',          // Display format
};

// Working with NANDA Points
const examples = {
  // Converting from NP to minor units
  oneNP: 1.00 * 100,          // 100 minor units
  halfNP: 0.50 * 100,         // 50 minor units
  tenCents: 0.10 * 100,       // 10 minor units

  // Converting from minor units to NP
  hundredMinor: 100 / 100,    // 1.00 NP
  fiftyMinor: 50 / 100,       // 0.50 NP
  oneMinor: 1 / 100,          // 0.01 NP
};

// Formatting utilities (if you implement them)
function formatNP(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} NP`;
}

console.log(formatNP(1050));    // "10.50 NP"
console.log(formatNP(5));       // "0.05 NP"
```

## 🧪 Development & Testing

### Integration Testing

```bash
# Start the facilitator
cd packages/facilitator
npm run dev

# Seed test data
npm run seed

# Run SDK integration tests
cd ../sdk
npx tsx test-sdk-integration.ts
```

### Building the SDK

```bash
cd packages/sdk
npm run build         # Build the SDK
npm run type-check    # TypeScript validation
npm run lint          # Code linting
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/nanda-sdk`
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes and add tests
5. **Test** your changes: `npm test`
6. **Commit** your changes: `git commit -m 'Add amazing feature'`
7. **Push** to your branch: `git push origin feature/amazing-feature`
8. **Create** a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation
- Follow conventional commit messages
- Ensure all tests pass before submitting

## 🚨 Error Handling & Troubleshooting

### Common Error Scenarios

#### 1. Insufficient Balance

```typescript
try {
  const result = await client.verifyPayment({ paymentPayload, paymentRequirements });
} catch (error) {
  if (error.message.includes('Insufficient balance')) {
    console.error('❌ Payment failed: Not enough NANDA Points');
    console.log('💡 Solution: Add more NP to your wallet or reduce payment amount');

    // Get current balance for user
    const balance = await client.getAgentBalance(clientWalletId);
    console.log(`📊 Current balance: ${balance.balance.formatted}`);
    console.log(`💰 Required: ${paymentRequirements.maxAmountRequired} NP`);
  }
}
```

#### 2. Network Connection Issues

```typescript
try {
  await client.health();
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    console.error('❌ Cannot connect to NANDA facilitator');
    console.log('💡 Solutions:');
    console.log('   • Verify facilitator URL is correct');
    console.log('   • Check if facilitator service is running');
    console.log('   • Confirm network connectivity');

    // Retry with exponential backoff
    await retryWithBackoff(() => client.health(), 3);
  }
}

async function retryWithBackoff(fn: () => Promise<any>, maxRetries: number) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`🔄 Retrying in ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### 3. Invalid Payment Format

```typescript
// Common mistake: Using legacy format instead of x402-compliant format
// ❌ WRONG - Legacy format
const badPayload = {
  from: 'wallet-id',
  to: 'wallet-id',
  amount: '1.00'
};

// ✅ CORRECT - x402-compliant format
const goodPayload = {
  x402Version: 1,
  scheme: 'exact',
  network: 'nanda-points',
  payload: {
    from: 'wallet-id',
    to: 'wallet-id',
    amount: '1.00'
  }
};

// Validation helper
function validatePaymentPayload(payload: any): boolean {
  const required = ['x402Version', 'scheme', 'network', 'payload'];
  for (const field of required) {
    if (!(field in payload)) {
      console.error(`❌ Missing required field: ${field}`);
      return false;
    }
  }

  if (payload.network !== 'nanda-points') {
    console.error(`❌ Invalid network: ${payload.network}. Must be 'nanda-points'`);
    return false;
  }

  return true;
}
```

#### 4. Session Timeout Issues

```typescript
try {
  // Verify payment (creates session)
  const verifyResult = await client.verifyPayment({
    paymentPayload,
    paymentRequirements,
  });

  // ⚠️ Session expires after 5 minutes by default
  // Don't wait too long before settling!

  // Settle payment promptly
  const settleResult = await client.settlePayment({
    sessionId: verifyResult.sessionId!,
    paymentPayload,
  });

} catch (error) {
  if (error.message.includes('Session expired') || error.message.includes('Session not found')) {
    console.error('❌ Payment session expired');
    console.log('💡 Solution: Complete verify + settle within 5 minutes');
    console.log('🔄 Restart the payment flow from verification');
  }
}
```

### Debugging Tools

#### Payment Flow Tracer

```typescript
class PaymentTracer {
  private client: NandaClient;

  constructor(facilitatorUrl: string) {
    this.client = new NandaClient({ facilitatorUrl });
  }

  async tracePayment(paymentPayload: any, paymentRequirements: any) {
    console.log('🔍 Starting payment trace...\n');

    // Step 1: Validate inputs
    console.log('1️⃣ Validating payment data...');
    const isValidPayload = this.validateFormat(paymentPayload, 'PaymentPayload');
    const isValidRequirements = this.validateFormat(paymentRequirements, 'PaymentRequirements');

    if (!isValidPayload || !isValidRequirements) {
      return false;
    }

    // Step 2: Check balances
    console.log('2️⃣ Checking wallet balances...');
    try {
      const fromBalance = await this.client.getAgentBalance(paymentPayload.payload.from);
      const toBalance = await this.client.getAgentBalance(paymentRequirements.payTo);

      console.log(`   From wallet: ${fromBalance.balance.formatted}`);
      console.log(`   To wallet: ${toBalance.balance.formatted}`);

      const requiredMinor = parseFloat(paymentRequirements.maxAmountRequired) * 100;
      if (fromBalance.balance.minor < requiredMinor) {
        console.log(`   ❌ Insufficient funds (need ${paymentRequirements.maxAmountRequired} NP)`);
        return false;
      }
      console.log('   ✅ Sufficient balance');

    } catch (error) {
      console.log(`   ❌ Balance check failed: ${error.message}`);
      return false;
    }

    // Step 3: Test verification
    console.log('3️⃣ Testing payment verification...');
    try {
      const verifyResult = await this.client.verifyPayment({
        paymentPayload,
        paymentRequirements,
      });

      if (verifyResult.valid) {
        console.log(`   ✅ Verification successful (session: ${verifyResult.sessionId})`);

        // Step 4: Test settlement
        console.log('4️⃣ Testing payment settlement...');
        const settleResult = await this.client.settlePayment({
          sessionId: verifyResult.sessionId!,
          paymentPayload,
        });

        if (settleResult.settled) {
          console.log(`   ✅ Settlement successful (tx: ${settleResult.transactionId})`);
          console.log(`   💰 Final balances: From=${settleResult.balance?.from}, To=${settleResult.balance?.to}`);
          return true;
        } else {
          console.log(`   ❌ Settlement failed: ${settleResult.reason}`);
        }
      } else {
        console.log(`   ❌ Verification failed: ${verifyResult.reason}`);
      }

    } catch (error) {
      console.log(`   ❌ Payment processing failed: ${error.message}`);
    }

    return false;
  }

  private validateFormat(data: any, type: string): boolean {
    // Add your validation logic here
    console.log(`   Validating ${type}...`);
    return true; // Simplified for example
  }
}

// Usage
const tracer = new PaymentTracer('http://localhost:3000');
await tracer.tracePayment(paymentPayload, paymentRequirements);
```

## 📋 Migration Guide: Legacy to x402 Format

### What Changed?

The NANDA SDK has been updated to support the x402 protocol standard while maintaining backward compatibility with legacy formats.

#### Before (Legacy Format)

```typescript
// Old payment payload format
const legacyPayload = {
  from: 'client-wallet-id',
  to: 'service-wallet-id',
  amount: '1.00',
};

// Old payment requirements
const legacyRequirements = {
  amount: '1.00',
  currency: 'NP',
  resource: '/api/service',
  description: 'Service access'
};
```

#### After (x402-Compliant Format)

```typescript
// New x402-compliant payment payload
const x402Payload = {
  x402Version: 1,
  scheme: 'exact',
  network: 'nanda-points',
  payload: {
    from: 'client-wallet-id',
    to: 'service-wallet-id',
    amount: '1.00',
  },
};

// New x402-compliant payment requirements
const x402Requirements = {
  scheme: 'exact',
  network: 'nanda-points',
  maxAmountRequired: '1.00',
  resource: 'https://api.example.com/service',
  description: 'Service access',
  mimeType: 'application/json',
  maxTimeoutSeconds: 300,
  payTo: 'service-wallet-id',
  asset: 'NP',
};
```

### Step-by-Step Migration

#### 1. Update Payment Payload Creation

```typescript
// Migration helper function
function migrateLegacyToX402(legacyPayload: any): any {
  return {
    x402Version: 1,
    scheme: 'exact',
    network: 'nanda-points',
    payload: {
      from: legacyPayload.from,
      to: legacyPayload.to,
      amount: legacyPayload.amount,
      description: legacyPayload.description, // optional
    },
  };
}

// Before
const oldPayload = { from: 'a', to: 'b', amount: '1.00' };

// After
const newPayload = migrateLegacyToX402(oldPayload);
```

#### 2. Update Payment Requirements

```typescript
function migrateLegacyRequirements(legacy: any, serviceWallet: string): any {
  return {
    scheme: 'exact',
    network: 'nanda-points',
    maxAmountRequired: legacy.amount,
    resource: legacy.resource.startsWith('http')
      ? legacy.resource
      : `https://api.example.com${legacy.resource}`,
    description: legacy.description,
    mimeType: 'application/json',
    maxTimeoutSeconds: 300,
    payTo: serviceWallet,
    asset: 'NP',
  };
}
```

## 🧪 Testing Examples

### Unit Tests with Vitest

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NandaClient } from '@nanda/sdk';

describe('NandaClient Payment Flow', () => {
  let client: NandaClient;

  beforeEach(() => {
    client = new NandaClient({
      facilitatorUrl: 'http://localhost:3000',
      timeout: 5000,
    });
  });

  it('should verify valid x402 payment', async () => {
    const paymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'nanda-points',
      payload: {
        from: 'test-wallet-1',
        to: 'test-wallet-2',
        amount: '1.00',
      },
    };

    const paymentRequirements = {
      scheme: 'exact',
      network: 'nanda-points',
      maxAmountRequired: '1.00',
      resource: 'http://localhost:3000/test',
      description: 'Test service',
      mimeType: 'application/json',
      maxTimeoutSeconds: 300,
      payTo: 'test-wallet-2',
      asset: 'NP',
    };

    const result = await client.verifyPayment({
      paymentPayload,
      paymentRequirements,
    });

    expect(result.valid).toBe(true);
    expect(result.sessionId).toBeDefined();
  });

  it('should handle insufficient balance error', async () => {
    const paymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'nanda-points',
      payload: {
        from: 'empty-wallet',
        to: 'test-wallet',
        amount: '100.00', // More than available
      },
    };

    await expect(client.verifyPayment({
      paymentPayload,
      paymentRequirements: { /* ... */ },
    })).rejects.toThrow('Insufficient balance');
  });

  it('should complete full payment cycle', async () => {
    // Test verify → settle flow
    const verifyResult = await client.verifyPayment({ /* ... */ });
    expect(verifyResult.valid).toBe(true);

    const settleResult = await client.settlePayment({
      sessionId: verifyResult.sessionId!,
      paymentPayload: { /* ... */ },
    });

    expect(settleResult.settled).toBe(true);
    expect(settleResult.transactionId).toBeDefined();
  });
});
```

## 📖 x402 Protocol Fundamentals

### Understanding x402

The x402 protocol revives HTTP 402 "Payment Required" for internet-native micropayments:

#### Core Concepts

1. **HTTP-Native**: Uses standard HTTP status codes and headers
2. **Chain-Agnostic**: Works with any payment network (blockchain or otherwise)
3. **Verify-Settle Pattern**: Two-phase payment processing for reliability
4. **Standards-Based**: Follows established internet protocols

#### Payment Flow Diagram

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Client    │    │   Server     │    │  Facilitator    │
│  (Payer)    │    │ (Payee)      │    │  (Processor)    │
└─────┬───────┘    └──────┬───────┘    └─────────┬───────┘
      │                   │                      │
      │ 1. Request Resource │                      │
      ├──────────────────→│                      │
      │                   │                      │
      │ 2. 402 Payment Required                   │
      │←──────────────────┤                      │
      │   + PaymentRequirements                   │
      │                   │                      │
      │ 3. Create Payment Payload                 │
      │                   │                      │
      │ 4. Verify Payment  │                      │
      │←──────────────────┤─────5. Verify────────→│
      │                   │←─────Valid───────────┤
      │                   │                      │
      │ 6. Provide Resource │                      │
      │←──────────────────┤─────7. Settle────────→│
      │   + Content        │←─────Success─────────┤
      │                   │                      │
```

#### Key x402 Schemas

**PaymentRequirements** (Server → Client):
```typescript
interface PaymentRequirements {
  scheme: 'exact';              // Only 'exact' supported currently
  network: 'nanda-points';      // Custom NANDA network identifier
  maxAmountRequired: string;    // Max payment amount (decimal string)
  resource: string;             // Resource URL being protected
  description: string;          // Human-readable service description
  mimeType: string;            // Expected response content type
  maxTimeoutSeconds: number;    // Payment session timeout
  payTo: string;               // Recipient wallet identifier
  asset: 'NP';                 // Currency asset identifier
}
```

**PaymentPayload** (Client → Server):
```typescript
interface PaymentPayload {
  x402Version: 1;               // Protocol version
  scheme: 'exact';              // Payment scheme
  network: 'nanda-points';      // Network identifier
  payload: {                    // Network-specific payment data
    from: string;               // Payer wallet ID
    to: string;                 // Payee wallet ID
    amount: string;             // Payment amount (decimal string)
    description?: string;       // Optional payment memo
  };
}
```

#### Network Abstraction

x402 supports multiple payment networks through the `network` field:

```typescript
// Standard x402 networks
const standardNetworks = [
  'base', 'base-sepolia',       // Coinbase Base blockchain
  'solana', 'solana-devnet',    // Solana blockchain
  'avalanche', 'avalanche-fuji', // Avalanche blockchain
  // ... other blockchains
];

// Custom NANDA network
const nandaNetwork = 'nanda-points'; // Our custom implementation
```

This allows NANDA Points to integrate with the broader x402 ecosystem while maintaining our unique MongoDB-based architecture.

### 🔧 Working with X-PAYMENT Headers

Based on the [official x402 specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md), X-PAYMENT headers use **base64-encoded JSON** format for secure payment transmission.

#### Standard x402 X-PAYMENT Header Format

```typescript
// Standard blockchain X-PAYMENT header structure
interface X402PaymentHeader {
  x402Version: 1;
  scheme: 'exact';
  network: string;  // e.g., 'base-sepolia', 'solana-devnet'
  payload: {
    signature: string;     // Cryptographic signature (0x...)
    authorization: {
      from: string;        // Payer address (0x...)
      to: string;          // Payee address (0x...)
      value: string;       // Amount in wei/minor units
      validAfter: string;  // Unix timestamp
      validBefore: string; // Unix timestamp
      nonce: string;       // Unique nonce (0x...)
    }
  }
}
```

#### NANDA Points X-PAYMENT Header Adaptation

For NANDA Points, the header structure is simplified while maintaining x402 compliance:

```typescript
// NANDA Points adapted X-PAYMENT header
interface NandaX402PaymentHeader {
  x402Version: 1;
  scheme: 'exact';
  network: 'nanda-points';
  payload: {
    from: string;          // NANDA wallet UUID
    to: string;            // NANDA wallet UUID
    amount: string;        // Decimal amount string (e.g., '1.00')
    sessionId: string;     // Payment session identifier
    timestamp: string;     // ISO timestamp for validation
  }
}
```

#### Practical X-PAYMENT Header Usage

##### Creating X-PAYMENT Headers

```typescript
import { NandaClient } from '@nanda/sdk';

class X402HeaderUtils {
  static createNandaPaymentHeader(
    fromWallet: string,
    toWallet: string,
    amount: string,
    sessionId?: string
  ): string {
    const paymentHeader = {
      x402Version: 1,
      scheme: 'exact',
      network: 'nanda-points',
      payload: {
        from: fromWallet,
        to: toWallet,
        amount: amount,
        sessionId: sessionId || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    // Base64 encode the JSON for HTTP transmission
    return Buffer.from(JSON.stringify(paymentHeader)).toString('base64');
  }

  static decodePaymentHeader(headerValue: string): NandaX402PaymentHeader {
    try {
      const decoded = Buffer.from(headerValue, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(`Invalid X-PAYMENT header format: ${error.message}`);
    }
  }

  static validatePaymentHeader(header: any): boolean {
    return (
      header.x402Version === 1 &&
      header.scheme === 'exact' &&
      header.network === 'nanda-points' &&
      header.payload &&
      typeof header.payload.from === 'string' &&
      typeof header.payload.to === 'string' &&
      typeof header.payload.amount === 'string'
    );
  }
}
```

##### HTTP Client Integration

```typescript
// Using X-PAYMENT headers in HTTP requests
async function makePaymentEnabledRequest(
  url: string,
  paymentData: {
    fromWallet: string;
    toWallet: string;
    amount: string;
  }
) {
  // Create X-PAYMENT header
  const xPaymentHeader = X402HeaderUtils.createNandaPaymentHeader(
    paymentData.fromWallet,
    paymentData.toWallet,
    paymentData.amount
  );

  // Make HTTP request with payment header
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-PAYMENT': xPaymentHeader,
      'Accept': 'application/json',
    },
  });

  if (response.status === 402) {
    // Handle payment required
    const paymentRequired = await response.json();
    console.log('Payment required:', paymentRequired);
    throw new Error('Payment verification failed');
  }

  return response.json();
}

// Example usage
try {
  const data = await makePaymentEnabledRequest('http://api.example.com/weather', {
    fromWallet: 'client-wallet-uuid',
    toWallet: 'service-wallet-uuid',
    amount: '1.00',
  });
  console.log('Received data:', data);
} catch (error) {
  console.error('Payment request failed:', error);
}
```

##### Server-Side Header Processing

```typescript
// Processing X-PAYMENT headers on the server
import express from 'express';

const app = express();

app.use('/api/*', (req, res, next) => {
  const xPaymentHeader = req.headers['x-payment'] as string;

  if (!xPaymentHeader) {
    // Return 402 Payment Required
    return res.status(402).json({
      error: 'Payment Required',
      paymentRequirements: {
        scheme: 'exact',
        network: 'nanda-points',
        maxAmountRequired: '1.00',
        resource: req.url,
        description: 'API access fee',
        mimeType: 'application/json',
        maxTimeoutSeconds: 300,
        payTo: 'service-wallet-uuid',
        asset: 'NP',
      },
    });
  }

  try {
    // Decode and validate payment header
    const paymentData = X402HeaderUtils.decodePaymentHeader(xPaymentHeader);

    if (!X402HeaderUtils.validatePaymentHeader(paymentData)) {
      return res.status(400).json({ error: 'Invalid X-PAYMENT header format' });
    }

    // Process payment verification with NANDA facilitator
    // (Implementation would use NandaClient here)

    // Attach payment info to request for downstream handlers
    req.paymentInfo = paymentData.payload;
    next();

  } catch (error) {
    return res.status(400).json({ error: 'Malformed X-PAYMENT header' });
  }
});

app.get('/api/weather', (req, res) => {
  // Payment was verified by middleware
  res.json({
    temperature: '22°C',
    condition: 'Sunny',
    paid: true,
    paymentInfo: req.paymentInfo, // Payment details from header
  });
});
```

#### Key Implementation Notes

1. **Always Base64 Encode**: X-PAYMENT headers must be base64-encoded JSON
2. **Validate Format**: Check x402Version, scheme, and network fields
3. **Handle Errors Gracefully**: Invalid headers should return 400 Bad Request
4. **Security**: Never trust header data without validation
5. **Size Limits**: Keep headers under 8KB to avoid HTTP limits
6. **NANDA Adaptation**: Use UUIDs instead of blockchain addresses
7. **Session Management**: Include sessionId for payment tracking

## 📞 Support & Resources

- **📖 Documentation**: [NANDA Developer Docs](https://docs.nanda.org)
- **🐛 Issues**: [GitHub Issues](https://github.com/nanda/ts-facilitator/issues)
- **💬 Discord**: [NANDA Community](https://discord.gg/nanda)
- **📧 Email**: [support@nanda.org](mailto:support@nanda.org)

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by the NANDA team**

[![GitHub stars](https://img.shields.io/github/stars/nanda/ts-facilitator?style=social)](https://github.com/nanda/ts-facilitator)
[![Twitter Follow](https://img.shields.io/twitter/follow/nanda_network?style=social)](https://twitter.com/nanda_network)

</div>