import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { loadConfig } from '../../src/models/config.js';
import { DatabaseService } from '../../src/services/database.js';
import { WalletService } from '../../src/services/wallet-service.js';
import { AgentService } from '../../src/services/agent-service.js';
import { TransactionService } from '../../src/services/transaction-service.js';
import { PaymentSessionService } from '../../src/services/payment-session-service.js';

/**
 * Test Environment Setup
 *
 * Provides isolated MongoDB instance and initialized services for integration tests.
 * Each test gets a clean database state.
 */

let mongod: MongoMemoryServer;
let testServices: {
  config: ReturnType<typeof loadConfig>;
  db: DatabaseService;
  walletService: WalletService;
  agentService: AgentService;
  transactionService: TransactionService;
  paymentSessionService: PaymentSessionService;
};

export async function setupTestEnvironment() {
  // Start in-memory MongoDB
  mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();

  // Create test configuration
  const config = loadConfig();
  config.mongodb.uri = mongoUri;
  config.mongodb.dbName = 'nanda_test';

  // Initialize services
  const db = new DatabaseService(config);
  await db.connect();

  const walletService = new WalletService(db);
  const agentService = new AgentService(db, walletService, config);
  const transactionService = new TransactionService(db, walletService);
  const paymentSessionService = new PaymentSessionService(db, walletService, transactionService, config);

  testServices = {
    config,
    db,
    walletService,
    agentService,
    transactionService,
    paymentSessionService,
  };

  return testServices;
}

export async function cleanupTestEnvironment() {
  if (testServices?.db) {
    // Stop cleanup interval (if method exists)
    if (typeof testServices.paymentSessionService.stopPeriodicCleanup === 'function') {
      testServices.paymentSessionService.stopPeriodicCleanup();
    }
    await testServices.db.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
}

export async function clearTestData() {
  if (!testServices?.db) return;

  const db = testServices.db.getDb();
  await db.collection('agents').deleteMany({});
  await db.collection('wallets').deleteMany({});
  await db.collection('transactions').deleteMany({});
  await db.collection('paymentSessions').deleteMany({});
}

export function getTestServices() {
  if (!testServices) {
    throw new Error('Test environment not initialized. Call setupTestEnvironment() first.');
  }
  return testServices;
}

/**
 * Create test agents with wallets for testing (without transactions)
 */
export async function createTestAgents() {
  const { db, config } = getTestServices();
  const { randomUUID } = await import('crypto');

  const agents = [
    {
      agent_name: 'test-sender',
      label: 'Test Sender Agent',
      email: 'sender@test.com',
      description: 'Test agent for sending payments',
      serviceCharge: 100, // 1.00 NP
    },
    {
      agent_name: 'test-receiver',
      label: 'Test Receiver Agent',
      email: 'receiver@test.com',
      description: 'Test agent for receiving payments',
      serviceCharge: 200, // 2.00 NP
    },
    {
      agent_name: 'test-poor',
      label: 'Test Poor Agent',
      email: 'poor@test.com',
      description: 'Test agent with insufficient balance',
      serviceCharge: 50, // 0.50 NP
    },
  ];

  const createdAgents = [];
  for (const agentData of agents) {
    const now = new Date().toISOString();
    const walletId = randomUUID();

    // Create agent directly
    const agent = {
      id: randomUUID(),
      ...agentData,
      walletId,
      created_at: now,
      updated_at: now,
    };

    await db.collections.agents.insertOne(agent);

    // Create wallet directly
    const defaultBalance = agentData.agent_name === 'test-poor' ? 50 : config.nandaPoints.defaultBalanceMinor;
    const wallet = {
      walletId,
      agent_name: agent.agent_name,
      currency: 'NP' as const,
      scale: 2,
      balanceMinor: defaultBalance,
      createdAt: now,
      updatedAt: now,
    };

    await db.collections.wallets.insertOne(wallet);
    createdAgents.push(agent);
  }

  return createdAgents;
}

/**
 * Create mock x402 payment payload for testing
 */
export function createMockX402Payload(options: {
  fromWalletId: string;
  toWalletId: string;
  amount: string;
}) {
  return {
    scheme: 'exact',
    network: 'nanda-network',
    x402Version: 1,
    payload: {
      authorization: {
        from: options.fromWalletId,
        to: options.toWalletId,
        value: options.amount,
        validAfter: new Date(Date.now() - 60000).toISOString(),
        validBefore: new Date(Date.now() + 300000).toISOString(),
        nonce: Math.random().toString(36).substring(2),
      },
      signature: 'mock-signature-' + Math.random().toString(36).substring(2),
    },
  };
}

/**
 * Create mock x402 payment requirements for testing
 */
export function createMockX402Requirements(options: {
  amount: string;
  resource: string;
  description?: string;
}) {
  return {
    scheme: 'exact',
    description: options.description || 'Test payment requirement',
    network: 'nanda-network',
    maxAmountRequired: options.amount,
    resource: options.resource,
    extra: {},
  };
}