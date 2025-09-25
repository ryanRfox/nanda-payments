/**
 * Local NANDA Client for Examples
 *
 * This is a simplified version of the SDK for use in examples.
 * In production, use the published @nanda/sdk package.
 */

import { z } from 'zod';

// Types matching the facilitator API
export interface PaymentVerificationResult {
  valid: boolean;
  sessionId?: string;
  reason?: string;
  expiresAt?: string;
}

export interface PaymentSettlementResult {
  settled: boolean;
  transactionId?: string;
  reason?: string;
  balance?: {
    from: number;
    to: number;
  };
}

export interface AgentBalance {
  agent_name: string;
  walletId: string;
  balance: {
    balanceMinor: number;
    balanceNP: number;
    formatted: string;
  };
}

// Zod schemas for validation
const PaymentPayloadSchema = z.object({
  scheme: z.literal('exact'),
  network: z.literal('nanda-network'),
  x402Version: z.literal(1),
  payload: z.object({
    authorization: z.object({
      from: z.string(),
      to: z.string(),
      value: z.string(),
      validAfter: z.string(),
      validBefore: z.string(),
      nonce: z.string(),
    }),
    signature: z.string(),
  }),
});

const PaymentRequirementsSchema = z.object({
  scheme: z.literal('exact'),
  network: z.literal('nanda-network'),
  maxAmountRequired: z.string(),
  resource: z.string(),
  description: z.string().optional(),
});

export class NandaSDKError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'NandaSDKError';
  }
}

export interface NandaClientConfig {
  facilitatorUrl: string;
  timeout?: number;
  apiKey?: string;
  agentName?: string;
}

export class NandaClient {
  private config: Required<Omit<NandaClientConfig, 'apiKey' | 'agentName'>> & Pick<NandaClientConfig, 'apiKey' | 'agentName'>;

  constructor(config: NandaClientConfig) {
    this.config = {
      facilitatorUrl: config.facilitatorUrl.replace(/\/$/, ''),
      timeout: config.timeout || 10000,
      apiKey: config.apiKey,
      agentName: config.agentName,
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.facilitatorUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        throw new NandaSDKError(
          responseData.message || `HTTP ${response.status}`,
          response.status,
          responseData.code
        );
      }

      return responseData;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof NandaSDKError) {
        throw error;
      }

      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        throw new NandaSDKError('Request timeout', 408, 'TIMEOUT');
      }

      throw new NandaSDKError(
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Verify an x402 payment
   */
  async verifyPayment(paymentData: {
    paymentPayload: unknown;
    paymentRequirements: unknown;
  }): Promise<PaymentVerificationResult> {
    // Validate input data
    try {
      PaymentPayloadSchema.parse(paymentData.paymentPayload);
      PaymentRequirementsSchema.parse(paymentData.paymentRequirements);
    } catch (error) {
      throw new NandaSDKError('Invalid payment data format', 400, 'VALIDATION_ERROR');
    }

    return this.makeRequest<PaymentVerificationResult>('/verify', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  /**
   * Settle a verified payment
   */
  async settlePayment(settlementData: {
    sessionId: string;
    paymentPayload: unknown;
  }): Promise<PaymentSettlementResult> {
    return this.makeRequest<PaymentSettlementResult>('/settle', {
      method: 'POST',
      body: JSON.stringify(settlementData),
    });
  }

  /**
   * Get agent balance
   */
  async getAgentBalance(agentName: string): Promise<AgentBalance> {
    return this.makeRequest<AgentBalance>(`/api/v1/agents/${encodeURIComponent(agentName)}/balance`);
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest<{ status: string; timestamp: string }>('/health');
  }

  /**
   * NANDA Points utility functions
   */
  static toMinorUnits(np: number): number {
    return Math.round(np * 100);
  }

  static fromMinorUnits(minor: number): number {
    return minor / 100;
  }

  static formatNP(np: number): string {
    return `${np.toFixed(2)} NP`;
  }
}

// Export utility functions
export const NandaPoints = {
  toMinor: NandaClient.toMinorUnits,
  fromMinor: NandaClient.fromMinorUnits,
  format: NandaClient.formatNP,
};