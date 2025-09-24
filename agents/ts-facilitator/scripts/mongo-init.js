// MongoDB initialization script for Docker
// This script runs when the MongoDB container starts for the first time

print('Starting NANDA Facilitator database initialization...');

// Switch to the application database
db = db.getSiblingDB('nanda_facilitator');

// Create collections with proper indexes
print('Creating collections and indexes...');

// Agents collection
db.createCollection('agents');
db.agents.createIndex({ "agent_name": 1 }, { unique: true });
db.agents.createIndex({ "email": 1 }, { unique: true });
db.agents.createIndex({ "walletId": 1 }, { unique: true });

// Wallets collection
db.createCollection('wallets');
db.wallets.createIndex({ "walletId": 1 }, { unique: true });
db.wallets.createIndex({ "agent_name": 1 }, { unique: true });

// Transactions collection
db.transactions.createIndex({ "metadata.agent_from": 1 });
db.transactions.createIndex({ "metadata.agent_to": 1 });
db.transactions.createIndex({ "createdAt": 1 });
db.transactions.createIndex({ "status": 1 });
db.transactions.createIndex({
  "metadata.agent_from": 1,
  "metadata.agent_to": 1,
  "createdAt": -1
});

// Payment sessions collection with TTL
db.createCollection('paymentSessions');
db.paymentSessions.createIndex({ "sessionId": 1 }, { unique: true });
db.paymentSessions.createIndex({ "fromAgent": 1 });
db.paymentSessions.createIndex({ "toAgent": 1 });
db.paymentSessions.createIndex({ "status": 1 });
db.paymentSessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 }); // TTL index

print('Collections and indexes created successfully.');

// Create sample agents for development/testing
if (db.getName() === 'nanda_development') {
  print('Creating sample agents for development...');

  const now = new Date().toISOString();

  // Sample agents
  const agents = [
    {
      id: 'test-sender-id',
      agent_name: 'test-sender',
      label: 'Test Sender Agent',
      email: 'sender@test.com',
      description: 'Test agent for sending payments',
      serviceCharge: 100,
      walletId: 'wallet-sender-123',
      created_at: now,
      updated_at: now
    },
    {
      id: 'test-receiver-id',
      agent_name: 'test-receiver',
      label: 'Test Receiver Agent',
      email: 'receiver@test.com',
      description: 'Test agent for receiving payments',
      serviceCharge: 200,
      walletId: 'wallet-receiver-456',
      created_at: now,
      updated_at: now
    },
    {
      id: 'test-poor-id',
      agent_name: 'test-poor',
      label: 'Test Poor Agent',
      email: 'poor@test.com',
      description: 'Test agent with insufficient balance',
      serviceCharge: 50,
      walletId: 'wallet-poor-789',
      created_at: now,
      updated_at: now
    }
  ];

  // Sample wallets
  const wallets = [
    {
      walletId: 'wallet-sender-123',
      agent_name: 'test-sender',
      currency: 'NP',
      scale: 2,
      balanceMinor: 100000, // 1000.00 NP
      createdAt: now,
      updatedAt: now
    },
    {
      walletId: 'wallet-receiver-456',
      agent_name: 'test-receiver',
      currency: 'NP',
      scale: 2,
      balanceMinor: 100000, // 1000.00 NP
      createdAt: now,
      updatedAt: now
    },
    {
      walletId: 'wallet-poor-789',
      agent_name: 'test-poor',
      currency: 'NP',
      scale: 2,
      balanceMinor: 50, // 0.50 NP
      createdAt: now,
      updatedAt: now
    }
  ];

  try {
    db.agents.insertMany(agents);
    print('Sample agents created successfully.');
  } catch (e) {
    print('Sample agents already exist, skipping...');
  }

  try {
    db.wallets.insertMany(wallets);
    print('Sample wallets created successfully.');
  } catch (e) {
    print('Sample wallets already exist, skipping...');
  }
}

print('NANDA Facilitator database initialization completed.');