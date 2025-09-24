# @nanda/sdk

JavaScript/TypeScript client SDK for the NANDA Facilitator x402 payment system.

## Installation

```bash
npm install @nanda/sdk
```

## Quick Start

```typescript
import { NandaClient } from '@nanda/sdk';

// Create client instance
const client = new NandaClient({
  facilitatorUrl: 'http://localhost:3000',
  timeout: 10000, // 10 seconds
});

// Check agent balance
const balance = await client.getAgentBalance('my-agent');
console.log(`Balance: ${balance.balance.formatted}`);

// List recent transactions
const transactions = await client.listTransactions({
  agent: 'my-agent',
  limit: 10,
});
console.log(`Found ${transactions.total} transactions`);
```

## Features

- ✅ **Type-safe**: Full TypeScript support with Zod validation
- ✅ **x402 Compatible**: Built for HTTP 402 Payment Required protocol
- ✅ **Error Handling**: Comprehensive error types and handling
- ✅ **Timeout Support**: Configurable request timeouts
- ✅ **Network Statistics**: Built-in analytics and reporting
- ✅ **Balance Management**: Real-time agent balance queries
- ✅ **Transaction History**: Full transaction lifecycle tracking

## API Reference

### NandaClient

Main client class for interacting with the NANDA Facilitator.

#### Constructor

```typescript
const client = new NandaClient({
  facilitatorUrl: string;     // NANDA Facilitator URL
  apiKey?: string;           // Optional API key for authentication
  timeout?: number;          // Request timeout in milliseconds (default: 10000)
});
```

#### Methods

##### Health Check

```typescript
await client.health();
// Returns: { status: string; timestamp: string }
```

##### Agent Balance

```typescript
await client.getAgentBalance(agentName: string);
// Returns: {
//   agent_name: string;
//   walletId: string;
//   balance: {
//     balanceMinor: number;    // Balance in minor units (1 NP = 100 minor)
//     balanceNP: number;       // Balance in NANDA Points
//     formatted: string;       // Human-readable format
//   };
// }
```

##### Transaction History

```typescript
await client.listTransactions({
  agent?: string;     // Filter by agent name
  limit?: number;     // Number of results (default: 20)
  offset?: number;    // Pagination offset
});
// Returns: {
//   transactions: TransactionResponse[];
//   total: number;
// }
```

##### Network Statistics

```typescript
await client.getNetworkStats();
// Returns: {
//   totalAgents: number;
//   totalTransactions: number;
//   totalVolume: number;
//   averageTransactionAmount: number;
//   topAgentsByVolume: Array<{
//     agent_name: string;
//     totalVolume: number;
//     transactionCount: number;
//   }>;
// }
```

##### x402 Payment Verification

```typescript
await client.verifyPayment({
  paymentPayload: x402PaymentPayload;
  paymentRequirements: x402PaymentRequirements;
});
// Returns: {
//   valid: boolean;
//   sessionId?: string;
//   reason?: string;
//   expiresAt?: string;
// }
```

##### x402 Payment Settlement

```typescript
await client.settlePayment({
  sessionId: string;
  paymentPayload: x402PaymentPayload;
});
// Returns: {
//   settled: boolean;
//   transactionId?: string;
//   reason?: string;
//   balance?: {
//     from: number;
//     to: number;
//   };
// }
```

##### Direct Payments (Non-x402)

```typescript
await client.createDirectPayment({
  fromAgent: 'sender-agent';
  toAgent: 'recipient-agent';
  amount: 10.50;              // Amount in NANDA Points
  resource: '/api/search';     // Resource being paid for
  description?: string;        // Optional description
});
// Returns: TransactionResponse
```

### Utility Functions

```typescript
// Convert between NP and minor units
NandaClient.toMinorUnits(10.50);     // Returns: 1050
NandaClient.fromMinorUnits(1050);    // Returns: 10.50
NandaClient.formatNP(10.50);         // Returns: "10.50 NP"
```

## Error Handling

The SDK throws `NandaSDKError` for all API-related errors:

```typescript
import { NandaSDKError } from '@nanda/sdk';

try {
  await client.getAgentBalance('nonexistent-agent');
} catch (error) {
  if (error instanceof NandaSDKError) {
    console.log(`Error: ${error.message}`);
    console.log(`Status: ${error.statusCode}`);
    console.log(`Code: ${error.code}`);
  }
}
```

## Examples

### Basic Agent Dashboard

```typescript
import { NandaClient } from '@nanda/sdk';

async function createAgentDashboard(agentName: string) {
  const client = new NandaClient({
    facilitatorUrl: process.env.NANDA_FACILITATOR_URL || 'http://localhost:3000',
  });

  try {
    // Get agent balance
    const balance = await client.getAgentBalance(agentName);
    console.log(`💰 Balance: ${balance.balance.formatted}`);

    // Get recent transactions
    const transactions = await client.listTransactions({
      agent: agentName,
      limit: 5,
    });

    console.log(`📊 Recent Transactions (${transactions.total} total):`);
    for (const tx of transactions.transactions) {
      const type = tx.metadata.agent_from === agentName ? 'sent' : 'received';
      const amount = NandaClient.formatNP(NandaClient.fromMinorUnits(tx.amount));
      console.log(`  ${type === 'sent' ? '→' : '←'} ${amount} - ${tx.metadata.description}`);
    }

  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

createAgentDashboard('my-agent');
```

### x402 Payment Flow

```typescript
import { NandaClient } from '@nanda/sdk';
import { createExactPaymentRequirements } from 'x402';

async function handleX402Payment() {
  const client = new NandaClient({
    facilitatorUrl: 'http://localhost:3000',
  });

  // Create payment requirements
  const paymentRequirements = createExactPaymentRequirements(
    '10.50',                    // Amount in NP
    'nanda-network',           // Network identifier
    'http://localhost:3000/api/search',  // Resource
    'AI Search Service'        // Description
  );

  // Client creates payment payload (would come from x402 client)
  const paymentPayload = {
    /* x402 payment payload from client */
  };

  try {
    // Step 1: Verify payment
    const verification = await client.verifyPayment({
      paymentPayload,
      paymentRequirements,
    });

    if (!verification.valid) {
      throw new Error(`Payment verification failed: ${verification.reason}`);
    }

    console.log(`✅ Payment verified. Session: ${verification.sessionId}`);

    // Step 2: Settle payment
    const settlement = await client.settlePayment({
      sessionId: verification.sessionId!,
      paymentPayload,
    });

    if (!settlement.settled) {
      throw new Error(`Payment settlement failed: ${settlement.reason}`);
    }

    console.log(`✅ Payment settled. Transaction: ${settlement.transactionId}`);

  } catch (error) {
    console.error('Payment error:', error);
  }
}
```

### Network Monitoring

```typescript
import { NandaClient } from '@nanda/sdk';

async function monitorNetwork() {
  const client = new NandaClient({
    facilitatorUrl: 'http://localhost:3000',
  });

  setInterval(async () => {
    try {
      const stats = await client.getNetworkStats();

      console.log('📈 Network Statistics:');
      console.log(`  Agents: ${stats.totalAgents}`);
      console.log(`  Transactions: ${stats.totalTransactions.toLocaleString()}`);
      console.log(`  Volume: ${NandaClient.formatNP(NandaClient.fromMinorUnits(stats.totalVolume))}`);
      console.log(`  Avg Transaction: ${NandaClient.formatNP(NandaClient.fromMinorUnits(stats.averageTransactionAmount))}`);

    } catch (error) {
      console.error('Monitoring error:', error);
    }
  }, 30000); // Every 30 seconds
}

monitorNetwork();
```

## License

MIT