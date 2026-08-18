import { Global, Module } from '@nestjs/common';
import { AutomatedCommunicationsService } from './automated-communications.service';
import { ScheduledCommunicationsService } from './scheduled-communications.service';
import { CommunicationsQueueService } from './communications-queue.service';
import { CommunicationProcessorRegistry } from './communication-processor.registry';
import { TestPingCommunicationProcessor, TestPingProcessorProvider } from './test-ping.processor';

export const COMMUNICATION_PROCESSOR_REGISTRY = Symbol('COMMUNICATION_PROCESSOR_REGISTRY');

/** Shared schedule/queue services — safe to import from API and worker. */
@Global()
@Module({
  providers: [
    ScheduledCommunicationsService,
    CommunicationsQueueService,
    AutomatedCommunicationsService,
    TestPingProcessorProvider,
    {
      provide: COMMUNICATION_PROCESSOR_REGISTRY,
      useFactory: () => new CommunicationProcessorRegistry(),
    },
    {
      provide: CommunicationProcessorRegistry,
      inject: [COMMUNICATION_PROCESSOR_REGISTRY],
      useFactory: (registry: CommunicationProcessorRegistry) => registry,
    },
  ],
  exports: [
    AutomatedCommunicationsService,
    ScheduledCommunicationsService,
    CommunicationsQueueService,
    CommunicationProcessorRegistry,
    TestPingProcessorProvider,
  ],
})
export class AutomatedCommunicationsModule {}

/** Register test_ping processor when running worker/tests. */
export function registerTestPingProcessor(
  registry: CommunicationProcessorRegistry,
  recipientEmail?: string | null,
): void {
  registry.register(new TestPingCommunicationProcessor(recipientEmail));
}
