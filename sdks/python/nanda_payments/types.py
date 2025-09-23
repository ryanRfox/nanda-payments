"""
Type definitions for NANDA Payments SDK
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


class PaymentScheme(str, Enum):
    """Supported payment schemes"""

    NANDA_POINTS = "nanda-points"


class PaymentNetwork(str, Enum):
    """Supported payment networks"""

    NANDA_NETWORK = "nanda-network"


class PaymentAsset(str, Enum):
    """Supported payment assets"""

    NP = "NP"


class TransactionStatus(str, Enum):
    """Transaction status values"""

    COMPLETED = "completed"
    PENDING = "pending"
    FAILED = "failed"


class TransactionDirection(str, Enum):
    """Transaction direction for filtering"""

    SENT = "sent"
    RECEIVED = "received"
    ALL = "all"


# Core x402 types
class PaymentRequirements(BaseModel):
    """Payment requirements as defined by x402 protocol"""

    scheme: Literal["nanda-points"] = Field(default="nanda-points")
    network: Literal["nanda-network"] = Field(default="nanda-network")
    max_amount_required: str = Field(alias="maxAmountRequired")
    resource: str
    description: str
    mime_type: str = Field(alias="mimeType")
    pay_to: str = Field(alias="payTo")
    max_timeout_seconds: int = Field(alias="maxTimeoutSeconds")
    asset: Literal["NP"] = Field(default="NP")
    output_schema: Optional[Any] = Field(default=None, alias="outputSchema")
    extra: Optional[Dict[str, Any]] = None

    class Config:
        allow_population_by_field_name = True


class PaymentPayload(BaseModel):
    """Payment payload for x402 protocol"""

    x402_version: int = Field(alias="x402Version")
    scheme: Literal["nanda-points"] = Field(default="nanda-points")
    network: Literal["nanda-network"] = Field(default="nanda-network")
    pay_to: str = Field(alias="payTo")
    amount: str
    from_agent: str = Field(alias="from")
    tx_id: str = Field(alias="txId")
    timestamp: int
    extra: Optional[Dict[str, Any]] = None

    class Config:
        allow_population_by_field_name = True


class VerificationResponse(BaseModel):
    """Response from payment verification"""

    is_valid: bool = Field(alias="isValid")
    invalid_reason: Optional[str] = Field(default=None, alias="invalidReason")
    payer: Optional[str] = None
    amount: Optional[str] = None
    tx_id: Optional[str] = Field(default=None, alias="txId")

    class Config:
        allow_population_by_field_name = True


class Receipt(BaseModel):
    """NANDA Points transaction receipt"""

    tx_id: str = Field(alias="txId")
    from_agent: str = Field(alias="fromAgent")
    to_agent: str = Field(alias="toAgent")
    amount_minor: int = Field(alias="amountMinor")
    amount_points: int = Field(alias="amountPoints")
    timestamp: str
    from_balance_after: int = Field(alias="fromBalanceAfter")
    to_balance_after: int = Field(alias="toBalanceAfter")

    class Config:
        allow_population_by_field_name = True


class SettlementResponse(BaseModel):
    """Response from payment settlement"""

    success: bool
    tx_id: str = Field(alias="txId")
    amount: str
    from_agent: str = Field(alias="from")
    to_agent: str = Field(alias="to")
    timestamp: int
    error_reason: Optional[str] = Field(default=None, alias="errorReason")
    receipt: Optional[Receipt] = None

    class Config:
        allow_population_by_field_name = True


class SupportedScheme(BaseModel):
    """Supported payment scheme information"""

    scheme: Literal["nanda-points"] = Field(default="nanda-points")
    network: Literal["nanda-network"] = Field(default="nanda-network")
    asset: Literal["NP"] = Field(default="NP")
    extra: Optional[Dict[str, Any]] = None


class SupportedResponse(BaseModel):
    """Response from supported schemes endpoint"""

    kinds: List[SupportedScheme]


# NANDA Points specific types
class Agent(BaseModel):
    """NANDA Points agent information"""

    agent_name: str
    wallet_id: str = Field(alias="walletId")
    service_charge: int = Field(alias="serviceCharge")

    class Config:
        allow_population_by_field_name = True


class Wallet(BaseModel):
    """NANDA Points wallet information"""

    wallet_id: str = Field(alias="walletId")
    agent_name: str
    balance_minor: int = Field(alias="balanceMinor")
    currency: Literal["NP"] = Field(default="NP")
    scale: Literal[0] = Field(default=0)
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")

    class Config:
        allow_population_by_field_name = True


class Transaction(BaseModel):
    """NANDA Points transaction information"""

    tx_id: str = Field(alias="txId")
    from_agent: str = Field(alias="fromAgent")
    to_agent: str = Field(alias="toAgent")
    amount_minor: int = Field(alias="amountMinor")
    status: TransactionStatus
    timestamp: str
    description: Optional[str] = None

    class Config:
        allow_population_by_field_name = True


# SDK Configuration types
class PaymentOptions(BaseModel):
    """Options for creating a payment"""

    amount: int
    recipient: str
    description: Optional[str] = None
    timeout: Optional[float] = None


class TransactionQuery(BaseModel):
    """Query parameters for transaction history"""

    limit: Optional[int] = None
    offset: Optional[int] = None
    from_date: Optional[datetime] = Field(default=None, alias="fromDate")
    to_date: Optional[datetime] = Field(default=None, alias="toDate")
    status: Optional[TransactionStatus] = None
    direction: Optional[TransactionDirection] = None

    class Config:
        allow_population_by_field_name = True


class BalanceInfo(BaseModel):
    """Agent balance information"""

    balance: int
    currency: Literal["NP"] = Field(default="NP")
    wallet_id: str = Field(alias="walletId")
    last_updated: str = Field(alias="lastUpdated")

    class Config:
        allow_population_by_field_name = True


class PaymentRequiredResponse(BaseModel):
    """HTTP 402 Payment Required response"""

    x402_version: int = Field(alias="x402Version")
    error: str
    accepts: List[PaymentRequirements]
    payer: Optional[str] = None

    class Config:
        allow_population_by_field_name = True


class PaymentResponse(BaseModel):
    """Payment response header data"""

    tx_id: str = Field(alias="txId")
    amount: str
    from_agent: str = Field(alias="from")
    to_agent: str = Field(alias="to")
    timestamp: int

    class Config:
        allow_population_by_field_name = True


class SuccessfulResponse(BaseModel):
    """Successful HTTP response with optional payment data"""

    data: Any
    headers: Dict[str, str]
    status: int
    payment_response: Optional[PaymentResponse] = Field(
        default=None, alias="paymentResponse"
    )

    class Config:
        allow_population_by_field_name = True


# Error classes
class NPPaymentError(Exception):
    """Base exception for NANDA Payments errors"""

    def __init__(self, message: str, code: str, details: Any = None):
        super().__init__(message)
        self.code = code
        self.details = details


class NPVerificationError(NPPaymentError):
    """Payment verification failed"""

    def __init__(self, message: str, details: Any = None):
        super().__init__(message, "VERIFICATION_FAILED", details)


class NPSettlementError(NPPaymentError):
    """Payment settlement failed"""

    def __init__(self, message: str, details: Any = None):
        super().__init__(message, "SETTLEMENT_FAILED", details)


class NPNetworkError(NPPaymentError):
    """Network request failed"""

    def __init__(self, message: str, details: Any = None):
        super().__init__(message, "NETWORK_ERROR", details)


class NPTimeoutError(NPPaymentError):
    """Request timed out"""

    def __init__(self, message: str, details: Any = None):
        super().__init__(message, "TIMEOUT_ERROR", details)


# Type aliases for convenience
RequestMethod = Literal["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
PaymentStatus = Literal["success", "payment_required", "error"]