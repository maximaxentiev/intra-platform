import { describe, expect, it, vi } from 'vitest';
import { EmailDeliveryError, RecordingEmailTransport, ResendEmailTransport } from './email.transport';

describe('ResendEmailTransport idempotency', () => {
  it('includes Idempotency-Key header when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = new ResendEmailTransport('re_test_key', 'Test <test@example.com>');
    await transport.send({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      idempotencyKey: 'intra-comm-abc',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('intra-comm-abc');

    vi.unstubAllGlobals();
  });

  it('omits Idempotency-Key when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-2' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = new ResendEmailTransport('re_test_key', 'Test <test@example.com>');
    await transport.send({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBeUndefined();

    vi.unstubAllGlobals();
  });
});

describe('RecordingEmailTransport', () => {
  it('accepts optional idempotency key without error', async () => {
    const transport = new RecordingEmailTransport();
    await transport.send({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      idempotencyKey: 'intra-comm-abc',
    });
    expect(transport.sent).toHaveLength(1);
  });
});

describe('EmailDeliveryError', () => {
  it('preserves status in message for classifier', () => {
    const err = new EmailDeliveryError('Email delivery failed (503): upstream');
    expect(err.message).toContain('503');
  });
});
