import { Module } from '@nestjs/common';
import { AutomatedCommunicationsModule } from './automated-communications.module';
import { AutomatedCommunicationsProcessor } from './automated-communications.processor';
import { AutomatedCommunicationsReconcilerService } from './automated-communications-reconciler.service';
import { ShiftCommunicationsModule } from '../shifts/shift-communications.module';
import { DocumentCommunicationsModule } from '../staff-documents/document-communications.module';

/** Worker-only providers (processor + reconciler). Not imported by HTTP API. */
@Module({
  imports: [AutomatedCommunicationsModule, ShiftCommunicationsModule, DocumentCommunicationsModule],
  providers: [AutomatedCommunicationsProcessor, AutomatedCommunicationsReconcilerService],
  exports: [AutomatedCommunicationsProcessor, AutomatedCommunicationsReconcilerService],
})
export class AutomatedCommunicationsWorkerModule {}
