#!/usr/bin/env node

/**
 * Database Seed Script
 *
 * Seeds the NANDA Points database with initial agents and wallets
 * for development and testing purposes.
 */

import { config } from 'dotenv';
import { DatabaseService } from '../services/database.js';
import { WalletService } from '../services/wallet-service.js';
import { AgentService } from '../services/agent-service.js';
import { loadConfig } from '../models/config.js';
import type { CreateAgentInput } from '../models/agent.js';

// Load environment variables
config();

/**
 * Sample agents for seeding
 */
const sampleAgents: CreateAgentInput[] = [
  {
    agent_name: 'search-agent',
    label: 'Search Agent',
    description: 'Advanced search capabilities with semantic understanding',
    version: '1.0.0',
    documentationUrl: 'https://docs.nanda.org/agents/search',
    jurisdiction: 'USA',
    provider: {
      name: 'NANDA',
      url: 'https://nanda.org',
      did: 'did:web:nanda.org:agents:search',
    },
    endpoints: {
      static: ['https://search.nanda.org/api'],
      adaptive_resolver: {
        url: 'https://search.nanda.org/resolve',
        policies: ['rate-limit', 'auth-required'],
      },
    },
    capabilities: {
      modalities: ['text', 'structured-data'],
      streaming: true,
      batch: true,
      authentication: {
        methods: ['api-key', 'oauth2'],
        requiredScopes: ['search:read'],
      },
    },
    skills: [
      {
        id: 'semantic-search',
        description: 'Semantic search across multiple data sources',
        inputModes: ['text', 'json'],
        outputModes: ['json', 'markdown'],
        supportedLanguages: ['en', 'es', 'fr'],
      },
    ],
    evaluations: {
      performanceScore: 95,
      availability90d: '99.9%',
      lastAudited: new Date().toISOString(),
      auditTrail: 'https://audit.nanda.org/search-agent',
      auditorID: 'audit-system-v1',
    },
    telemetry: {
      enabled: true,
      retention: '30d',
      sampling: 0.1,
      metrics: {
        latency_p95_ms: 250,
        throughput_rps: 1000,
        error_rate: 0.001,
        availability: '99.99%',
      },
    },
    certification: {
      level: 'verified',
      issuer: 'NANDA Certification Authority',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    serviceCharge: 10, // 10 NP per request
    username: 'search_agent',
    email: 'search@nanda.org',
  },
  {
    agent_name: 'summary-agent',
    label: 'Summary Agent',
    description: 'Document summarization and content extraction',
    version: '1.0.0',
    documentationUrl: 'https://docs.nanda.org/agents/summary',
    jurisdiction: 'USA',
    provider: {
      name: 'NANDA',
      url: 'https://nanda.org',
      did: 'did:web:nanda.org:agents:summary',
    },
    endpoints: {
      static: ['https://summary.nanda.org/api'],
      adaptive_resolver: {
        url: 'https://summary.nanda.org/resolve',
        policies: ['rate-limit', 'auth-required'],
      },
    },
    capabilities: {
      modalities: ['text', 'document'],
      streaming: false,
      batch: true,
      authentication: {
        methods: ['api-key'],
        requiredScopes: ['summary:write'],
      },
    },
    skills: [
      {
        id: 'document-summary',
        description: 'Summarize documents and extract key points',
        inputModes: ['text', 'pdf', 'html'],
        outputModes: ['text', 'json', 'markdown'],
        supportedLanguages: ['en'],
      },
    ],
    evaluations: {
      performanceScore: 92,
      availability90d: '99.5%',
      lastAudited: new Date().toISOString(),
      auditTrail: 'https://audit.nanda.org/summary-agent',
      auditorID: 'audit-system-v1',
    },
    telemetry: {
      enabled: true,
      retention: '7d',
      sampling: 0.1,
      metrics: {
        latency_p95_ms: 500,
        throughput_rps: 500,
        error_rate: 0.002,
        availability: '99.9%',
      },
    },
    certification: {
      level: 'verified',
      issuer: 'NANDA Certification Authority',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    serviceCharge: 25, // 25 NP per request
    username: 'summary_agent',
    email: 'summary@nanda.org',
  },
  {
    agent_name: 'test-agent',
    label: 'Test Agent',
    description: 'Agent for testing and development',
    version: '1.0.0',
    documentationUrl: 'https://docs.nanda.org/agents/test',
    jurisdiction: 'USA',
    provider: {
      name: 'NANDA Dev',
      url: 'https://dev.nanda.org',
      did: 'did:web:nanda.org:agents:test',
    },
    endpoints: {
      static: ['https://test.nanda.org/api'],
      adaptive_resolver: {
        url: '',
        policies: [],
      },
    },
    capabilities: {
      modalities: ['text'],
      streaming: false,
      batch: false,
      authentication: {
        methods: [],
        requiredScopes: [],
      },
    },
    skills: [],
    evaluations: {
      performanceScore: 100,
      availability90d: '100%',
      lastAudited: new Date().toISOString(),
      auditTrail: '',
      auditorID: '',
    },
    telemetry: {
      enabled: false,
      retention: '1d',
      sampling: 1.0,
      metrics: {
        latency_p95_ms: 10,
        throughput_rps: 10000,
        error_rate: 0,
        availability: '100%',
      },
    },
    certification: {
      level: 'unverified',
      issuer: 'NANDA Dev',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    serviceCharge: 1, // 1 NP per request (cheap for testing)
    username: 'test_agent',
    email: 'test@nanda.org',
  },
  {
    agent_name: 'weather-agent',
    label: 'Weather Agent',
    description: 'Real-time weather data and forecasting services',
    version: '1.0.0',
    documentationUrl: 'https://docs.nanda.org/agents/weather',
    jurisdiction: 'USA',
    provider: {
      name: 'NANDA Weather',
      url: 'https://weather.nanda.org',
      did: 'did:web:nanda.org:agents:weather',
    },
    endpoints: {
      static: ['https://weather.nanda.org/api'],
      adaptive_resolver: {
        url: 'https://weather.nanda.org/resolve',
        policies: ['rate-limit', 'auth-required'],
      },
    },
    capabilities: {
      modalities: ['text', 'structured-data'],
      streaming: false,
      batch: true,
      authentication: {
        methods: ['api-key'],
        requiredScopes: ['weather:read'],
      },
    },
    skills: [
      {
        id: 'current-weather',
        description: 'Get current weather conditions for any location',
        inputModes: ['text', 'json'],
        outputModes: ['json', 'text'],
        supportedLanguages: ['en'],
      },
      {
        id: 'weather-forecast',
        description: 'Multi-day weather forecasting',
        inputModes: ['text', 'json'],
        outputModes: ['json', 'text'],
        supportedLanguages: ['en'],
      },
    ],
    evaluations: {
      performanceScore: 98,
      availability90d: '99.8%',
      lastAudited: new Date().toISOString(),
      auditTrail: 'https://audit.nanda.org/weather-agent',
      auditorID: 'audit-system-v1',
    },
    telemetry: {
      enabled: true,
      retention: '14d',
      sampling: 0.1,
      metrics: {
        latency_p95_ms: 150,
        throughput_rps: 2000,
        error_rate: 0.0005,
        availability: '99.95%',
      },
    },
    certification: {
      level: 'verified',
      issuer: 'NANDA Certification Authority',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    serviceCharge: 3, // 3 NP per request
    username: 'weather_agent',
    email: 'weather@nanda.org',
  },
];

/**
 * Main seed function
 */
async function seed() {
  console.log('🌱 Starting database seed...');

  // Check for --reset flag to clear existing data
  const shouldReset = process.argv.includes('--reset');

  const config = loadConfig();
  const db = new DatabaseService(config);

  try {
    // Connect to database
    await db.connect();
    console.log('✅ Connected to MongoDB');

    // Initialize services
    const walletService = new WalletService(db);
    const agentService = new AgentService(db, walletService, config);

    // Only clear existing data if --reset flag is provided
    if (shouldReset) {
      console.log('🧹 Clearing existing data (--reset flag provided)...');
      await db.collections.agents.deleteMany({});
      await db.collections.wallets.deleteMany({});
      await db.collections.transactions.deleteMany({});
      await db.collections.paymentSessions.deleteMany({});
    } else {
      console.log('📄 Preserving existing data (use --reset to clear)...');
    }

    // Seed agents (which automatically creates wallets)
    console.log('🏗️ Creating agents and wallets...');
    const createdAgents = await agentService.seedAgents(sampleAgents);

    // Log summary
    console.log('\n📊 Seed Summary:');
    console.log(`  • Created ${createdAgents.length} agents`);
    console.log(`  • Each agent has a wallet with 100.00 NP`);

    console.log('\n👤 Created Agents:');
    for (const agent of createdAgents) {
      const wallet = await walletService.getWalletByAgent(agent.agent_name);
      console.log(`  • ${agent.label} (${agent.agent_name})`);
      console.log(`    - Service Charge: ${agent.serviceCharge} NP`);
      console.log(`    - Wallet Balance: ${wallet ? wallet.balanceMinor / 100 : 0} NP`);
    }

    console.log('\n✅ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((error) => {
    console.error('❌ Fatal seed error:', error);
    process.exit(1);
  });
}