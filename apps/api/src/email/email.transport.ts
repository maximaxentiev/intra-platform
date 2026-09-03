export type EmailAttachment = {
  filename: string;
  /** UTF-8 content encoded as base64 for Resend. */
  content: string;
  contentType?: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional Resend Idempotency-Key header for automated communications retries. */
  idempotencyKey?: string;
  attachments?: EmailAttachment[];
};

export type EmailSendResult = { providerId?: string };

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

/** Records messages in memory — for unit tests only. */
export class RecordingEmailTransport implements EmailTransport {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message);
    return { providerId: 'test-message-id' };
  }
}

/** Resend HTTP API (no token logging). */
export class ResendEmailTransport implements EmailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (message.idempotencyKey) {
      headers['Idempotency-Key'] = message.idempotencyKey;
    }

    const body: Record<string, unknown> = {
        from: this.fromAddress,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      };
    if (message.attachments?.length) {
      body.attachments = message.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
      }));
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new EmailDeliveryError(
        `Email delivery failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
      );
    }
    const json = (await res.json()) as { id?: string };
    return { providerId: json.id };
  }
}

/** Discards messages when email is not configured (local dev without Resend). */
export class NoopEmailTransport implements EmailTransport {
  async send(_message: EmailMessage): Promise<EmailSendResult> {
    throw new EmailDeliveryError('Email is not configured on this server.');
  }
}
