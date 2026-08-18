import type {
  CommunicationProcessorOutcome,
  CommunicationType,
} from './automated-communications.types';
import type { Database } from '../db/drizzle.module';

export type CommunicationProcessorContext = {
  scheduledCommunicationId: string;
  communicationType: CommunicationType;
  entityType: string;
  entityId: string;
  recipientType: string;
  recipientEntityId: string | null;
};

export interface CommunicationProcessor {
  communicationType: CommunicationType;
  evaluate(
    db: Database,
    context: CommunicationProcessorContext,
  ): Promise<CommunicationProcessorOutcome>;
}

export class CommunicationProcessorRegistry {
  private readonly processors = new Map<CommunicationType, CommunicationProcessor>();

  register(processor: CommunicationProcessor): void {
    this.processors.set(processor.communicationType, processor);
  }

  get(type: CommunicationType): CommunicationProcessor | undefined {
    return this.processors.get(type);
  }
}
