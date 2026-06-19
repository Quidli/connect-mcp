import { describe, expect, it } from 'vitest';
import { normalizeEvmPrivateKey } from './x402-fetch.js';

describe('normalizeEvmPrivateKey', () => {
  it('returns undefined for empty values', () => {
    expect(normalizeEvmPrivateKey(undefined)).toBeUndefined();
    expect(normalizeEvmPrivateKey('')).toBeUndefined();
    expect(normalizeEvmPrivateKey('   ')).toBeUndefined();
  });

  it('adds 0x prefix when missing', () => {
    expect(normalizeEvmPrivateKey('abc')).toBe('0xabc');
  });

  it('preserves 0x prefix', () => {
    expect(normalizeEvmPrivateKey('0xabc')).toBe('0xabc');
  });
});
