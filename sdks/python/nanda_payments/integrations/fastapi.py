"""
FastAPI integration for NANDA Payments
"""

from typing import Any, Dict, Optional

try:
    from fastapi import Depends, HTTPException, Request
    from fastapi.responses import JSONResponse
except ImportError:
    raise ImportError(
        "FastAPI is required for this integration. Install with: pip install fastapi"
    )

from ..main import NandaPaymentsClient
from ..types import PaymentOptions, NPPaymentError


class NandaPaymentsDependency:
    """FastAPI dependency for NANDA Payments"""

    def __init__(
        self,
        agent_name: str,
        facilitator_url: str,
        *,
        timeout: float = 30.0,
        retry_count: int = 3,
        retry_delay: float = 1.0,
    ):
        """
        Initialize the dependency.

        Args:
            agent_name: Name of your agent
            facilitator_url: URL of the NANDA Points facilitator
            timeout: Request timeout in seconds
            retry_count: Number of retry attempts
            retry_delay: Delay between retries in seconds
        """
        self.config = {
            "agent_name": agent_name,
            "facilitator_url": facilitator_url,
            "timeout": timeout,
            "retry_count": retry_count,
            "retry_delay": retry_delay,
        }

    async def __call__(self, request: Request) -> NandaPaymentsClient:
        """Create and return a NANDA Payments client"""
        # Check if we already have a client in the request state
        if not hasattr(request.state, "nanda_client"):
            request.state.nanda_client = NandaPaymentsClient(**self.config)

        return request.state.nanda_client


def payment_required(
    amount: int,
    recipient: str,
    description: Optional[str] = None,
):
    """
    FastAPI decorator to require payment for an endpoint.

    Args:
        amount: Payment amount in NANDA Points
        recipient: Payment recipient agent name
        description: Optional payment description

    Returns:
        FastAPI dependency that handles payment verification

    Example:
        ```python
        from fastapi import FastAPI, Depends
        from nanda_payments.integrations.fastapi import payment_required

        app = FastAPI()

        @app.get("/premium-content")
        async def get_premium_content(
            payment_verified = Depends(payment_required(10, "content-provider"))
        ):
            return {"message": "This is premium content!"}
        ```
    """

    async def verify_payment(request: Request) -> Dict[str, Any]:
        """Verify payment for the request"""
        # Get the NANDA client from the request state
        if not hasattr(request.state, "nanda_client"):
            raise HTTPException(
                status_code=500,
                detail="NANDA Payments client not initialized. Use NandaPaymentsDependency first."
            )

        client: NandaPaymentsClient = request.state.nanda_client

        # Check for X-PAYMENT header
        payment_header = request.headers.get("X-PAYMENT")
        if not payment_header:
            # Return 402 Payment Required
            return JSONResponse(
                status_code=402,
                content={
                    "x402Version": 1,
                    "error": "X-PAYMENT header is required",
                    "accepts": [
                        {
                            "scheme": "nanda-points",
                            "network": "nanda-network",
                            "maxAmountRequired": str(amount),
                            "resource": str(request.url),
                            "description": description or f"Payment of {amount} NP required",
                            "mimeType": "application/json",
                            "payTo": recipient,
                            "maxTimeoutSeconds": 60,
                            "asset": "NP",
                            "extra": {
                                "facilitatorUrl": client.facilitator.base_url,
                            },
                        }
                    ],
                },
            )

        try:
            # Decode and verify payment
            import base64
            import json

            decoded = base64.b64decode(payment_header).decode()
            payment_data = json.loads(decoded)

            # Create payment payload object
            from ..types import PaymentPayload
            payment = PaymentPayload.parse_obj(payment_data)

            # Create payment requirements
            from ..types import PaymentRequirements
            requirements = PaymentRequirements(
                scheme="nanda-points",
                network="nanda-network",
                max_amount_required=str(amount),
                resource=str(request.url),
                description=description or f"Payment of {amount} NP required",
                mime_type="application/json",
                pay_to=recipient,
                max_timeout_seconds=60,
                asset="NP",
                extra={"facilitatorUrl": client.facilitator.base_url},
            )

            # Verify payment
            verification = await client.facilitator.verify(payment, requirements)
            if not verification.is_valid:
                return JSONResponse(
                    status_code=402,
                    content={
                        "x402Version": 1,
                        "error": verification.invalid_reason,
                        "accepts": [requirements.dict(by_alias=True)],
                        "payer": verification.payer,
                    },
                )

            # Store payment info for potential settlement
            request.state.payment = payment
            request.state.payment_requirements = requirements

            return {
                "payment_verified": True,
                "tx_id": payment.tx_id,
                "amount": payment.amount,
                "from": payment.from_agent,
            }

        except Exception as e:
            return JSONResponse(
                status_code=402,
                content={
                    "x402Version": 1,
                    "error": f"Invalid payment header: {str(e)}",
                    "accepts": [
                        {
                            "scheme": "nanda-points",
                            "network": "nanda-network",
                            "maxAmountRequired": str(amount),
                            "resource": str(request.url),
                            "description": description or f"Payment of {amount} NP required",
                            "mimeType": "application/json",
                            "payTo": recipient,
                            "maxTimeoutSeconds": 60,
                            "asset": "NP",
                        }
                    ],
                },
            )

    return Depends(verify_payment)


class NandaPaymentsMiddleware:
    """FastAPI middleware for automatic payment settlement"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        """ASGI middleware implementation"""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Capture the response to check if payment settlement is needed
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # Check if this was a successful response with payment
                status = message.get("status", 500)
                if status < 400:
                    # Try to settle payment if we have payment info
                    request_scope = scope
                    if hasattr(request_scope.get("state"), "payment"):
                        try:
                            client = request_scope["state"].nanda_client
                            payment = request_scope["state"].payment
                            requirements = request_scope["state"].payment_requirements

                            settlement = await client.facilitator.settle(payment, requirements)
                            if settlement.success:
                                # Add payment response header
                                import base64
                                import json

                                response_data = {
                                    "txId": settlement.tx_id,
                                    "amount": settlement.amount,
                                    "from": settlement.from_agent,
                                    "to": settlement.to_agent,
                                    "timestamp": settlement.timestamp,
                                }
                                payment_header = base64.b64encode(
                                    json.dumps(response_data).encode()
                                ).decode()

                                # Add header to response
                                headers = list(message.get("headers", []))
                                headers.append(
                                    (b"x-payment-response", payment_header.encode())
                                )
                                message["headers"] = headers
                        except Exception:
                            # Don't fail the response for settlement issues
                            pass

            await send(message)

        await self.app(scope, receive, send_wrapper)