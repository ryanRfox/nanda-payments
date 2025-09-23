"""
Facilitator API client for NANDA Points
Handles communication with the x402 facilitator service
"""

import asyncio
import json
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import aiohttp

from .types import (
    NPNetworkError,
    NPPaymentError,
    NPTimeoutError,
    PaymentPayload,
    PaymentRequirements,
    SettlementResponse,
    SupportedResponse,
    VerificationResponse,
)


class FacilitatorClient:
    """Async client for communicating with NANDA Points facilitator"""

    def __init__(
        self,
        facilitator_url: str,
        *,
        timeout: float = 30.0,
        retry_count: int = 3,
        retry_delay: float = 1.0,
        session: Optional[aiohttp.ClientSession] = None,
    ):
        """
        Initialize the facilitator client.

        Args:
            facilitator_url: Base URL of the facilitator service
            timeout: Request timeout in seconds
            retry_count: Number of retry attempts for failed requests
            retry_delay: Delay between retry attempts in seconds
            session: Optional aiohttp session to use (will create one if None)
        """
        self.base_url = facilitator_url.rstrip("/")
        self.timeout = timeout
        self.retry_count = retry_count
        self.retry_delay = retry_delay
        self._session = session
        self._session_owned = session is None

    async def __aenter__(self) -> "FacilitatorClient":
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

    async def verify(
        self,
        payment: PaymentPayload,
        requirements: PaymentRequirements,
    ) -> VerificationResponse:
        """
        Verify a payment with the facilitator.

        Args:
            payment: The payment payload to verify
            requirements: The payment requirements to check against

        Returns:
            Verification response indicating if payment is valid

        Raises:
            NPNetworkError: If network request fails
            NPTimeoutError: If request times out
        """
        return await self._with_retry(self._verify, payment, requirements)

    async def settle(
        self,
        payment: PaymentPayload,
        requirements: PaymentRequirements,
    ) -> SettlementResponse:
        """
        Settle a payment with the facilitator.

        Args:
            payment: The payment payload to settle
            requirements: The payment requirements

        Returns:
            Settlement response with transaction details

        Raises:
            NPPaymentError: If settlement fails
            NPNetworkError: If network request fails
            NPTimeoutError: If request times out
        """
        return await self._with_retry(self._settle, payment, requirements)

    async def supported(self) -> SupportedResponse:
        """
        Get supported payment schemes from the facilitator.

        Returns:
            List of supported payment schemes

        Raises:
            NPPaymentError: If facilitator returns an error
            NPNetworkError: If network request fails
            NPTimeoutError: If request times out
        """
        return await self._with_retry(self._supported)

    async def health(self) -> Dict[str, Any]:
        """
        Check facilitator health status.

        Returns:
            Health status information

        Raises:
            NPNetworkError: If health check fails
        """
        try:
            async with self._get_session().get(
                urljoin(self.base_url, "/health")
            ) as response:
                if response.status != 200:
                    raise NPNetworkError("Facilitator health check failed")

                data = await response.json()
                return {
                    "status": data.get("status", "unknown"),
                    "timestamp": data.get("timestamp", None),
                }
        except aiohttp.ClientError as e:
            raise NPNetworkError(f"Failed to check facilitator health: {e}")

    async def _verify(
        self,
        payment: PaymentPayload,
        requirements: PaymentRequirements,
    ) -> VerificationResponse:
        """Internal verify implementation"""
        payload = {
            "payment": payment.dict(by_alias=True),
            "paymentRequirements": requirements.dict(by_alias=True),
        }

        async with self._get_session().post(
            urljoin(self.base_url, "/verify"),
            json=payload,
        ) as response:
            data = await response.json()

            if response.status != 200:
                return VerificationResponse(
                    is_valid=False,
                    invalid_reason=data.get("invalidReason", "Verification failed"),
                )

            return VerificationResponse.parse_obj(data)

    async def _settle(
        self,
        payment: PaymentPayload,
        requirements: PaymentRequirements,
    ) -> SettlementResponse:
        """Internal settle implementation"""
        payload = {
            "payment": payment.dict(by_alias=True),
            "paymentRequirements": requirements.dict(by_alias=True),
        }

        async with self._get_session().post(
            urljoin(self.base_url, "/settle"),
            json=payload,
        ) as response:
            data = await response.json()

            if response.status != 200:
                raise NPPaymentError(
                    "Settlement failed", "SETTLEMENT_ERROR", data
                )

            return SettlementResponse.parse_obj(data)

    async def _supported(self) -> SupportedResponse:
        """Internal supported implementation"""
        async with self._get_session().get(
            urljoin(self.base_url, "/supported")
        ) as response:
            if response.status != 200:
                raise NPPaymentError(
                    "Failed to get supported schemes", "FACILITATOR_ERROR"
                )

            data = await response.json()
            return SupportedResponse.parse_obj(data)

    async def _with_retry(self, operation, *args, **kwargs):
        """Execute an operation with retry logic"""
        last_exception = None

        for attempt in range(self.retry_count):
            try:
                return await operation(*args, **kwargs)
            except (NPPaymentError, NPTimeoutError) as e:
                # Don't retry payment-specific errors
                if isinstance(e, NPPaymentError) and e.code in [
                    "VERIFICATION_FAILED",
                    "SETTLEMENT_FAILED",
                ]:
                    raise
                last_exception = e
            except Exception as e:
                last_exception = e

            if attempt < self.retry_count - 1:
                await asyncio.sleep(self.retry_delay * (attempt + 1))

        # If we get here, all retries failed
        if isinstance(last_exception, Exception):
            if isinstance(last_exception, (NPPaymentError, NPNetworkError, NPTimeoutError)):
                raise last_exception
            raise NPNetworkError(f"Request failed after {self.retry_count} attempts: {last_exception}")

        raise NPNetworkError(f"Request failed after {self.retry_count} attempts")

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