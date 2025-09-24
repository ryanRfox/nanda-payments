import { z } from 'zod';

/**
 * Agent Model
 *
 * Represents an AI agent in the NANDA ecosystem with metadata,
 * capabilities, and wallet association.
 */

export const AgentSchema = z.object({
  id: z.string().uuid(),
  agent_name: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  description: z.string().max(500),
  version: z.string().default('1.0.0'),
  documentationUrl: z.string().url().optional(),
  jurisdiction: z.string().default('USA'),

  provider: z.object({
    name: z.string(),
    url: z.string().url(),
    did: z.string().optional(),
  }),

  endpoints: z.object({
    static: z.array(z.string()),
    adaptive_resolver: z.object({
      url: z.string().url().optional(),
      policies: z.array(z.string()).default([]),
    }),
  }),

  capabilities: z.object({
    modalities: z.array(z.string()).default(['text']),
    streaming: z.boolean().default(false),
    batch: z.boolean().default(false),
    authentication: z.object({
      methods: z.array(z.string()).default([]),
      requiredScopes: z.array(z.string()).default([]),
    }),
  }),

  skills: z.array(z.object({
    id: z.string(),
    description: z.string(),
    inputModes: z.array(z.string()),
    outputModes: z.array(z.string()),
    supportedLanguages: z.array(z.string()).default(['en']),
  })).default([]),

  evaluations: z.object({
    performanceScore: z.number().min(0).max(100).default(0),
    availability90d: z.string().optional(),
    lastAudited: z.string().optional(),
    auditTrail: z.string().optional(),
    auditorID: z.string().optional(),
  }),

  telemetry: z.object({
    enabled: z.boolean().default(false),
    retention: z.string().default('7d'),
    sampling: z.number().min(0).max(1).default(0.1),
    metrics: z.object({
      latency_p95_ms: z.number().default(0),
      throughput_rps: z.number().default(0),
      error_rate: z.number().min(0).max(1).default(0),
      availability: z.string().optional(),
    }),
  }),

  certification: z.object({
    level: z.enum(['unverified', 'verified', 'premium']).default('verified'),
    issuer: z.string(),
    issuanceDate: z.string(),
    expirationDate: z.string(),
  }),

  // NANDA-specific fields
  walletId: z.string().uuid(),
  serviceCharge: z.number().min(0), // Service charge in NP (major units)
  username: z.string(),
  email: z.string().email(),

  // Timestamps
  created_at: z.string(),
  updated_at: z.string(),
});

export type Agent = z.infer<typeof AgentSchema>;

/**
 * Agent creation input (omits generated fields)
 */
export const CreateAgentSchema = AgentSchema.omit({
  id: true,
  walletId: true,
  created_at: true,
  updated_at: true,
});

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

/**
 * Agent update input (all fields optional except agent_name)
 */
export const UpdateAgentSchema = AgentSchema.partial().extend({
  agent_name: z.string().min(1).max(100), // Required for identification
});

export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;