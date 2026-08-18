import { Injectable } from '@nestjs/common';
import type { CommunicationProcessor } from './communication-processor.registry';
import type { CommunicationProcessorOutcome } from './automated-communications.types';
import type { Database } from '../db/drizzle.module';
import type { CommunicationProcessorContext } from './communication-processor.registry';

/** Test-only processor for infrastructure verification (7C). */
export class TestPingCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType = 'test_ping' as const;

  constructor(private readonly recipientEmail: string | null = 'test-recipient@example.test') {}

  async evaluate(
    _db: Database,
    _context: CommunicationProcessorContext,
  ): Promise<CommunicationProcessorOutcome> {
    if (!this.recipientEmail) {
      return {
        kind: 'skipped',
        code: 'no_recipient',
        reason: 'Test recipient not configured.',
      };
    }
    return {
      kind: 'valid',
      recipientEmail: this.recipientEmail,
      subject: 'Intra test communication',
      html: '<p>Test ping.</p>',
      text: 'Test ping.',
    };
  }
}

@Injectable()
export class TestPingProcessorProvider {
  create(recipientEmail?: string | null): TestPingCommunicationProcessor {
    return new TestPingCommunicationProcessor(recipientEmail);
  }
}
