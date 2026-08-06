export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
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
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
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
