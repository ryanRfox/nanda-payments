import { randomUUID } from 'crypto';
import type { DatabaseService } from './database.js';
import type { WalletService } from './wallet-service.js';
import {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
} from '../models/agent.js';
import type { Config } from '../models/config.js';

/**
 * Agent Service
 *
 * Manages AI agent lifecycle, metadata, and wallet associations.
 * Handles agent registration, updates, and wallet creation.
 */
export class AgentService {
  constructor(
    private db: DatabaseService,
    private walletService: WalletService,
    private config: Config
  ) {}

  /**
   * Create a new agent with associated wallet
   */
  async createAgent(input: CreateAgentInput): Promise<Agent> {
    const now = new Date().toISOString();
    const walletId = randomUUID();

    const agent: Agent = {
      id: randomUUID(),
      ...input,
      walletId,
      created_at: now,
      updated_at: now,
    };

    // Create agent and wallet together
    return await this.db.withTransaction(async () => {
      // Insert agent
      await this.db.collections.agents.insertOne(agent);

      // Create associated wallet with the same walletId as the agent
      // Set consistent balance for all agents
      let customBalance = 10000; // 100.0 NP in minor units for all agents

      await this.walletService.createWallet({
        walletId: agent.walletId, // Use the same UUID as the agent
        agent_name: agent.agent_name,
        currency: 'NP',
        scale: 2,
        balanceMinor: customBalance,
      });

      return agent;
    });
  }

  /**
   * Get agent by name
   */
  async getAgentByName(agentName: string): Promise<Agent | null> {
    return await this.db.collections.agents.findOne({ agent_name: agentName });
  }

  /**
   * Get agent by ID
   */
  async getAgentById(id: string): Promise<Agent | null> {
    return await this.db.collections.agents.findOne({ id });
  }

  /**
   * Update agent information
   */
  async updateAgent(agentName: string, updates: Partial<UpdateAgentInput>): Promise<Agent | null> {
    const now = new Date().toISOString();

    const result = await this.db.collections.agents.findOneAndUpdate(
      { agent_name: agentName },
      {
        $set: {
          ...updates,
          updated_at: now,
        },
      },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Update agent service charge
   */
  async updateServiceCharge(agentName: string, serviceCharge: number): Promise<Agent | null> {
    if (serviceCharge < 0) {
      throw new Error('Service charge cannot be negative');
    }

    return await this.updateAgent(agentName, { serviceCharge });
  }

  /**
   * List agents with pagination and filtering
   */
  async listAgents(options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<{
    agents: Agent[];
    total: number;
  }> {
    const { limit = 20, offset = 0, search } = options;

    // Build query
    const query: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (search) {
      query.$or = [
        { agent_name: { $regex: search, $options: 'i' } },
        { label: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [agents, total] = await Promise.all([
      this.db.collections.agents
        .find(query)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(offset)
        .toArray(),
      this.db.collections.agents.countDocuments(query),
    ]);

    return { agents, total };
  }

  /**
   * Get agent with wallet information
   */
  async getAgentWithWallet(agentName: string): Promise<{
    agent: Agent;
    wallet: {
      walletId: string;
      balanceMinor: number;
      balanceNP: number;
      formatted: string;
    };
  } | null> {
    const agent = await this.getAgentByName(agentName);
    if (!agent) return null;

    const walletBalance = await this.walletService.getBalance(agent.walletId);
    if (!walletBalance) return null;

    return {
      agent,
      wallet: {
        walletId: agent.walletId,
        ...walletBalance,
      },
    };
  }

  /**
   * Check if agent exists
   */
  async agentExists(agentName: string): Promise<boolean> {
    const count = await this.db.collections.agents.countDocuments({ agent_name: agentName });
    return count > 0;
  }

  /**
   * Delete agent and associated wallet
   */
  async deleteAgent(agentName: string): Promise<boolean> {
    const agent = await this.getAgentByName(agentName);
    if (!agent) return false;

    return await this.db.withTransaction(async () => {
      // Delete agent
      await this.db.collections.agents.deleteOne(
        { agent_name: agentName }
      );

      // Delete associated wallet
      await this.db.collections.wallets.deleteOne(
        { walletId: agent.walletId }
      );

      return true;
    });
  }

  /**
   * Get network statistics for agents
   */
  async getAgentStats(): Promise<{
    totalAgents: number;
    activeAgents: number; // Agents with recent activity
    averageServiceCharge: number;
    topAgentsByServiceCharge: Array<{
      agent_name: string;
      serviceCharge: number;
    }>;
  }> {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalAgents: { $sum: 1 },
          averageServiceCharge: { $avg: '$serviceCharge' },
        },
      },
    ];

    const [stats, topAgents] = await Promise.all([
      this.db.collections.agents.aggregate(pipeline).toArray(),
      this.db.collections.agents
        .find({})
        .sort({ serviceCharge: -1 })
        .limit(5)
        .project({ agent_name: 1, serviceCharge: 1 })
        .toArray(),
    ]);

    const result = stats[0];

    return {
      totalAgents: result?.totalAgents || 0,
      activeAgents: result?.totalAgents || 0, // TODO: Implement activity tracking
      averageServiceCharge: Math.round(result?.averageServiceCharge || 0),
      topAgentsByServiceCharge: topAgents.map(agent => ({
        agent_name: agent.agent_name,
        serviceCharge: agent.serviceCharge,
      })),
    };
  }

  /**
   * Seed initial agents (for development/testing)
   */
  async seedAgents(agents: CreateAgentInput[]): Promise<Agent[]> {
    const createdAgents: Agent[] = [];

    for (const agentInput of agents) {
      try {
        // Check if agent already exists
        const exists = await this.agentExists(agentInput.agent_name);
        if (!exists) {
          const agent = await this.createAgent(agentInput);
          createdAgents.push(agent);
          console.log(`✅ Created agent: ${agent.agent_name}`);
        } else {
          console.log(`⚠️  Agent already exists: ${agentInput.agent_name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create agent ${agentInput.agent_name}:`, error);
      }
    }

    return createdAgents;
  }
}