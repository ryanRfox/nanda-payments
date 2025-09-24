import { z } from 'zod';

/**
 * Configuration Schema and Types
 */

export const ConfigSchema = z.object({
  // MongoDB Configuration
  mongodb: z.object({
    uri: z.string().default('mongodb://localhost:27017'),
    dbName: z.string().default('nanda_points'),
    maxConnections: z.number().default(10),
  }),

  // Server Configuration
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost'),
    cors: z.object({
      origins: z.array(z.string()).default(['*']),
    }),
  }),

  // NANDA Points Configuration
  nandaPoints: z.object({
    currency: z.literal('NP').default('NP'),
    scale: z.literal(2).default(2),
    defaultBalanceMinor: z.number().default(100000), // 1000 NP in minor units
  }),

  // Security Configuration
  security: z.object({
    sessionExpirationMinutes: z.number().default(30),
    rateLimitWindow: z.number().default(60000), // 1 minute
    rateLimitMax: z.number().default(100),
  }),

  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const rawConfig = {
    mongodb: {
      uri: process.env.MONGODB_URI,
      dbName: process.env.NP_DB_NAME,
      maxConnections: process.env.MONGODB_MAX_CONNECTIONS ? parseInt(process.env.MONGODB_MAX_CONNECTIONS) : undefined,
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
      host: process.env.HOST,
      cors: {
        origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : undefined,
      },
    },
    nandaPoints: {
      currency: process.env.NP_CURRENCY as 'NP',
      scale: process.env.NP_SCALE ? parseInt(process.env.NP_SCALE) as 2 : undefined,
      defaultBalanceMinor: process.env.DEFAULT_BALANCE_MINOR ? parseInt(process.env.DEFAULT_BALANCE_MINOR) : undefined,
    },
    security: {
      sessionExpirationMinutes: process.env.SESSION_EXPIRATION_MINUTES ? parseInt(process.env.SESSION_EXPIRATION_MINUTES) : undefined,
      rateLimitWindow: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW) : undefined,
      rateLimitMax: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : undefined,
    },
    nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
  };

  // Remove undefined values to let defaults apply
  const cleanConfig = JSON.parse(JSON.stringify(rawConfig, (_, value) => value === undefined ? undefined : value));

  return ConfigSchema.parse(cleanConfig);
}