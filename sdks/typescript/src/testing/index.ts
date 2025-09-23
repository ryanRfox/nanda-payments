/**
 * Testing utilities for NANDA Payments SDK
 * Provides mock servers and test helpers for development and testing
 */

import { createServer } from 'http';
import {
  PaymentPayload,
  PaymentRequirements,
  VerificationResponse,
  SettlementResponse,
  SupportedResponse,
  NPReceipt,
  NPTransaction,
  NPAgent,
  NPWallet,
} from '../types/index.js';

export interface MockFacilitatorOptions {
  port?: number;
  autoRespond?: boolean;
  defaultBalance?: number;
}

export interface MockTransaction {
  payment: PaymentPayload;
  requirements: PaymentRequirements;
  verified: boolean;
  settled: boolean;
  timestamp: number;
}

/**
 * Mock facilitator server for testing
 */
export class MockFacilitator {
  private server: any;
  private port: number;
  private transactions: Map<string, MockTransaction> = new Map();
  private agentBalances: Map<string, number> = new Map();
  private defaultBalance: number;

  constructor(options: MockFacilitatorOptions = {}) {
    this.port = options.port || 3001;
    this.defaultBalance = options.defaultBalance || 1000;

    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });
  }

  /**
   * Start the mock facilitator server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`Mock facilitator running on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the mock facilitator server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  /**
   * Get the mock facilitator URL
   */
  get url(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Set balance for an agent
   */
  setAgentBalance(agentName: string, balance: number): void {
    this.agentBalances.set(agentName, balance);
  }

  /**
   * Get transactions for testing inspection
   */
  getTransactions(): MockTransaction[] {
    return Array.from(this.transactions.values());
  }

  /**
   * Clear all mock data
   */
  reset(): void {
    this.transactions.clear();
    this.agentBalances.clear();
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: any, res: any): Promise<void> {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    let body = '';
    req.on('data', (chunk: any) => body += chunk);
    req.on('end', () => {
      try {
        this.routeRequest(req.method, req.url, body, res);
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  }

  /**
   * Route requests to appropriate handlers
   */
  private routeRequest(method: string, url: string, body: string, res: any): void {
    console.log(`Mock facilitator: ${method} ${url}`);

    switch (`${method} ${url}`) {
      case 'POST /verify':
        this.handleVerify(body, res);
        break;
      case 'POST /settle':
        this.handleSettle(body, res);
        break;
      case 'GET /supported':
        this.handleSupported(res);
        break;
      case 'GET /health':
        this.handleHealth(res);
        break;
      default:
        if (url.startsWith('/agents/')) {
          this.handleAgentRequest(method, url, body, res);
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
        }
    }
  }

  /**
   * Handle payment verification
   */
  private handleVerify(body: string, res: any): void {
    const { payment, paymentRequirements } = JSON.parse(body);

    // Basic validation
    const isValid = (
      payment.scheme === 'nanda-points' &&
      payment.payTo === paymentRequirements.payTo &&
      parseInt(payment.amount) <= parseInt(paymentRequirements.maxAmountRequired)
    );

    const response: VerificationResponse = {
      isValid,
      invalidReason: isValid ? undefined : 'Payment validation failed',
      payer: payment.from,
      amount: payment.amount,
      txId: payment.txId,
    };

    if (isValid) {
      this.transactions.set(payment.txId, {
        payment,
        requirements: paymentRequirements,
        verified: true,
        settled: false,
        timestamp: Date.now(),
      });
    }

    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  /**
   * Handle payment settlement
   */
  private handleSettle(body: string, res: any): void {
    const { payment, paymentRequirements } = JSON.parse(body);

    const transaction = this.transactions.get(payment.txId);
    if (!transaction || !transaction.verified) {
      res.writeHead(400);
      res.end(JSON.stringify({
        success: false,
        errorReason: 'Transaction not found or not verified',
      }));
      return;
    }

    // Check balances
    const fromBalance = this.agentBalances.get(payment.from) || this.defaultBalance;
    const amount = parseInt(payment.amount);

    if (fromBalance < amount) {
      res.writeHead(400);
      res.end(JSON.stringify({
        success: false,
        errorReason: 'Insufficient balance',
      }));
      return;
    }

    // Update balances
    const toBalance = this.agentBalances.get(payment.payTo) || this.defaultBalance;
    this.agentBalances.set(payment.from, fromBalance - amount);
    this.agentBalances.set(payment.payTo, toBalance + amount);

    // Mark as settled
    transaction.settled = true;

    const receipt: NPReceipt = {
      txId: payment.txId,
      fromAgent: payment.from,
      toAgent: payment.payTo,
      amountMinor: amount,
      amountPoints: amount,
      timestamp: new Date().toISOString(),
      fromBalanceAfter: fromBalance - amount,
      toBalanceAfter: toBalance + amount,
    };

    const response: SettlementResponse = {
      success: true,
      txId: payment.txId,
      amount: payment.amount,
      from: payment.from,
      to: payment.payTo,
      timestamp: Date.now(),
      receipt,
    };

    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  /**
   * Handle supported schemes request
   */
  private handleSupported(res: any): void {
    const response: SupportedResponse = {
      kinds: [{
        scheme: 'nanda-points',
        network: 'nanda-network',
        asset: 'NP',
        extra: {
          facilitatorUrl: this.url,
        },
      }],
    };

    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  /**
   * Handle health check
   */
  private handleHealth(res: any): void {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: Date.now(),
    }));
  }

  /**
   * Handle agent-specific requests
   */
  private handleAgentRequest(method: string, url: string, body: string, res: any): void {
    const urlParts = url.split('/');
    const agentName = urlParts[2];
    const endpoint = '/' + urlParts.slice(3).join('/');

    switch (`${method} ${endpoint}`) {
      case 'GET /balance':
        this.handleAgentBalance(agentName, res);
        break;
      case 'GET /transactions':
        this.handleAgentTransactions(agentName, res);
        break;
      case 'GET /info':
        this.handleAgentInfo(agentName, res);
        break;
      case 'GET /wallet':
        this.handleWalletInfo(agentName, res);
        break;
      default:
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Agent endpoint not found' }));
    }
  }

  /**
   * Handle agent balance request
   */
  private handleAgentBalance(agentName: string, res: any): void {
    const balance = this.agentBalances.get(agentName) || this.defaultBalance;

    res.writeHead(200);
    res.end(JSON.stringify({
      balanceMinor: balance,
      walletId: `wallet_${agentName}`,
    }));
  }

  /**
   * Handle agent transactions request
   */
  private handleAgentTransactions(agentName: string, res: any): void {
    const transactions = Array.from(this.transactions.values())
      .filter(tx => tx.payment.from === agentName || tx.payment.payTo === agentName)
      .map(tx => ({
        txId: tx.payment.txId,
        fromAgent: tx.payment.from,
        toAgent: tx.payment.payTo,
        amountMinor: parseInt(tx.payment.amount),
        status: tx.settled ? 'completed' : 'pending',
        timestamp: new Date(tx.timestamp).toISOString(),
      }));

    res.writeHead(200);
    res.end(JSON.stringify({ transactions }));
  }

  /**
   * Handle agent info request
   */
  private handleAgentInfo(agentName: string, res: any): void {
    const agent: NPAgent = {
      agent_name: agentName,
      walletId: `wallet_${agentName}`,
      serviceCharge: 0,
    };

    res.writeHead(200);
    res.end(JSON.stringify({ agent }));
  }

  /**
   * Handle wallet info request
   */
  private handleWalletInfo(agentName: string, res: any): void {
    const balance = this.agentBalances.get(agentName) || this.defaultBalance;
    const wallet: NPWallet = {
      walletId: `wallet_${agentName}`,
      agent_name: agentName,
      balanceMinor: balance,
      currency: 'NP',
      scale: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.writeHead(200);
    res.end(JSON.stringify({ wallet }));
  }
}

/**
 * Create a mock facilitator for testing
 */
export function createMockFacilitator(options: MockFacilitatorOptions = {}): MockFacilitator {
  return new MockFacilitator(options);
}

/**
 * Test payment generator for creating test payments
 */
export class TestPaymentGenerator {
  private counter = 0;

  /**
   * Generate a test payment payload
   */
  generatePayment(options: {
    from?: string;
    to?: string;
    amount?: number;
  } = {}): PaymentPayload {
    this.counter++;

    return {
      x402Version: 1,
      scheme: 'nanda-points',
      network: 'nanda-network',
      payTo: options.to || 'test-recipient',
      amount: (options.amount || 10).toString(),
      from: options.from || 'test-sender',
      txId: `test_tx_${this.counter}_${Date.now()}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate test payment requirements
   */
  generatePaymentRequirements(options: {
    amount?: number;
    recipient?: string;
    resource?: string;
  } = {}): PaymentRequirements {
    return {
      scheme: 'nanda-points',
      network: 'nanda-network',
      maxAmountRequired: (options.amount || 10).toString(),
      resource: options.resource || 'https://test.example.com/api/resource',
      description: `Test payment of ${options.amount || 10} NP`,
      mimeType: 'application/json',
      payTo: options.recipient || 'test-recipient',
      maxTimeoutSeconds: 60,
      asset: 'NP',
      extra: {
        facilitatorUrl: 'http://localhost:3001',
      },
    };
  }
}

/**
 * Create a test payment generator
 */
export function createTestPaymentGenerator(): TestPaymentGenerator {
  return new TestPaymentGenerator();
}