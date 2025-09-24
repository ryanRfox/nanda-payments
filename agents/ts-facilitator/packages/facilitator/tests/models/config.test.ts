import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, ConfigSchema } from '../../src/models/config.js';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default configuration', () => {
      const config = loadConfig();

      expect(config.mongodb.uri).toBe('mongodb://localhost:27017');
      expect(config.mongodb.dbName).toBe('nanda_points');
      expect(config.server.port).toBe(3000);
      expect(config.nandaPoints.currency).toBe('NP');
      expect(config.nandaPoints.scale).toBe(2);
    });

    it('should override with environment variables', () => {
      process.env.MONGODB_URI = 'mongodb://test:27017';
      process.env.NP_DB_NAME = 'test_db';
      process.env.PORT = '8080';

      const config = loadConfig();

      expect(config.mongodb.uri).toBe('mongodb://test:27017');
      expect(config.mongodb.dbName).toBe('test_db');
      expect(config.server.port).toBe(8080);
    });

    it('should handle numeric environment variables', () => {
      process.env.PORT = '3001';
      process.env.NP_SCALE = '2';
      process.env.DEFAULT_BALANCE_MINOR = '50000';

      const config = loadConfig();

      expect(config.server.port).toBe(3001);
      expect(config.nandaPoints.scale).toBe(2);
      expect(config.nandaPoints.defaultBalanceMinor).toBe(50000);
    });
  });

  describe('ConfigSchema validation', () => {
    it('should validate correct configuration', () => {
      const validConfig = {
        mongodb: {
          uri: 'mongodb://localhost:27017',
          dbName: 'test',
          maxConnections: 10,
        },
        server: {
          port: 3000,
          host: 'localhost',
          cors: { origins: ['*'] },
        },
        nandaPoints: {
          currency: 'NP' as const,
          scale: 2 as const,
          defaultBalanceMinor: 100000,
        },
        security: {
          sessionExpirationMinutes: 30,
          rateLimitWindow: 60000,
          rateLimitMax: 100,
        },
        nodeEnv: 'development' as const,
      };

      expect(() => ConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        mongodb: {
          uri: 'not-a-valid-uri',
          dbName: '',
        },
        server: {
          port: -1, // Invalid port
        },
        nandaPoints: {
          currency: 'INVALID', // Not 'NP'
          scale: 3, // Not 2
        },
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });
  });
});