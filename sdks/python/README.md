# nanda-payments

Python SDK for NANDA Points payments with x402 protocol support.

## Installation

```bash
pip install nanda-payments
```

### Optional Dependencies

Install with framework-specific dependencies:

```bash
# For FastAPI integration
pip install nanda-payments[fastapi]

# For Django integration
pip install nanda-payments[django]

# For Flask integration
pip install nanda-payments[flask]

# For development
pip install nanda-payments[dev]
```

## Quick Start

```python
import asyncio
from nanda_payments import NandaPaymentsClient, PaymentOptions

async def main():
    # Create a client using async context manager
    async with NandaPaymentsClient(
        agent_name="my-app",
        facilitator_url="http://localhost:3001"
    ) as client:

        # Make a request that may require payment
        response = await client.make_request("http://api.example.com/premium")
        if response.status == 402:
            # Payment required - handle payment
            paid_response = await client.make_payment_request(
                "http://api.example.com/premium",
                PaymentOptions(amount=10, recipient="api-provider")
            )

        # Check your balance
        balance = await client.get_balance()
        print(f"Current balance: {balance.balance} NP")

asyncio.run(main())
```

## Features

- **Async/Await Support**: Built with asyncio for high-performance async operations
- **x402 Protocol Support**: Full compliance with HTTP 402 Payment Required
- **Automatic Payment Handling**: Seamlessly handle payment flows
- **Type Safety**: Full type hints with Pydantic models
- **Framework Integrations**: Built-in support for FastAPI, Django, and Flask
- **Retry Logic**: Built-in retry and error handling
- **Context Managers**: Proper resource management with async context managers

## API Reference

### NandaPaymentsClient

#### Initialization

```python
async with NandaPaymentsClient(
    agent_name="my-app",              # Your agent identifier
    facilitator_url="http://localhost:3001",  # Facilitator URL
    timeout=30.0,                     # Request timeout in seconds
    retry_count=3,                    # Number of retry attempts
    retry_delay=1.0,                  # Delay between retries in seconds
) as client:
    # Use the client
    pass
```

#### Payment Methods

##### make_request()

Make an x402-compliant request:

```python
response = await client.make_request(
    "https://api.example.com/data",
    method="GET",
    headers={"Authorization": "Bearer token"},
    json_data={"query": "data"}
)

if response.status == 402:
    # Handle payment required
    payment_required = response.payment_required
```

##### make_payment_request()

Automatically handle payment flow:

```python
response = await client.make_payment_request(
    "https://api.example.com/premium",
    PaymentOptions(
        amount=10,
        recipient="api-provider",
        description="API access"
    ),
    method="POST",
    json_data={"query": "premium data"}
)
```

##### create_payment()

Create a payment payload for manual handling:

```python
payment = await client.create_payment(
    PaymentOptions(
        amount=5,
        recipient="service-provider",
        description="Service fee"
    )
)
```

#### Agent Management

##### get_balance()

```python
balance = await client.get_balance()
print(f"Balance: {balance.balance} {balance.currency}")
```

##### get_transaction_history()

```python
from nanda_payments.types import TransactionQuery

transactions = await client.get_transaction_history(
    TransactionQuery(
        limit=10,
        status="completed",
        direction="sent"
    )
)
```

##### get_summary()

```python
summary = await client.get_summary()
print(f"Total sent: {summary['total_sent']} NP")
print(f"Total received: {summary['total_received']} NP")
```

#### Utility Methods

##### test_connection()

```python
is_connected = await client.test_connection()
```

##### check_facilitator_health()

```python
health = await client.check_facilitator_health()
print(f"Status: {health['status']}")
```

## Framework Integrations

### FastAPI

```python
from fastapi import FastAPI, Depends
from nanda_payments.integrations.fastapi import NandaPaymentsDependency, payment_required

app = FastAPI()

# Initialize dependency
nanda_dependency = NandaPaymentsDependency(
    agent_name="my-api",
    facilitator_url="http://localhost:3001"
)

@app.get("/premium")
async def premium_content(
    payment_verified = Depends(payment_required(10, "api-provider")),
    client = Depends(nanda_dependency)
):
    return {"message": "This is premium content!"}

# Add middleware for automatic payment settlement
from nanda_payments.integrations.fastapi import NandaPaymentsMiddleware
app.add_middleware(NandaPaymentsMiddleware)
```

### Django (Coming Soon)

```python
# Django integration will be available in a future release
```

### Flask (Coming Soon)

```python
# Flask integration will be available in a future release
```

## Type System

The SDK uses Pydantic models for type safety:

```python
from nanda_payments.types import (
    PaymentOptions,
    PaymentPayload,
    TransactionQuery,
    BalanceInfo,
    Transaction,
)

# All models have full type hints and validation
payment_options = PaymentOptions(
    amount=10,
    recipient="service-provider",
    description="Payment for service"
)
```

## Error Handling

The SDK provides specific exception types:

```python
from nanda_payments.types import (
    NPPaymentError,
    NPVerificationError,
    NPSettlementError,
    NPNetworkError,
    NPTimeoutError,
)

try:
    await client.make_payment_request(url, payment_options)
except NPVerificationError as e:
    print(f"Payment verification failed: {e.code}")
except NPNetworkError as e:
    print(f"Network error: {e}")
except NPTimeoutError as e:
    print(f"Request timed out: {e}")
```

## Examples

See the [examples](./examples/) directory for complete usage examples:

- [Basic Usage](./examples/basic_usage.py) - Simple payment flows and agent management
- [FastAPI Integration](./examples/fastapi_example.py) - FastAPI payment middleware

## Development

Install development dependencies:

```bash
pip install -e ".[dev]"
```

Run tests:

```bash
pytest
```

Format code:

```bash
black nanda_payments/
isort nanda_payments/
```

Type checking:

```bash
mypy nanda_payments/
```

## License

MIT