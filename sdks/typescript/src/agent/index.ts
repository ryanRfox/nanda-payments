/**
 * Agent management utilities for NANDA Points
 */

import {
  NPAgent,
  NPWallet,
  NPTransaction,
  NPPaymentError,
  NPNetworkError,
  BalanceInfo,
  TransactionQuery,
} from '../types/index.js';
import { FacilitatorClient } from '../facilitator/index.js';

export interface AgentManagerOptions {
  agentName: string;
  facilitator: FacilitatorClient;
}


export class AgentManager {
  private readonly agentName: string;
  private readonly facilitator: FacilitatorClient;

  constructor(options: AgentManagerOptions) {
    this.agentName = options.agentName;
    this.facilitator = options.facilitator;
  }

  /**
   * Get current agent balance
   */
  async getBalance(): Promise<BalanceInfo> {
    try {
      // This would typically call a facilitator endpoint for balance
      // For now, we'll make a request to a balance endpoint
      const response = await this.makeAgentRequest('/balance');

      return {
        balance: response.balanceMinor,
        currency: 'NP',
        walletId: response.walletId,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      throw new NPPaymentError(
        'Failed to get agent balance',
        'BALANCE_ERROR',
        error
      );
    }
  }

  /**
   * Get transaction history for the agent
   */
  async getTransactionHistory(query: TransactionQuery = {}): Promise<NPTransaction[]> {
    try {
      const params = new URLSearchParams();

      if (query.limit) params.set('limit', query.limit.toString());
      if (query.offset) params.set('offset', query.offset.toString());
      if (query.fromDate) params.set('fromDate', query.fromDate.toISOString());
      if (query.toDate) params.set('toDate', query.toDate.toISOString());
      if (query.status) params.set('status', query.status);
      if (query.direction) params.set('direction', query.direction);

      const endpoint = `/transactions${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.makeAgentRequest(endpoint);

      return response.transactions || [];
    } catch (error) {
      throw new NPPaymentError(
        'Failed to get transaction history',
        'TRANSACTION_HISTORY_ERROR',
        error
      );
    }
  }

  /**
   * Get specific transaction by ID
   */
  async getTransaction(txId: string): Promise<NPTransaction | null> {
    try {
      const response = await this.makeAgentRequest(`/transaction/${txId}`);
      return response.transaction || null;
    } catch (error) {
      if (error instanceof NPNetworkError && (error.details as any)?.status === 404) {
        return null;
      }
      throw new NPPaymentError(
        'Failed to get transaction',
        'TRANSACTION_ERROR',
        error
      );
    }
  }

  /**
   * Get agent information
   */
  async getAgentInfo(): Promise<NPAgent> {
    try {
      const response = await this.makeAgentRequest('/info');
      return response.agent;
    } catch (error) {
      throw new NPPaymentError(
        'Failed to get agent information',
        'AGENT_INFO_ERROR',
        error
      );
    }
  }

  /**
   * Get wallet information
   */
  async getWalletInfo(): Promise<NPWallet> {
    try {
      const response = await this.makeAgentRequest('/wallet');
      return response.wallet;
    } catch (error) {
      throw new NPPaymentError(
        'Failed to get wallet information',
        'WALLET_INFO_ERROR',
        error
      );
    }
  }

  /**
   * Register or update agent information
   */
  async registerAgent(agentInfo: Partial<NPAgent>): Promise<NPAgent> {
    try {
      const response = await this.makeAgentRequest('/register', {
        method: 'POST',
        body: {
          agent_name: this.agentName,
          ...agentInfo,
        },
      });
      return response.agent;
    } catch (error) {
      throw new NPPaymentError(
        'Failed to register agent',
        'AGENT_REGISTRATION_ERROR',
        error
      );
    }
  }

  /**
   * Create a new wallet for the agent
   */
  async createWallet(): Promise<NPWallet> {
    try {
      const response = await this.makeAgentRequest('/wallet', {
        method: 'POST',
        body: {
          agent_name: this.agentName,
          currency: 'NP',
          scale: 0,
        },
      });
      return response.wallet;
    } catch (error) {
      throw new NPPaymentError(
        'Failed to create wallet',
        'WALLET_CREATION_ERROR',
        error
      );
    }
  }

  /**
   * Get summary statistics for the agent
   */
  async getSummary(): Promise<{
    balance: number;
    totalSent: number;
    totalReceived: number;
    transactionCount: number;
    lastActivity: string | null;
  }> {
    try {
      const [balance, recentTransactions] = await Promise.all([
        this.getBalance(),
        this.getTransactionHistory({ limit: 100 }),
      ]);

      const sent = recentTransactions
        .filter(tx => tx.fromAgent === this.agentName && tx.status === 'completed')
        .reduce((sum, tx) => sum + tx.amountMinor, 0);

      const received = recentTransactions
        .filter(tx => tx.toAgent === this.agentName && tx.status === 'completed')
        .reduce((sum, tx) => sum + tx.amountMinor, 0);

      const lastActivity = recentTransactions.length > 0
        ? recentTransactions[0]?.timestamp ?? null
        : null;

      return {
        balance: balance.balance,
        totalSent: sent,
        totalReceived: received,
        transactionCount: recentTransactions.length,
        lastActivity,
      };
    } catch (error) {
      throw new NPPaymentError(
        'Failed to get agent summary',
        'AGENT_SUMMARY_ERROR',
        error
      );
    }
  }

  /**
   * Make a request to the facilitator for agent-specific endpoints
   */
  private async makeAgentRequest(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
    } = {}
  ): Promise<any> {
    try {
      // This would use the facilitator client to make agent-specific requests
      // For now, we'll simulate the structure
      const url = `${(this.facilitator as any).baseUrl}/agents/${this.agentName}${endpoint}`;

      const response = await (globalThis as any).fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': '@nanda/payments-sdk',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new NPNetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          { status: response.status, endpoint, errorData }
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof NPNetworkError) {
        throw error;
      }

      throw new NPNetworkError(
        `Agent request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { endpoint, originalError: error }
      );
    }
  }
}