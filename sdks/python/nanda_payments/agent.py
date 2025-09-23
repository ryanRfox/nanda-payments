"""
Agent management utilities for NANDA Points
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlencode

import aiohttp

from .facilitator import FacilitatorClient
from .types import (
    Agent,
    BalanceInfo,
    NPNetworkError,
    NPPaymentError,
    Transaction,
    TransactionQuery,
    Wallet,
)


class AgentManager:
    """Manager for agent-related operations"""

    def __init__(
        self,
        agent_name: str,
        facilitator: FacilitatorClient,
        *,
        session: Optional[aiohttp.ClientSession] = None,
    ):
        """
        Initialize the agent manager.

        Args:
            agent_name: Name of the agent
            facilitator: Facilitator client for API communication
            session: Optional aiohttp session to use
        """
        self.agent_name = agent_name
        self.facilitator = facilitator
        self._session = session

    async def get_balance(self) -> BalanceInfo:
        """
        Get current agent balance.

        Returns:
            Current balance information

        Raises:
            NPPaymentError: If balance retrieval fails
        """
        try:
            response = await self._make_agent_request("/balance")
            return BalanceInfo(
                balance=response["balanceMinor"],
                currency="NP",
                wallet_id=response["walletId"],
                last_updated=datetime.now().isoformat(),
            )
        except Exception as e:
            raise NPPaymentError("Failed to get agent balance", "BALANCE_ERROR", str(e))

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
        try:
            params = {}
            if query:
                if query.limit is not None:
                    params["limit"] = str(query.limit)
                if query.offset is not None:
                    params["offset"] = str(query.offset)
                if query.from_date is not None:
                    params["fromDate"] = query.from_date.isoformat()
                if query.to_date is not None:
                    params["toDate"] = query.to_date.isoformat()
                if query.status is not None:
                    params["status"] = query.status.value
                if query.direction is not None:
                    params["direction"] = query.direction.value

            endpoint = "/transactions"
            if params:
                endpoint += "?" + urlencode(params)

            response = await self._make_agent_request(endpoint)
            transactions = response.get("transactions", [])

            return [Transaction.parse_obj(tx) for tx in transactions]
        except Exception as e:
            raise NPPaymentError(
                "Failed to get transaction history", "TRANSACTION_HISTORY_ERROR", str(e)
            )

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
        try:
            response = await self._make_agent_request(f"/transaction/{tx_id}")
            transaction_data = response.get("transaction")
            if transaction_data:
                return Transaction.parse_obj(transaction_data)
            return None
        except NPNetworkError as e:
            if getattr(e.details, {}).get("status") == 404:
                return None
            raise NPPaymentError("Failed to get transaction", "TRANSACTION_ERROR", str(e))

    async def get_agent_info(self) -> Agent:
        """
        Get agent information.

        Returns:
            Agent information

        Raises:
            NPPaymentError: If agent info retrieval fails
        """
        try:
            response = await self._make_agent_request("/info")
            return Agent.parse_obj(response["agent"])
        except Exception as e:
            raise NPPaymentError(
                "Failed to get agent information", "AGENT_INFO_ERROR", str(e)
            )

    async def get_wallet_info(self) -> Wallet:
        """
        Get wallet information.

        Returns:
            Wallet information

        Raises:
            NPPaymentError: If wallet info retrieval fails
        """
        try:
            response = await self._make_agent_request("/wallet")
            return Wallet.parse_obj(response["wallet"])
        except Exception as e:
            raise NPPaymentError(
                "Failed to get wallet information", "WALLET_INFO_ERROR", str(e)
            )

    async def register_agent(self, agent_info: Optional[Dict[str, Any]] = None) -> Agent:
        """
        Register or update agent information.

        Args:
            agent_info: Optional agent information to update

        Returns:
            Updated agent information

        Raises:
            NPPaymentError: If agent registration fails
        """
        try:
            data = {"agent_name": self.agent_name}
            if agent_info:
                data.update(agent_info)

            response = await self._make_agent_request("/register", method="POST", json_data=data)
            return Agent.parse_obj(response["agent"])
        except Exception as e:
            raise NPPaymentError(
                "Failed to register agent", "AGENT_REGISTRATION_ERROR", str(e)
            )

    async def create_wallet(self) -> Wallet:
        """
        Create a new wallet for the agent.

        Returns:
            New wallet information

        Raises:
            NPPaymentError: If wallet creation fails
        """
        try:
            data = {
                "agent_name": self.agent_name,
                "currency": "NP",
                "scale": 0,
            }

            response = await self._make_agent_request("/wallet", method="POST", json_data=data)
            return Wallet.parse_obj(response["wallet"])
        except Exception as e:
            raise NPPaymentError("Failed to create wallet", "WALLET_CREATION_ERROR", str(e))

    async def get_summary(self) -> Dict[str, Any]:
        """
        Get summary statistics for the agent.

        Returns:
            Summary statistics including balance, transaction counts, etc.

        Raises:
            NPPaymentError: If summary retrieval fails
        """
        try:
            # Get balance and recent transactions in parallel
            balance_task = self.get_balance()
            transactions_task = self.get_transaction_history(
                TransactionQuery(limit=100)
            )

            balance, recent_transactions = await asyncio.gather(
                balance_task, transactions_task
            )

            # Calculate statistics
            sent = sum(
                tx.amount_minor
                for tx in recent_transactions
                if tx.from_agent == self.agent_name and tx.status.value == "completed"
            )

            received = sum(
                tx.amount_minor
                for tx in recent_transactions
                if tx.to_agent == self.agent_name and tx.status.value == "completed"
            )

            last_activity = (
                recent_transactions[0].timestamp if recent_transactions else None
            )

            return {
                "balance": balance.balance,
                "total_sent": sent,
                "total_received": received,
                "transaction_count": len(recent_transactions),
                "last_activity": last_activity,
            }
        except Exception as e:
            raise NPPaymentError("Failed to get agent summary", "AGENT_SUMMARY_ERROR", str(e))

    async def _make_agent_request(
        self,
        endpoint: str,
        *,
        method: str = "GET",
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Make a request to an agent-specific endpoint.

        Args:
            endpoint: The endpoint path to request
            method: HTTP method to use
            json_data: Optional JSON data to send

        Returns:
            Response data

        Raises:
            NPNetworkError: If request fails
        """
        # Use facilitator's base URL to construct agent endpoint
        base_url = getattr(self.facilitator, "base_url", "")
        url = urljoin(base_url, f"/agents/{self.agent_name}{endpoint}")

        session = self._session or getattr(self.facilitator, "_session", None)
        if not session:
            raise RuntimeError("No HTTP session available for agent requests")

        try:
            kwargs = {
                "headers": {
                    "Content-Type": "application/json",
                    "User-Agent": "nanda-payments-python-sdk",
                }
            }

            if json_data:
                kwargs["json"] = json_data

            async with session.request(method, url, **kwargs) as response:
                if not response.ok:
                    try:
                        error_data = await response.json()
                    except Exception:
                        error_data = {}

                    raise NPNetworkError(
                        f"HTTP {response.status}: {response.reason}",
                        {
                            "status": response.status,
                            "endpoint": endpoint,
                            "error_data": error_data,
                        },
                    )

                return await response.json()

        except aiohttp.ClientError as e:
            raise NPNetworkError(
                f"Agent request failed: {e}",
                {"endpoint": endpoint, "original_error": str(e)},
            )