import {
  NandaSDKConfig,
  NandaSDKError,
  AgentBalanceResponse,
  AgentBalanceResponseSchema,
  TransactionResponse,
  TransactionResponseSchema,
  PaymentSessionResponse,
  PaymentSessionResponseSchema,
  NetworkStatsResponse,
  NetworkStatsResponseSchema,
  CreatePaymentInput,
  VerifyPaymentInput,
  SettlePaymentInput,
} from './types.js';

/**
 * NANDA SDK Client
 *
 * Provides easy-to-use methods for interacting with the NANDA Facilitator.
 * Handles authentication, request/response validation, and error handling.
 */
export class NandaClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;

  constructor(config: NandaSDKConfig) {
    this.baseUrl = config.facilitatorUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 10000; // 10 second default timeout

    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': '@nanda/sdk/1.0.0',
    };

    if (config.apiKey) {
      this.headers.Authorization = `Bearer ${config.apiKey}`;
    }
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeout),
    };

    try {
      const response = await fetch(url, requestOptions);

      const responseData = await response.json();

      if (!response.ok) {
        throw new NandaSDKError(
          responseData.message || `HTTP ${response.status} ${response.statusText}`,
          responseData.code,
          response.status,
          responseData
        );
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof NandaSDKError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new NandaSDKError(`Request timeout after ${this.timeout}ms`);
      }

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new NandaSDKError(`Network error: Unable to connect to ${this.baseUrl}`);
      }

      throw new NandaSDKError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Health check - verify facilitator connectivity
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    return await this.makeRequest('/health');
  }

  /**
   * Get agent balance
   */
  async getAgentBalance(agentName: string): Promise<AgentBalanceResponse> {
    const response = await this.makeRequest(`/api/v1/agents/${encodeURIComponent(agentName)}/balance`);
    return AgentBalanceResponseSchema.parse(response);
  }

  /**
   * List recent transactions
   */
  async listTransactions(options: {
    agent?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    transactions: TransactionResponse[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options.agent) params.set('agent_name', options.agent);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.makeRequest(`/api/v1/transactions${query}`);

    const responseData = response as { transactions: unknown[]; total: number };
    return {
      transactions: responseData.transactions.map((tx: unknown) =>
        TransactionResponseSchema.parse(tx)
      ),
      total: responseData.total,
    };
  }

  /**
   * Get network statistics
   */
  async getNetworkStats(): Promise<NetworkStatsResponse> {
    const response = await this.makeRequest('/api/v1/stats');
    return NetworkStatsResponseSchema.parse(response);
  }

  /**
   * Verify x402 payment
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<{
    valid: boolean;
    sessionId?: string;
    reason?: string;
    expiresAt?: string;
  }> {
    return await this.makeRequest('/verify', {
      method: 'POST',
      body: JSON.stringify({
        paymentPayload: input.paymentPayload,
        paymentRequirements: input.paymentRequirements,
      }),
    });
  }

  /**
   * Settle verified payment
   */
  async settlePayment(input: SettlePaymentInput): Promise<{
    settled: boolean;
    transactionId?: string;
    reason?: string;
    balance?: {
      from: number;
      to: number;
    };
  }> {
    return await this.makeRequest('/settle', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: input.sessionId,
        paymentPayload: input.paymentPayload,
      }),
    });
  }

  /**
   * Create a direct payment between agents (non-x402 flow)
   * This is a convenience method for internal NANDA network transfers
   */
  async createDirectPayment(input: CreatePaymentInput): Promise<TransactionResponse> {
    // Convert NP to minor units
    const amountMinor = Math.round(input.amount * 100);

    const response = await this.makeRequest('/api/v1/payments', {
      method: 'POST',
      body: JSON.stringify({
        fromAgent: input.fromAgent,
        toAgent: input.toAgent,
        amount: amountMinor,
        currency: 'NP',
        type: 'payment',
        metadata: {
          description: input.description || `Payment from ${input.fromAgent} to ${input.toAgent}`,
          resource: input.resource,
        },
      }),
    });

    return TransactionResponseSchema.parse(response);
  }

  /**
   * Get payment sessions for an agent
   */
  async getPaymentSessions(options: {
    agent?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    sessions: PaymentSessionResponse[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options.agent) {
      params.set('fromAgent', options.agent);
      // Also search as toAgent - the API will handle OR logic
      params.set('toAgent', options.agent);
    }
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.makeRequest(`/api/v1/sessions${query}`);

    const responseData = response as { sessions: unknown[]; total: number };
    return {
      sessions: responseData.sessions.map((session: unknown) =>
        PaymentSessionResponseSchema.parse(session)
      ),
      total: responseData.total,
    };
  }

  /**
   * Utility: Convert NANDA Points to minor units
   */
  static toMinorUnits(nandaPoints: number): number {
    return Math.round(nandaPoints * 100);
  }

  /**
   * Utility: Convert minor units to NANDA Points
   */
  static fromMinorUnits(minorUnits: number): number {
    return minorUnits / 100;
  }

  /**
   * Utility: Format NANDA Points for display
   */
  static formatNP(nandaPoints: number): string {
    return `${nandaPoints.toFixed(2)} NP`;
  }
}