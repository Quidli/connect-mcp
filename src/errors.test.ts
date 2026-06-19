import { describe, expect, it } from 'vitest';
import { mapHttpError, parseNestErrorMessage } from './errors.js';

describe('parseNestErrorMessage', () => {
  it('joins array messages', () => {
    expect(parseNestErrorMessage({ message: ['a', 'b'] })).toBe('a b');
  });

  it('returns string message', () => {
    expect(parseNestErrorMessage({ message: 'bad payload' })).toBe('bad payload');
  });

  it('falls back when message missing', () => {
    expect(parseNestErrorMessage({})).toBe('Request failed');
    expect(parseNestErrorMessage(null)).toBe('Request failed');
  });
});

describe('mapHttpError', () => {
  it('maps 400 to detail', () => {
    expect(mapHttpError(400, { message: 'Invalid' })).toBe('Invalid');
  });

  it('maps 401 with dashboard hint', () => {
    const msg = mapHttpError(401, { message: 'Invalid API key' });
    expect(msg).toContain('connect.quid.li');
    expect(msg).not.toContain('secret-key');
  });

  it('maps 402 to api-key guidance', () => {
    expect(mapHttpError(402, { message: 'Payment Required' }, 'api-key')).toContain(
      'CONNECT_API_KEY',
    );
  });

  it('maps 402 to x402 wallet guidance', () => {
    expect(mapHttpError(402, { message: 'Payment Required' }, 'x402')).toContain('USDC');
  });

  it('maps 404 to detail', () => {
    expect(mapHttpError(404, { message: 'Not found' })).toBe('Not found');
  });

  it('maps 504 with default when body empty', () => {
    expect(mapHttpError(504, {})).toContain('60 seconds');
  });

  it('maps 503 to Connect API error prefix', () => {
    expect(mapHttpError(503, { message: 'unavailable' })).toContain('Connect API error (503)');
  });

  it('never embeds api-key in error text', () => {
    const msg = mapHttpError(401, { message: 'secret-key leaked in api' });
    expect(msg).not.toMatch(/\bx-api-key\b/i);
  });
});
