import { describe, it, expect } from 'vitest';
import { NandaPoints } from '../../src/models/wallet.js';

describe('NandaPoints', () => {
  describe('conversion functions', () => {
    it('should convert NP to minor units correctly', () => {
      expect(NandaPoints.toMinor(1)).toBe(100);
      expect(NandaPoints.toMinor(10.50)).toBe(1050);
      expect(NandaPoints.toMinor(0.01)).toBe(1);
      expect(NandaPoints.toMinor(0)).toBe(0);
    });

    it('should convert minor units to NP correctly', () => {
      expect(NandaPoints.fromMinor(100)).toBe(1);
      expect(NandaPoints.fromMinor(1050)).toBe(10.50);
      expect(NandaPoints.fromMinor(1)).toBe(0.01);
      expect(NandaPoints.fromMinor(0)).toBe(0);
    });

    it('should handle rounding correctly', () => {
      expect(NandaPoints.toMinor(10.123)).toBe(1012); // Rounds to nearest cent
      expect(NandaPoints.toMinor(10.126)).toBe(1013); // Rounds up
    });
  });

  describe('formatting', () => {
    it('should format amounts correctly', () => {
      expect(NandaPoints.format(100)).toBe('1.00 NP');
      expect(NandaPoints.format(1050)).toBe('10.50 NP');
      expect(NandaPoints.format(1)).toBe('0.01 NP');
      expect(NandaPoints.format(0)).toBe('0.00 NP');
    });
  });

  describe('parsing', () => {
    it('should parse NP amounts correctly', () => {
      expect(NandaPoints.parse('1.00 NP')).toBe(100);
      expect(NandaPoints.parse('10.50 NP')).toBe(1050);
      expect(NandaPoints.parse('0.01')).toBe(1);
      expect(NandaPoints.parse('10')).toBe(1000);
    });

    it('should handle whitespace and case variations', () => {
      expect(NandaPoints.parse(' 1.50 NP ')).toBe(150);
      expect(NandaPoints.parse('1.50 np')).toBe(150);
      expect(NandaPoints.parse('1.50np')).toBe(150);
    });

    it('should throw on invalid amounts', () => {
      expect(() => NandaPoints.parse('invalid')).toThrow('Invalid NP amount');
      expect(() => NandaPoints.parse('-1.00')).toThrow('Invalid NP amount');
      expect(() => NandaPoints.parse('')).toThrow('Invalid NP amount');
    });
  });

  describe('validation', () => {
    it('should validate amounts correctly', () => {
      expect(NandaPoints.isValidAmount(100)).toBe(true);
      expect(NandaPoints.isValidAmount(0)).toBe(true);
      expect(NandaPoints.isValidAmount(1.5)).toBe(false); // Not an integer
      expect(NandaPoints.isValidAmount(-1)).toBe(false); // Negative
    });
  });
});