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
import { ShiftsModule } from '../shifts/shifts.module';
import { registerShiftReminderProcessors } from '../shifts/shift-reminder.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: findRepoRootEnvFile() }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    EmailModule,
    AutomatedCommunicationsModule,
    AutomatedCommunicationsWorkerModule,
    ShiftsModule,
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
