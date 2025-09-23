# NANDA Points SDKs

This directory contains client SDKs for NANDA Points payments with x402 protocol support. The SDKs provide language-native interfaces to integrate NANDA Points payments without understanding protocol details.

## Available SDKs

### TypeScript SDK (`@nanda/payments-sdk`)

**Location**: `sdks/typescript/`
**Package**: `@nanda/payments-sdk`
**Platform**: npm

Full-featured TypeScript SDK with complete x402 protocol support:

- Complete x402 protocol client implementation
- Facilitator API wrapper with automatic retry logic
- Agent balance management and transaction history
- TypeScript definitions and full IntelliSense support
- Testing utilities and mock facilitator
- Works in Node.js environments

**Installation**:
```bash
npm install @nanda/payments-sdk
```

**Quick Start**:
```typescript
import { NandaPaymentsClient } from '@nanda/payments-sdk';

const client = new NandaPaymentsClient({
  agentName: 'my-app',
  facilitatorUrl: 'http://localhost:3001'
});

const response = await client.makePaymentRequest(
  'https://api.example.com/premium',
  { amount: 10, recipient: 'api-provider' }
);
```

### Python SDK (`nanda-payments`)

**Location**: `sdks/python/`
**Package**: `nanda-payments`
**Platform**: PyPI

Async-first Python SDK with framework integrations:

- Python-native async/await API design
- Type hints and Pydantic model validation
- FastAPI, Django, and Flask integrations
- Context managers for resource cleanup
- Full mypy compatibility
- Works with Python 3.8+

**Installation**:
```bash
pip install nanda-payments
```

**Quick Start**:
```python
import asyncio
from nanda_payments import NandaPaymentsClient, PaymentOptions

async def main():
    async with NandaPaymentsClient(
        agent_name="my-app",
        facilitator_url="http://localhost:3001"
    ) as client:
        response = await client.make_payment_request(
            "https://api.example.com/premium",
            PaymentOptions(amount=10, recipient="api-provider")
        )

asyncio.run(main())
```

## Common Features

Both SDKs provide the same core functionality:

### Payment Operations
- **x402 Compliance**: Full HTTP 402 Payment Required protocol support
- **Automatic Payment Handling**: Seamless payment flows with retry logic
- **Manual Payment Creation**: Create payment payloads for custom handling

### Agent Management
- **Balance Checking**: Get current NANDA Points balance
- **Transaction History**: Query and filter transaction records
- **Agent Registration**: Register and manage agent information

### Facilitator Integration
- **API Wrapper**: Type-safe facilitator API communication
- **Health Checking**: Monitor facilitator service status
- **Error Handling**: Comprehensive error types and retry logic

### Testing Support
- **Mock Facilitator**: Built-in mock server for development and testing
- **Test Utilities**: Helper functions for creating test payments
- **Integration Tests**: Framework-specific testing utilities

## Architecture

Both SDKs follow the same architectural patterns:

```
┌─────────────────────┐    ┌─────────────────────┐
│   Your Application │    │   NANDA Points      │
│                     │    │   Facilitator       │
└─────────┬───────────┘    └─────────┬───────────┘
          │                          │
          │ x402 requests            │ /verify
          ▼                          │ /settle
┌─────────────────────┐              │ /supported
│   Payment Client    │──────────────┘
│                     │
│ ┌─────────────────┐ │
│ │ Facilitator API │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ Agent Manager   │ │
│ └─────────────────┘ │
└─────────────────────┘
```

### Core Components

1. **Payment Client**: Handles x402-compliant HTTP requests with automatic payment
2. **Facilitator API**: Manages communication with the NANDA Points facilitator
3. **Agent Manager**: Provides balance and transaction management utilities

## Usage Patterns

### Basic Payment Flow

1. **Make Request**: Attempt to access a paid resource
2. **Handle 402**: Process Payment Required response
3. **Create Payment**: Generate payment payload
4. **Verify Payment**: Confirm payment with facilitator
5. **Retry Request**: Make request again with payment
6. **Settle Payment**: Complete transaction after successful response

### Agent Operations

1. **Check Balance**: Verify sufficient NANDA Points
2. **View History**: Review past transactions
3. **Monitor Activity**: Track payment flows

## Configuration

Both SDKs support the same configuration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentName` | string | - | Your agent identifier |
| `facilitatorUrl` | string | - | Facilitator service URL |
| `timeout` | number | 30000 | Request timeout (ms/seconds) |
| `retryCount` | number | 3 | Number of retry attempts |
| `retryDelay` | number | 1000 | Delay between retries (ms/seconds) |

## Error Handling

Both SDKs provide consistent error types:

- **NPPaymentError**: Base payment-related error
- **NPVerificationError**: Payment verification failed
- **NPSettlementError**: Payment settlement failed
- **NPNetworkError**: Network or HTTP error
- **NPTimeoutError**: Request timeout

## Development and Testing

Each SDK includes comprehensive testing utilities:

- **Mock Facilitator**: Simulate facilitator responses
- **Test Generators**: Create test payment data
- **Integration Helpers**: Framework-specific testing support

## Framework Integrations

### TypeScript
- Express.js middleware patterns
- Next.js API route integration
- Fastify plugin support

### Python
- **FastAPI**: Dependencies and middleware
- **Django**: Middleware and decorators (planned)
- **Flask**: Extensions and decorators (planned)

## Migration from Manual Integration

Both SDKs are designed to replace manual x402 protocol implementation:

**Before (Manual)**:
```javascript
// Complex manual x402 handling
const response = await fetch(url);
if (response.status === 402) {
  const paymentReq = await response.json();
  const payment = createPayment(paymentReq);
  const verification = await verifyPayment(payment);
  // ... more manual steps
}
```

**After (SDK)**:
```javascript
// Simple SDK call
const response = await client.makePaymentRequest(url, paymentOptions);
```

## Documentation

- **TypeScript**: See `sdks/typescript/README.md`
- **Python**: See `sdks/python/README.md`
- **Examples**: Each SDK includes comprehensive examples
- **API Reference**: Full API documentation in each SDK

## Support

- **Issues**: Report issues in the main repository
- **Examples**: See SDK-specific example directories
- **Testing**: Use provided mock utilities for development

## Roadmap

### Planned SDKs
- **Go SDK**: High-performance applications
- **Rust SDK**: Systems programming
- **JavaScript SDK**: Browser environments

### Framework Extensions
- React hooks and components
- Vue.js composables
- Angular services
- Django REST framework integration

### Advanced Features
- Payment analytics and reporting
- Webhook handling utilities
- Connection pooling optimization
- Circuit breaker patterns