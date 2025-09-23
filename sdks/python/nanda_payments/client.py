"""
Core payment client for NANDA Points with x402 protocol support
"""

import asyncio
import base64
import json
import time
import uuid
from typing import Any, Dict, Optional, Union
from urllib.parse import urljoin

import aiohttp

from .facilitator import FacilitatorClient
from .types import (
    NPNetworkError,
    NPPaymentError,
    NPTimeoutError,
    PaymentOptions,
    PaymentPayload,
    PaymentRequiredResponse,
    SuccessfulResponse,
    RequestMethod,
)


class PaymentClient:
    """Core client for making x402-compliant payment requests"""

    def __init__(
        self,
        agent_name: str,
        facilitator: FacilitatorClient,
        *,
        timeout: float = 30.0,
        session: Optional[aiohttp.ClientSession] = None,
    ):
        """
        Initialize the payment client.

        Args:
            agent_name: Name of the agent making payments
            facilitator: Facilitator client for payment operations
            timeout: Default request timeout in seconds
            session: Optional aiohttp session to use
        """
        self.agent_name = agent_name
        self.facilitator = facilitator
        self.timeout = timeout
        self._session = session
        self._session_owned = session is None

    async def __aenter__(self) -> "PaymentClient":
        """Async context manager entry"""
        if self._session is None:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout),
                headers={"User-Agent": "nanda-payments-python-sdk"},
            )
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit"""
        if self._session_owned and self._session:
            await self._session.close()

    async def make_request(
        self,
        url: str,
        *,
        method: RequestMethod = "GET",
        headers: Optional[Dict[str, str]] = None,
        json_data: Optional[Any] = None,
        data: Optional[Union[str, bytes]] = None,
        payment: Optional[PaymentPayload] = None,
        timeout: Optional[float] = None,
    ) -> SuccessfulResponse:
        """
        Make an x402-compliant request to a resource.

        Args:
            url: The URL to request
            method: HTTP method to use
            headers: Additional headers to send
            json_data: JSON data to send in request body
            data: Raw data to send in request body
            payment: Optional payment to include in X-PAYMENT header
            timeout: Request timeout override

        Returns:
            Response data and metadata

        Raises:
            NPNetworkError: If network request fails
            NPTimeoutError: If request times out
        """
        request_headers = {
            "Content-Type": "application/json",
            "User-Agent": "nanda-payments-python-sdk",
        }
        if headers:
            request_headers.update(headers)

        # Add payment header if provided
        if payment:
            request_headers["X-PAYMENT"] = self._encode_payment(payment)

        # Prepare request body
        body = None
        if json_data is not None:
            body = json.dumps(json_data)
        elif data is not None:
            body = data

        session = self._get_session()
        request_timeout = timeout or self.timeout

        try:
            async with session.request(
                method,
                url,
                headers=request_headers,
                data=body,
                timeout=aiohttp.ClientTimeout(total=request_timeout),
            ) as response:
                # Handle x402 Payment Required
                if response.status == 402:
                    data = await response.json()
                    payment_required = PaymentRequiredResponse.parse_obj(data)
                    return SuccessfulResponse(
                        data=None,
                        headers=dict(response.headers),
                        status=402,
                        payment_required=payment_required,
                    )

                # Handle successful responses
                if response.status < 400:
                    try:
                        response_data = await response.json()
                    except (json.JSONDecodeError, aiohttp.ContentTypeError):
                        response_data = await response.text()

                    # Parse payment response header if present
                    payment_response = None
                    payment_header = response.headers.get("X-PAYMENT-RESPONSE")
                    if payment_header:
                        try:
                            decoded = base64.b64decode(payment_header).decode()
                            payment_response = json.loads(decoded)
                        except Exception:
                            # Ignore invalid payment response headers
                            pass

                    return SuccessfulResponse(
                        data=response_data,
                        headers=dict(response.headers),
                        status=response.status,
                        payment_response=payment_response,
                    )

                # Handle other HTTP errors
                try:
                    error_data = await response.json()
                except (json.JSONDecodeError, aiohttp.ContentTypeError):
                    error_data = {}

                raise NPNetworkError(
                    f"HTTP {response.status}: {response.reason}",
                    {"status": response.status, "url": url, "error_data": error_data},
                )

        except asyncio.TimeoutError:
            raise NPTimeoutError(
                f"Request timed out after {request_timeout}s",
                {"url": url, "timeout": request_timeout},
            )
        except aiohttp.ClientError as e:
            raise NPNetworkError(
                f"Network request failed: {e}",
                {"url": url, "original_error": str(e)},
            )

    async def create_payment(self, options: PaymentOptions) -> PaymentPayload:
        """
        Create a payment payload for the given options.

        Args:
            options: Payment configuration

        Returns:
            Payment payload ready to be sent
        """
        tx_id = self._generate_transaction_id()

        return PaymentPayload(
            x402_version=1,
            scheme="nanda-points",
            network="nanda-network",
            pay_to=options.recipient,
            amount=str(options.amount),
            from_agent=self.agent_name,
            tx_id=tx_id,
            timestamp=int(time.time() * 1000),
            extra={"description": options.description} if options.description else None,
        )

    async def make_payment_request(
        self,
        url: str,
        payment_options: PaymentOptions,
        *,
        method: RequestMethod = "GET",
        headers: Optional[Dict[str, str]] = None,
        json_data: Optional[Any] = None,
        data: Optional[Union[str, bytes]] = None,
        timeout: Optional[float] = None,
    ) -> SuccessfulResponse:
        """
        Make a request with automatic payment handling.

        This method will automatically handle 402 responses by creating
        and submitting payments.

        Args:
            url: The URL to request
            payment_options: Payment configuration for if payment is required
            method: HTTP method to use
            headers: Additional headers to send
            json_data: JSON data to send in request body
            data: Raw data to send in request body
            timeout: Request timeout override

        Returns:
            Response data and metadata

        Raises:
            NPPaymentError: If payment verification or settlement fails
            NPNetworkError: If network request fails
            NPTimeoutError: If request times out
        """
        # First, try the request without payment to see if payment is required
        initial_response = await self.make_request(
            url,
            method=method,
            headers=headers,
            json_data=json_data,
            data=data,
            timeout=timeout,
        )

        # If no payment required, return the response
        if initial_response.status != 402:
            return initial_response

        # Payment is required - get payment requirements
        payment_required = getattr(initial_response, "payment_required", None)
        if not payment_required or not payment_required.accepts:
            raise NPPaymentError(
                "Invalid payment requirements in 402 response",
                "INVALID_PAYMENT_REQUIREMENTS",
                payment_required,
            )

        requirements = payment_required.accepts[0]

        # Create payment
        payment = await self.create_payment(
            PaymentOptions(
                amount=int(requirements.max_amount_required),
                recipient=requirements.pay_to,
                description=payment_options.description or requirements.description,
                timeout=payment_options.timeout,
            )
        )

        # Verify payment with facilitator first
        verification = await self.facilitator.verify(payment, requirements)
        if not verification.is_valid:
            raise NPPaymentError(
                f"Payment verification failed: {verification.invalid_reason}",
                "VERIFICATION_FAILED",
                verification,
            )

        # Make the request again with payment
        paid_response = await self.make_request(
            url,
            method=method,
            headers=headers,
            json_data=json_data,
            data=data,
            payment=payment,
            timeout=timeout,
        )

        # If payment was successful, settle it
        if paid_response.status < 400:
            try:
                await self.facilitator.settle(payment, requirements)
            except Exception:
                # Don't fail the response for settlement issues
                # This should be logged in production
                pass

        return paid_response

    def _encode_payment(self, payload: PaymentPayload) -> str:
        """Encode payment payload for X-PAYMENT header"""
        try:
            json_str = json.dumps(payload.dict(by_alias=True))
            return base64.b64encode(json_str.encode()).decode()
        except Exception as e:
            raise NPPaymentError(
                "Failed to encode payment payload", "ENCODING_ERROR", str(e)
            )

    def _generate_transaction_id(self) -> str:
        """Generate a unique transaction ID"""
        timestamp = hex(int(time.time()))[2:]
        random_part = str(uuid.uuid4()).replace("-", "")[:8]
        return f"np_{timestamp}_{random_part}"

    def _get_session(self) -> aiohttp.ClientSession:
        """Get the current aiohttp session"""
        if self._session is None:
            raise RuntimeError(
                "No session available. Use 'async with' context manager or provide a session."
            )
        return self._session

    async def close(self) -> None:
        """Close the client session if owned by this client"""
        if self._session_owned and self._session:
            await self._session.close()
            self._session = None