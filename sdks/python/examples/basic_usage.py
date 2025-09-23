"""
Basic usage example for NANDA Payments Python SDK
"""

import asyncio
from nanda_payments import NandaPaymentsClient, PaymentOptions


async def basic_example():
    """Basic payment operations example"""
    print("🐍 NANDA Payments Python SDK Example")
    print("=====================================\n")

    # Create a client using async context manager
    async with NandaPaymentsClient(
        agent_name="python-example",
        facilitator_url="http://localhost:3001",
        timeout=30.0,
    ) as client:

        # Test connection
        print("Testing connection...")
        is_connected = await client.test_connection()
        print(f"Connection: {'✅ Success' if is_connected else '❌ Failed'}\n")

        if not is_connected:
            print("⚠️  Make sure the facilitator is running on localhost:3001")
            return

        # Get supported schemes
        print("Getting supported payment schemes...")
        try:
            supported = await client.get_supported_schemes()
            print(f"Supported schemes: {len(supported.kinds)}\n")
        except Exception as e:
            print(f"Failed to get supported schemes: {e}\n")

        # Get balance (this would normally require the agent to be registered)
        print("Getting agent balance...")
        try:
            balance = await client.get_balance()
            print(f"Current balance: {balance.balance} {balance.currency}\n")
        except Exception as e:
            print(f"Could not get balance: {e}")
            print("(This is expected if the agent is not registered)\n")

        # Create a payment (without sending it)
        print("Creating a payment payload...")
        payment = await client.create_payment(
            PaymentOptions(
                amount=10,
                recipient="content-provider",
                description="Example payment"
            )
        )
        print(f"Payment created: {payment.tx_id}")
        print(f"Amount: {payment.amount} NP")
        print(f"From: {payment.from_agent}")
        print(f"To: {payment.pay_to}\n")

        # Example of making a request that would require payment
        print("Example payment request (will fail without real service)...")
        try:
            response = await client.make_payment_request(
                "https://api.example.com/premium-content",
                PaymentOptions(
                    amount=5,
                    recipient="api-provider",
                    description="API access"
                ),
                method="GET"
            )
            print(f"Response status: {response.status}")
            if response.payment_response:
                print(f"Payment completed: {response.payment_response}")
        except Exception as e:
            print(f"Payment request failed (expected): {e}")

    print("\n🎉 Example completed!")


async def agent_management_example():
    """Agent management operations example"""
    print("\n📊 Agent Management Example")
    print("============================\n")

    async with NandaPaymentsClient(
        agent_name="python-agent",
        facilitator_url="http://localhost:3001",
    ) as client:

        try:
            # Try to get agent summary
            print("Getting agent summary...")
            summary = await client.get_summary()
            print(f"Balance: {summary['balance']} NP")
            print(f"Total sent: {summary['total_sent']} NP")
            print(f"Total received: {summary['total_received']} NP")
            print(f"Transaction count: {summary['transaction_count']}")
            print(f"Last activity: {summary['last_activity'] or 'None'}\n")

        except Exception as e:
            print(f"Could not get agent summary: {e}")
            print("(This is expected if the agent is not registered)\n")

        try:
            # Try to get transaction history
            print("Getting transaction history...")
            from nanda_payments.types import TransactionQuery

            transactions = await client.get_transaction_history(
                TransactionQuery(limit=5)
            )
            print(f"Found {len(transactions)} recent transactions")
            for tx in transactions[:3]:  # Show first 3
                print(f"  {tx.tx_id}: {tx.amount_minor} NP from {tx.from_agent} to {tx.to_agent}")

        except Exception as e:
            print(f"Could not get transaction history: {e}")
            print("(This is expected if the agent has no transactions)")


async def fastapi_example():
    """Example of FastAPI integration"""
    print("\n🚀 FastAPI Integration Example")
    print("===============================\n")

    try:
        from fastapi import FastAPI, Depends
        from nanda_payments.integrations.fastapi import NandaPaymentsDependency, payment_required

        print("FastAPI integration is available!")
        print("Example usage:")
        print("""
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
        """)

    except ImportError:
        print("FastAPI is not installed. Install with: pip install fastapi")


if __name__ == "__main__":
    async def main():
        await basic_example()
        await agent_management_example()
        await fastapi_example()

    asyncio.run(main())