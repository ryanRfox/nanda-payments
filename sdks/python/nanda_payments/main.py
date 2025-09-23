"""
Main NANDA Payments SDK client that combines all functionality
"""

from typing import Any, Dict, List, Optional, Union

import aiohttp

from .agent import AgentManager
from .client import PaymentClient
from .facilitator import FacilitatorClient
from .types import (
    Agent,
    BalanceInfo,
    PaymentOptions,
    PaymentPayload,
    RequestMethod,
    SuccessfulResponse,
    SupportedResponse,
    Transaction,
    TransactionQuery,
    Wallet,
)


class NandaPaymentsClient:
    """
    Main client for NANDA Payments SDK.

    This client combines all SDK functionality into a single, easy-to-use interface.
    It handles payment requests, agent management, and facilitator communication.
    """

    def __init__(
        self,
        agent_name: str,
        facilitator_url: str,
        *,
        timeout: float = 30.0,
        retry_count: int = 3,
        retry_delay: float = 1.0,
        session: Optional[aiohttp.ClientSession] = None,
    ):
        """
        Initialize the NANDA Payments client.

        Args:
            agent_name: Name of your agent
            facilitator_url: URL of the NANDA Points facilitator
            timeout: Request timeout in seconds (default: 30.0)
            retry_count: Number of retry attempts (default: 3)
            retry_delay: Delay between retries in seconds (default: 1.0)
            session: Optional aiohttp session to use (will create one if None)
        """
        self.agent_name = agent_name
        self._session = session
        self._session_owned = session is None

        # Initialize core clients
        self.facilitator = FacilitatorClient(
            facilitator_url,
            timeout=timeout,
            retry_count=retry_count,
            retry_delay=retry_delay,
            session=session,
        )

        self.payment_client = PaymentClient(
            agent_name,
            self.facilitator,
            timeout=timeout,
            session=session,
        )

        self.agent_manager = AgentManager(
            agent_name,
            self.facilitator,
            session=session,
        )

    async def __aenter__(self) -> "NandaPaymentsClient":
        """Async context manager entry"""
        if self._session is None:
            self._session = aiohttp.ClientSession()

        # Update session in all clients
        self.facilitator._session = self._session
        self.payment_client._session = self._session
        self.agent_manager._session = self._session

        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit"""
        if self._session_owned and self._session:
            await self._session.close()

    # ============================================================================
    # Payment Operations
    # ============================================================================

    async def make_request(
        self,
        url: str,
        *,
        method: RequestMethod = "GET",
        headers: Optional[Dict[str, str]] = None,
        json_data: Optional[Any] = None,
        data: Optional[Union[str, bytes]] = None,
        timeout: Optional[float] = None,
    ) -> SuccessfulResponse:
        """
        Make an x402-compliant request to a resource.

        This is the main method for making requests that may require payment.

        Args:
            url: The URL to request
            method: HTTP method to use
            headers: Additional headers to send
            json_data: JSON data to send in request body
            data: Raw data to send in request body
            timeout: Request timeout override

        Returns:
            Response data and metadata

        Raises:
            NPNetworkError: If network request fails
            NPTimeoutError: If request times out
        """
        return await self.payment_client.make_request(
            url,
            method=method,
            headers=headers,
            json_data=json_data,
            data=data,
            timeout=timeout,
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
        return await self.payment_client.make_payment_request(
            url,
            payment_options,
            method=method,
            headers=headers,
            json_data=json_data,
            data=data,
            timeout=timeout,
        )

    async def create_payment(self, options: PaymentOptions) -> PaymentPayload:
        """
        Create a payment payload for manual handling.

        Args:
            options: Payment configuration

        Returns:
            Payment payload ready to be sent
        """
        return await self.payment_client.create_payment(options)

    # ============================================================================
    # Agent Management
    # ============================================================================

    async def get_balance(self) -> BalanceInfo:
        """
        Get current agent balance.

        Returns:
            Current balance information

        Raises:
            NPPaymentError: If balance retrieval fails
        """
        return await self.agent_manager.get_balance()

    async def get_transaction_history(
        self, query: Optional[TransactionQuery] = None
    ) -> List[Transaction]:
        """
        Get transaction history for the agent.

        Args:
            query: Optional query parameters for filtering

        Returns:
            List of transactions

        Raises:
            NPPaymentError: If transaction history retrieval fails
        """
        return await self.agent_manager.get_transaction_history(query)

    async def get_transaction(self, tx_id: str) -> Optional[Transaction]:
        """
        Get specific transaction by ID.

        Args:
            tx_id: Transaction ID to retrieve

        Returns:
            Transaction if found, None otherwise

        Raises:
            NPPaymentError: If transaction retrieval fails
        """
        return await self.agent_manager.get_transaction(tx_id)

    async def get_agent_info(self) -> Agent:
        """
        Get agent information.

        Returns:
            Agent information

        Raises:
            NPPaymentError: If agent info retrieval fails
        """
        return await self.agent_manager.get_agent_info()

    async def get_wallet_info(self) -> Wallet:
        """
        Get wallet information.

        Returns:
            Wallet information

        Raises:
            NPPaymentError: If wallet info retrieval fails
        """
        return await self.agent_manager.get_wallet_info()

    async def register_agent(
        self, agent_info: Optional[Dict[str, Any]] = None
    ) -> Agent:
        """
        Register or update agent information.

        Args:
            agent_info: Optional agent information to update

        Returns:
            Updated agent information

        Raises:
            NPPaymentError: If agent registration fails
        """
        return await self.agent_manager.register_agent(agent_info)

    async def create_wallet(self) -> Wallet:
        """
        Create a new wallet for the agent.

        Returns:
            New wallet information

        Raises:
            NPPaymentError: If wallet creation fails
        """
        return await self.agent_manager.create_wallet()

    async def get_summary(self) -> Dict[str, Any]:
        """
        Get agent summary with key metrics.

        Returns:
            Summary statistics including balance, transaction counts, etc.

        Raises:
            NPPaymentError: If summary retrieval fails
        """
        return await self.agent_manager.get_summary()

    # ============================================================================
    # Facilitator Operations
    # ============================================================================

    async def check_facilitator_health(self) -> Dict[str, Any]:
        """
        Check facilitator health status.

        Returns:
            Health status information

        Raises:
            NPNetworkError: If health check fails
        """
        return await self.facilitator.health()

    async def get_supported_schemes(self) -> SupportedResponse:
        """
        Get supported payment schemes from the facilitator.

        Returns:
            List of supported payment schemes

        Raises:
            NPPaymentError: If facilitator returns an error
            NPNetworkError: If network request fails
        """
        return await self.facilitator.supported()

    # ============================================================================
    # Utility Methods
    # ============================================================================

    async def test_connection(self) -> bool:
        """
        Test the connection to the facilitator.

        Returns:
            True if connection is successful, False otherwise
        """
        try:
            await self.facilitator.health()
            return True
        except Exception:
            return False

    def get_config(self) -> Dict[str, Any]:
        """
        Get SDK configuration.

        Returns:
            Configuration dictionary
        """
        return {
            "agent_name": self.agent_name,
            "facilitator_url": self.facilitator.base_url,
            "timeout": self.facilitator.timeout,
            "retry_count": self.facilitator.retry_count,
            "retry_delay": self.facilitator.retry_delay,
        }

    async def close(self) -> None:
        """
        Close all client sessions.

        This should be called when you're done with the client to ensure
        proper cleanup of resources.
        """
        await self.payment_client.close()
        await self.facilitator.close()

        if self._session_owned and self._session:
            await self._session.close()
            self._session = None