import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { StaffPortalModule } from '../staff-portal/staff-portal.module';
import { StorageModule } from '../storage/storage.module';
import { StaffDocumentShareLifecycleService } from './staff-document-share-lifecycle.service';
import { StaffDocumentShareService } from './staff-document-share.service';
import { StaffDocumentsOpsController } from './staff-documents-ops.controller';
import { StaffDocumentsService } from './staff-documents.service';
import { StaffPortalDocumentsController } from './staff-portal-documents.controller';

@Module({
  imports: [DrizzleModule, StorageModule, StaffPortalModule],
  controllers: [StaffPortalDocumentsController, StaffDocumentsOpsController],
  providers: [StaffDocumentsService, StaffDocumentShareService, StaffDocumentShareLifecycleService],
  exports: [StaffDocumentsService, StaffDocumentShareService, StaffDocumentShareLifecycleService],
})
export class StaffDocumentsModule {}
