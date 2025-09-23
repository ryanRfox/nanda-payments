"""
NANDA Payments SDK for Python
Async-first SDK for NANDA Points payments with x402 protocol support
"""

from .main import NandaPaymentsClient
from .types import (
    PaymentOptions,
    PaymentPayload,
    PaymentRequirements,
    BalanceInfo,
    Transaction,
    TransactionQuery,
    Agent,
    Wallet,
    NPPaymentError,
    NPVerificationError,
    NPSettlementError,
    NPNetworkError,
    NPTimeoutError,
)
from .facilitator import FacilitatorClient
from .agent import AgentManager

__version__ = "1.0.0"
__all__ = [
    "NandaPaymentsClient",
    "FacilitatorClient",
    "AgentManager",
    "PaymentOptions",
    "PaymentPayload",
    "PaymentRequirements",
    "BalanceInfo",
    "Transaction",
    "TransactionQuery",
    "Agent",
    "Wallet",
    "NPPaymentError",
    "NPVerificationError",
    "NPSettlementError",
    "NPNetworkError",
    "NPTimeoutError",
]


def create_client(
    agent_name: str,
    facilitator_url: str,
    *,
    timeout: float = 30.0,
    retry_count: int = 3,
    retry_delay: float = 1.0,
) -> NandaPaymentsClient:
    """
    Create a NANDA Payments client with the given configuration.

    Args:
        agent_name: The name of your agent
        facilitator_url: URL of the NANDA Points facilitator
        timeout: Request timeout in seconds (default: 30.0)
        retry_count: Number of retry attempts (default: 3)
        retry_delay: Delay between retries in seconds (default: 1.0)

    Returns:
        Configured NandaPaymentsClient instance
    """
    return NandaPaymentsClient(
        agent_name=agent_name,
        facilitator_url=facilitator_url,
        timeout=timeout,
        retry_count=retry_count,
        retry_delay=retry_delay,
    )