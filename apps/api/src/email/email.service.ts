import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailDeliveryError,
  EmailTransport,
  NoopEmailTransport,
  ResendEmailTransport,
  type EmailMessage,
} from './email.transport';
import { appendIntraEmailSignOffText } from './platform-email-branding.util';

export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');

@Injectable()
export class EmailService {
  private readonly transport: EmailTransport;
  private readonly fromAddress: string;

  constructor(config: ConfigService) {
    this.fromAddress = config.get<string>('EMAIL_FROM') ?? 'Intra Platform <noreply@intra.ca>';
    const apiKey = config.get<string>('RESEND_API_KEY')?.trim();
    this.transport = apiKey
      ? new ResendEmailTransport(apiKey, this.fromAddress)
      : new NoopEmailTransport();
  }

  /** Test hook — replace transport (RecordingEmailTransport in specs). */
  useTransport(transport: EmailTransport) {
    (this as unknown as { transport: EmailTransport }).transport = transport;
  }

  async send(message: EmailMessage) {
    const text = message.text ? appendIntraEmailSignOffText(message.text) : message.text;
    return this.transport.send({ ...message, text });
  }

  isConfigured(): boolean {
    return !(this.transport instanceof NoopEmailTransport);
  }
}

export { EmailDeliveryError, type EmailMessage };
export { RecordingEmailTransport } from './email.transport';
