import { MongoClient, Db, Collection, IndexSpecification, CreateIndexesOptions, Document, ClientSession } from 'mongodb';
import type { Config } from '../models/config.js';
import { useTransactions } from '../models/config.js';
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
  private readonly fullConfig: Config;

  constructor(fullConfig: Config) {
    this.config = fullConfig.mongodb;
    this.fullConfig = fullConfig;
  }

  /**
   * Connect to MongoDB and ensure indexes
   */
  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(this.config.uri, {
        maxPoolSize: this.config.maxConnections,
        // Force IPv4 to prevent IPv6 connection issues
        family: 4,
        // Reduce timeout to fail fast on connection issues
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        // Production-grade options
        retryWrites: true,
        retryReads: true,
      });

      await this.client.connect();
      this.db = this.client.db(this.config.dbName);

      await this.ensureIndexes();

      // Verify replica set if transactions enabled
      if (useTransactions(this.fullConfig)) {
        const admin = this.client.db('admin');
        const status = await admin.command({ replSetGetStatus: 1 }).catch(() => null);

        if (!status) {
          console.warn('⚠️  WARNING: MONGODB_USE_TRANSACTIONS=true but not running as replica set!');
          console.warn('⚠️  Transactions will fail. Set MONGODB_USE_TRANSACTIONS=false for dev mode.');
        } else {
          console.log('✅ MongoDB replica set detected - transactions enabled');
        }
      } else {
        console.log('ℹ️  Running in dev mode - transactions disabled');
      }

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

    // Helper to create index safely (ignore if exists)
    const createIndexSafe = async <T extends Document = Document>(
      collection: Collection<T>,
      spec: IndexSpecification,
      options?: CreateIndexesOptions
    ) => {
      try {
        await collection.createIndex(spec, options);
      } catch (error: unknown) {
        // Ignore index already exists errors
        const mongoError = error as { code?: number; codeName?: string };
        if (mongoError.code !== 86 && mongoError.codeName !== 'IndexKeySpecsConflict') {
          throw error;
        }
      }
    };

    // Create indexes one by one to handle conflicts
    // Agents collection indexes
    await createIndexSafe(agents, { agent_name: 1 }, { unique: true });
    await createIndexSafe(agents, { walletId: 1 }, { unique: true, sparse: true });
    await createIndexSafe(agents, { email: 1 }, { unique: true, sparse: true });
    await createIndexSafe(agents, { created_at: -1 });

    // Wallets collection indexes
    await createIndexSafe(wallets, { walletId: 1 }, { unique: true });
    await createIndexSafe(wallets, { agent_name: 1 });
    await createIndexSafe(wallets, { balanceMinor: 1 });
    await createIndexSafe(wallets, { updatedAt: -1 });

    // Transactions collection indexes
    await createIndexSafe(transactions, { id: 1 }, { unique: true });
    await createIndexSafe(transactions, { fromWallet: 1, createdAt: -1 });
    await createIndexSafe(transactions, { toWallet: 1, createdAt: -1 });
    await createIndexSafe(transactions, { status: 1, createdAt: -1 });
    await createIndexSafe(transactions, { type: 1, createdAt: -1 });
    await createIndexSafe(transactions, { 'metadata.agent_from': 1 });
    await createIndexSafe(transactions, { 'metadata.agent_to': 1 });
    await createIndexSafe(transactions, { 'metadata.session_id': 1 });

    // Payment sessions collection indexes
    await createIndexSafe(paymentSessions, { sessionId: 1 }, { unique: true });
    await createIndexSafe(paymentSessions, { status: 1, expiresAt: 1 });
    await createIndexSafe(paymentSessions, { fromAgent: 1, createdAt: -1 });
    await createIndexSafe(paymentSessions, { toAgent: 1, createdAt: -1 });
    await createIndexSafe(paymentSessions, { expiresAt: 1 }, { expireAfterSeconds: 0 });

    console.log('✅ Database indexes ensured');
  }


  /**
   * Execute operation within a transaction (if enabled)
   * Falls back to direct execution in dev mode
   */
  async withTransaction<T>(
    operation: (session?: ClientSession) => Promise<T>
  ): Promise<T> {
    if (!this.client) {
      throw new Error('Database not connected');
    }

    if (!useTransactions(this.fullConfig)) {
      // Dev mode: run without transaction
      return await operation(undefined);
    }

    // Prod mode: use transaction
    const session = this.client.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result!;
    } finally {
      await session.endSession();
    }
  }
}