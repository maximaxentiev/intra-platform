import { describe, expect, it, vi } from 'vitest';
import { fetchHistoricalDocument } from './nanny-applicants-csv.document-fetch';

describe('fetchHistoricalDocument', () => {
  it('returns http_error on 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }));
    const result = await fetchHistoricalDocument('https://example.test/missing.pdf', 'resume', fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(404);
    expect(result.errorCode).toBe('http_error');
  });

  it('returns http_error on 403', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 403 }));
    const result = await fetchHistoricalDocument('https://example.test/x.pdf', 'resume', fetchImpl);
    expect(result.errorCode).toBe('http_error');
    expect(result.httpStatus).toBe(403);
  });

  it('accepts PDF with wrong content-type when signature matches', async () => {
    const body = Buffer.from('%PDF-1.4\n');
    const fetchImpl = vi.fn(
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        }),
    );
    const result = await fetchHistoricalDocument('https://example.test/r.pdf', 'resume', fetchImpl);
    expect(result.ok).toBe(true);
    expect(result.detectedFormat).toBe('pdf');
  });

  it('rejects HTML body', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('<!DOCTYPE html><html></html>', {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
    );
    const result = await fetchHistoricalDocument('https://example.test/x.pdf', 'resume', fetchImpl);
    expect(result.errorCode).toBe('html_error');
  });

  it('handles network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const result = await fetchHistoricalDocument('https://example.test/r.pdf', 'resume', fetchImpl);
    expect(result.errorCode).toBe('network_error');
  });
});
