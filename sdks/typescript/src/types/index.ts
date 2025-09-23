/**
 * TypeScript SDK types for NANDA Points payments
 */

// Core x402 types
export interface PaymentRequirements {
  scheme: "nanda-points";
  network: "nanda-network";
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: "NP";
  outputSchema?: unknown;
  extra?: {
    facilitatorUrl?: string;
    [key: string]: unknown;
  };
}

export interface PaymentPayload {
  x402Version: number;
  scheme: "nanda-points";
  network: "nanda-network";
  payTo: string;
  amount: string;
  from: string;
  txId: string;
  timestamp: number;
  extra?: {
    [key: string]: unknown;
  };
}

export interface VerificationResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
  amount?: string;
  txId?: string;
}

export interface SettlementResponse {
  success: boolean;
  txId: string;
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  errorReason?: string;
  receipt?: NPReceipt;
}

export interface SupportedResponse {
  kinds: Array<{
    scheme: "nanda-points";
    network: "nanda-network";
    asset: "NP";
    extra?: {
      facilitatorUrl: string;
      [key: string]: unknown;
    };
  }>;
}

// NANDA Points specific types
export interface NPReceipt {
  txId: string;
  fromAgent: string;
  toAgent: string;
  amountMinor: number;
  amountPoints: number;
  timestamp: string;
  fromBalanceAfter: number;
  toBalanceAfter: number;
}

export interface NPAgent {
  agent_name: string;
  walletId: string;
  serviceCharge: number;
}

export interface NPWallet {
  walletId: string;
  agent_name: string;
  balanceMinor: number;
  currency: "NP";
  scale: 0;
  createdAt: string;
  updatedAt: string;
}

export interface NPTransaction {
  txId: string;
  fromAgent: string;
  toAgent: string;
  amountMinor: number;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  description?: string;
}

// SDK Configuration types
export interface NandaPaymentsClientConfig {
  agentName: string;
  facilitatorUrl: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface PaymentOptions {
  amount: number;
  recipient: string;
  description?: string;
  timeout?: number;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

// HTTP response types for x402 compliance
export interface PaymentRequiredResponse {
  x402Version: number;
  error: string;
  accepts: PaymentRequirements[];
  payer?: string;
}

export interface SuccessfulResponse<T = unknown> {
  data: T;
  headers: Record<string, string>;
  status: number;
  paymentResponse?: {
    txId: string;
    amount: string;
    from: string;
    to: string;
    timestamp: number;
  };
}

export interface PaymentError extends Error {
  code: string;
  details?: unknown;
}

// Error classes
export class NPPaymentError extends Error implements PaymentError {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "NPPaymentError";
  }
}

export class NPVerificationError extends NPPaymentError {
  constructor(message: string, details?: unknown) {
    super(message, "VERIFICATION_FAILED", details);
  }
}

export class NPSettlementError extends NPPaymentError {
  constructor(message: string, details?: unknown) {
    super(message, "SETTLEMENT_FAILED", details);
  }
}

export class NPNetworkError extends NPPaymentError {
  constructor(message: string, details?: unknown) {
    super(message, "NETWORK_ERROR", details);
  }
}

export class NPTimeoutError extends NPPaymentError {
  constructor(message: string, details?: unknown) {
    super(message, "TIMEOUT_ERROR", details);
  }
}

// Agent management types
export interface BalanceInfo {
  balance: number;
  currency: 'NP';
  walletId: string;
  lastUpdated: string;
}

export interface TransactionQuery {
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
  status?: 'completed' | 'pending' | 'failed';
  direction?: 'sent' | 'received' | 'all';
}

// Utility types
export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
export type PaymentStatus = "success" | "payment_required" | "error";