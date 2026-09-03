import { Module, type INestApplicationContext } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from '../config/env.validation';
import { findRepoRootEnvFile } from '../config/root-env';
import { DrizzleModule } from '../db/drizzle.module';
import { EmailModule } from '../email/email.module';
import { AutomatedCommunicationsModule, registerTestPingProcessor } from '../automated-communications/automated-communications.module';
import { AutomatedCommunicationsWorkerModule } from '../automated-communications/automated-communications-worker.module';
import { CommunicationProcessorRegistry } from '../automated-communications/communication-processor.registry';
import { AutomatedCommunicationsProcessor } from '../automated-communications/automated-communications.processor';
import { AutomatedCommunicationsReconcilerService } from '../automated-communications/automated-communications-reconciler.service';
import { ShiftCommunicationsModule } from '../shifts/shift-communications.module';
import { DocumentCommunicationsModule } from '../staff-documents/document-communications.module';
import { OnboardingCommunicationsModule } from '../staff-portal/onboarding-communications.module';
import { ReportsModule } from '../reports/reports.module';
import { registerShiftReminderProcessors } from '../shifts/shift-reminder.processor';
import { registerShiftCancellationProcessors } from '../shifts/shift-cancellation.processor';
import { registerDocumentExpiryProcessors } from '../staff-documents/document-expiry-reminder.processor';
import { registerOnboardingReminderProcessors } from '../staff-portal/onboarding-reminder.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: findRepoRootEnvFile() }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    EmailModule,
    AutomatedCommunicationsModule,
    AutomatedCommunicationsWorkerModule,
    ShiftCommunicationsModule,
    DocumentCommunicationsModule,
    OnboardingCommunicationsModule,
    ReportsModule,
  ],
})
export class WorkerModule {}

export async function bootstrapWorker(): Promise<{
  processor: AutomatedCommunicationsProcessor;
  reconciler: AutomatedCommunicationsReconcilerService;
  registry: CommunicationProcessorRegistry;
  app: INestApplicationContext;
}> {
  const { NestFactory } = await import('@nestjs/core');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });

  const registry = app.get(CommunicationProcessorRegistry);
  const config = app.get(ConfigService);
  registerShiftReminderProcessors(registry, config);
  registerShiftCancellationProcessors(registry, config);
  registerDocumentExpiryProcessors(registry, config);
  registerOnboardingReminderProcessors(registry, config);
  const { registerBatchProgress70Processor } = await import(
    '../shift-batches/shift-batch-progress.processor'
  );
  registerBatchProgress70Processor(registry, config);
  const { registerBatchConfirmationFinalProcessor } = await import(
    '../shift-batches/shift-batch-confirmation-final.processor'
  );
  registerBatchConfirmationFinalProcessor(registry, config);
  const { registerBatchConfirmationUpdateProcessor } = await import(
    '../shift-batches/shift-batch-confirmation-update.processor'
  );
  registerBatchConfirmationUpdateProcessor(registry, config);
  const { registerBatchCancellationProcessors } = await import(
    '../shift-batches/shift-batch-cancellation.processor'
  );
  registerBatchCancellationProcessors(registry, config);
  const { registerCentreShiftHistoryProcessor } = await import(
    '../centres/centre-shift-history.processor'
  );
  const { ReportsExportService } = await import('../reports/reports-export.service');
  registerCentreShiftHistoryProcessor(registry, config, app.get(ReportsExportService));

  if (process.env.NODE_ENV === 'test' || process.env.WORKER_REGISTER_TEST_PROCESSOR === 'true') {
    registerTestPingProcessor(
      registry,
      process.env.WORKER_TEST_RECIPIENT_EMAIL ?? 'test-recipient@example.test',
    );
  }

  const processor = app.get(AutomatedCommunicationsProcessor);
  processor.startWorker();

  const reconciler = app.get(AutomatedCommunicationsReconcilerService);

  return { processor, reconciler, registry, app };
}
