# @nanda/payments-sdk

TypeScript SDK for NANDA Points payments with x402 protocol support.

## Installation

```bash
npm install @nanda/payments-sdk
```

## Quick Start

```typescript
import { NandaPaymentsClient } from '@nanda/payments-sdk';

const client = new NandaPaymentsClient({
  agentName: 'my-app',
  facilitatorUrl: 'http://localhost:3001'
});

// Make a request that may require payment
const response = await client.makeRequest('http://api.example.com/premium');
if (response.status === 402) {
  // Payment required - handle payment
  const paidResponse = await client.makePaymentRequest(
    'http://api.example.com/premium',
    { amount: 10, recipient: 'api-provider' }
  );
}

// Check your balance
const balance = await client.getBalance();
console.log(`Current balance: ${balance.balance} NP`);
```

## Features

- **x402 Protocol Support**: Full compliance with HTTP 402 Payment Required
- **Automatic Payment Handling**: Seamlessly handle payment flows
- **Agent Management**: Balance checking and transaction history
- **TypeScript Support**: Full type safety and IntelliSense
- **Retry Logic**: Built-in retry and error handling
- **Testing Utilities**: Mock facilitator for development and testing

## API Reference

### NandaPaymentsClient

#### Constructor

```typescript
new NandaPaymentsClient(config: NandaPaymentsClientConfig)
```

**Config Options:**
- `agentName: string` - Your agent identifier
- `facilitatorUrl: string` - URL of the NANDA Points facilitator
- `timeout?: number` - Request timeout in milliseconds (default: 30000)
- `retryCount?: number` - Number of retry attempts (default: 3)
- `retryDelay?: number` - Delay between retries in milliseconds (default: 1000)

#### Payment Methods

##### makeRequest(url, options?)

Make an x402-compliant request. Returns response with payment requirements if payment is needed.

```typescript
const response = await client.makeRequest('https://api.example.com/data', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
});

if (response.status === 402) {
  // Handle payment required
}
```

##### makePaymentRequest(url, paymentOptions, requestOptions?)

Automatically handle payment flow for requests that require payment.

```typescript
const response = await client.makePaymentRequest(
  'https://api.example.com/premium',
  {
    amount: 10,
    recipient: 'api-provider',
    description: 'API access'
  },
  {
    method: 'POST',
    body: { query: 'data' }
  }
);
```

##### createPayment(options)

Create a payment payload for manual handling.

```typescript
const payment = await client.createPayment({
  amount: 5,
  recipient: 'service-provider',
  description: 'Service fee'
});
```

#### Agent Management

##### getBalance()

Get current agent balance.

```typescript
const balance = await client.getBalance();
console.log(`Balance: ${balance.balance} ${balance.currency}`);
```

##### getTransactionHistory(query?)

Get transaction history with optional filtering.

```typescript
const transactions = await client.getTransactionHistory({
  limit: 10,
  fromDate: new Date('2024-01-01'),
  status: 'completed'
});
```

##### getSummary()

Get agent summary with key metrics.

```typescript
const summary = await client.getSummary();
console.log(`Total sent: ${summary.totalSent} NP`);
console.log(`Total received: ${summary.totalReceived} NP`);
```

#### Utility Methods

##### testConnection()

Test connection to the facilitator.

```typescript
const isConnected = await client.testConnection();
```

##### checkFacilitatorHealth()

Check facilitator health status.

```typescript
const health = await client.checkFacilitatorHealth();
console.log(`Status: ${health.status}`);
```

## Testing

The SDK includes testing utilities for development and testing:

```typescript
import { createMockFacilitator, createTestPaymentGenerator } from '@nanda/payments-sdk/testing';

// Create a mock facilitator for testing
const mockFacilitator = createMockFacilitator({ port: 3001 });
await mockFacilitator.start();

// Set up test data
mockFacilitator.setAgentBalance('test-agent', 1000);

// Create client pointing to mock
const client = new NandaPaymentsClient({
  agentName: 'test-agent',
  facilitatorUrl: 'http://localhost:3001'
});

// Run tests...

await mockFacilitator.stop();
```

## Error Handling

The SDK provides specific error types for different scenarios:

```typescript
import {
  NPPaymentError,
  NPVerificationError,
  NPSettlementError,
  NPNetworkError,
  NPTimeoutError
} from '@nanda/payments-sdk';

try {
  await client.makePaymentRequest(url, paymentOptions);
} catch (error) {
  if (error instanceof NPVerificationError) {
    console.log('Payment verification failed:', error.message);
  } else if (error instanceof NPNetworkError) {
    console.log('Network error:', error.message);
  }
}
```

## Examples

See the [examples](./examples/) directory for complete usage examples:

- [Basic Usage](./examples/basic-usage.ts) - Simple payment flows
- [Advanced Features](./examples/advanced-features.ts) - Advanced SDK features

## License

MIT