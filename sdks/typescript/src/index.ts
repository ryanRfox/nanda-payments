/**
 * NANDA Payments SDK for TypeScript
 * Main entry point that combines all SDK functionality
 */

import {
  NandaPaymentsClientConfig,
  PaymentOptions,
  RequestOptions,
  SuccessfulResponse,
  PaymentPayload,
  BalanceInfo,
  NPTransaction,
  TransactionQuery,
  NPAgent,
  NPWallet,
} from './types/index.js';
import { PaymentClient } from './client/index.js';
import { FacilitatorClient } from './facilitator/index.js';
import { AgentManager } from './agent/index.js';

export class NandaPaymentsClient {
  private readonly paymentClient: PaymentClient;
  private readonly facilitatorClient: FacilitatorClient;
  private readonly agentManager: AgentManager;
  public readonly agentName: string;

  constructor(config: NandaPaymentsClientConfig) {
    this.agentName = config.agentName;

    // Initialize core clients
    this.facilitatorClient = new FacilitatorClient({
      facilitatorUrl: config.facilitatorUrl,
      timeout: config.timeout,
      retryCount: config.retryCount,
      retryDelay: config.retryDelay,
    });

    this.paymentClient = new PaymentClient(config);

    this.agentManager = new AgentManager({
      agentName: config.agentName,
      facilitator: this.facilitatorClient,
    });
  }

  // ============================================================================
  // Payment Operations
  // ============================================================================

  /**
   * Make an x402-compliant request to a resource
   * This is the main method for making requests that may require payment
   */
  async makeRequest<T = unknown>(
    url: string,
    options: RequestOptions = {}
  ): Promise<SuccessfulResponse<T>> {
    return this.paymentClient.makeRequest<T>(url, options);
  }

  /**
   * Make a request with automatic payment handling
   * This method will automatically handle 402 responses by creating and submitting payments
   */
  async makePaymentRequest<T = unknown>(
    url: string,
    paymentOptions: PaymentOptions,
    requestOptions: RequestOptions = {}
  ): Promise<SuccessfulResponse<T>> {
    return this.paymentClient.makePaymentRequest<T>(url, paymentOptions, requestOptions);
  }

  /**
   * Create a payment payload for manual handling
   */
  async createPayment(options: PaymentOptions): Promise<PaymentPayload> {
    return this.paymentClient.createPayment(options);
  }

  // ============================================================================
  // Agent Management
  // ============================================================================

  /**
   * Get current agent balance
   */
  async getBalance(): Promise<BalanceInfo> {
    return this.agentManager.getBalance();
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(query: TransactionQuery = {}): Promise<NPTransaction[]> {
    return this.agentManager.getTransactionHistory(query);
  }

  /**
   * Get specific transaction by ID
   */
  async getTransaction(txId: string): Promise<NPTransaction | null> {
    return this.agentManager.getTransaction(txId);
  }

  /**
   * Get agent information
   */
  async getAgentInfo(): Promise<NPAgent> {
    return this.agentManager.getAgentInfo();
  }

  /**
   * Get wallet information
   */
  async getWalletInfo(): Promise<NPWallet> {
    return this.agentManager.getWalletInfo();
  }

  /**
   * Register or update agent
   */
  async registerAgent(agentInfo: Partial<NPAgent> = {}): Promise<NPAgent> {
    return this.agentManager.registerAgent(agentInfo);
  }

  /**
   * Create a new wallet
   */
  async createWallet(): Promise<NPWallet> {
    return this.agentManager.createWallet();
  }

  /**
   * Get agent summary with key metrics
   */
  async getSummary(): Promise<{
    balance: number;
    totalSent: number;
    totalReceived: number;
    transactionCount: number;
    lastActivity: string | null;
  }> {
    return this.agentManager.getSummary();
  }

  // ============================================================================
  // Facilitator Operations
  // ============================================================================

  /**
   * Check facilitator health
   */
  async checkFacilitatorHealth(): Promise<{ status: string; timestamp: number }> {
    return this.facilitatorClient.health();
  }

  /**
   * Get supported payment schemes
   */
  async getSupportedSchemes() {
    return this.facilitatorClient.supported();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Test the connection to the facilitator
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.facilitatorClient.health();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get SDK configuration
   */
  getConfig(): Readonly<NandaPaymentsClientConfig> {
    return {
      agentName: this.agentName,
      facilitatorUrl: (this.facilitatorClient as any).baseUrl,
      timeout: (this.facilitatorClient as any).timeout,
      retryCount: (this.facilitatorClient as any).retryCount,
      retryDelay: (this.facilitatorClient as any).retryDelay,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

// Main client class
export { NandaPaymentsClient as default };

// Individual components for advanced usage
export { PaymentClient } from './client/index.js';
export { FacilitatorClient } from './facilitator/index.js';
export { AgentManager } from './agent/index.js';

// All types
export * from './types/index.js';

// Convenience function for quick setup
export function createClient(config: NandaPaymentsClientConfig): NandaPaymentsClient {
  return new NandaPaymentsClient(config);
}