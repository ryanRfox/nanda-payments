import { MongoClient, Db } from 'mongodb';
import type { Config } from '../models/config.js';
import type { Agent } from '../models/agent.js';
import type { Wallet } from '../models/wallet.js';
import type { Transaction } from '../models/transaction.js';
import type { PaymentSession } from '../models/payment-session.js';

/**
 * Database Service
 *
 * Manages MongoDB connection and provides typed collection access.
 * Handles connection pooling, indexing, and database lifecycle.
 */
export class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private readonly config: Config['mongodb'];

  constructor(config: Config['mongodb']) {
    this.config = config;
  }

  /**
   * Connect to MongoDB and ensure indexes
   */
  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(this.config.uri, {
        maxPoolSize: this.config.maxConnections,
      });

      await this.client.connect();
      this.db = this.client.db(this.config.dbName);

      await this.ensureIndexes();

      console.log(`✅ Connected to MongoDB: ${this.config.dbName}`);
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('✅ Disconnected from MongoDB');
    }
  }

  /**
   * Get database instance (throws if not connected)
   */
  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get typed collection references
   */
  get collections() {
    const db = this.getDb();
    return {
      agents: db.collection<Agent>('agents'),
      wallets: db.collection<Wallet>('wallets'),
      transactions: db.collection<Transaction>('transactions'),
      paymentSessions: db.collection<PaymentSession>('paymentSessions'),
    };
  }

  /**
   * Health check - verify database connectivity
   */
  async healthCheck(): Promise<{ status: string; database: string }> {
    try {
      await this.getDb().admin().ping();
      return {
        status: 'healthy',
        database: this.config.dbName,
      };
    } catch {
      return {
        status: 'unhealthy',
        database: this.config.dbName,
      };
    }
  }

  /**
   * Ensure all required indexes exist
   */
  private async ensureIndexes(): Promise<void> {
    const { agents, wallets, transactions, paymentSessions } = this.collections;

    await Promise.all([
      // Agents collection indexes
      agents.createIndex({ agent_name: 1 }, { unique: true }),
      agents.createIndex({ walletId: 1 }, { unique: true, sparse: true }),
      agents.createIndex({ email: 1 }, { unique: true }),
      agents.createIndex({ created_at: -1 }),

      // Wallets collection indexes
      wallets.createIndex({ walletId: 1 }, { unique: true }),
      wallets.createIndex({ agent_name: 1 }, { unique: true }),
      wallets.createIndex({ balanceMinor: 1 }),
      wallets.createIndex({ updatedAt: -1 }),

      // Transactions collection indexes
      transactions.createIndex({ id: 1 }, { unique: true }),
      transactions.createIndex({ fromWallet: 1, createdAt: -1 }),
      transactions.createIndex({ toWallet: 1, createdAt: -1 }),
      transactions.createIndex({ status: 1, createdAt: -1 }),
      transactions.createIndex({ type: 1, createdAt: -1 }),
      transactions.createIndex({ 'metadata.agent_from': 1 }),
      transactions.createIndex({ 'metadata.agent_to': 1 }),
      transactions.createIndex({ 'metadata.session_id': 1 }),

      // Payment sessions collection indexes
      paymentSessions.createIndex({ sessionId: 1 }, { unique: true }),
      paymentSessions.createIndex({ status: 1, expiresAt: 1 }),
      paymentSessions.createIndex({ fromAgent: 1, createdAt: -1 }),
      paymentSessions.createIndex({ toAgent: 1, createdAt: -1 }),
      paymentSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), // TTL index
    ]);

    console.log('✅ Database indexes ensured');
  }

  /**
   * Start a transaction session for atomic operations
   */
  async withTransaction<T>(
    operation: (session: any) => Promise<T> // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<T> {
    if (!this.client) {
      throw new Error('Database not connected');
    }

    const session = this.client.startSession();

    try {
      return await session.withTransaction(async () => {
        return await operation(session);
      });
    } finally {
      await session.endSession();
    }
  }
}