import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { StaffPortalModule } from '../staff-portal/staff-portal.module';
import { StorageModule } from '../storage/storage.module';
import { StaffDocumentShareLifecycleService } from './staff-document-share-lifecycle.service';
import { StaffDocumentSharePublicAuthService } from './staff-document-share-public-auth.service';
import { StaffDocumentSharePublicController } from './staff-document-share-public.controller';
import { StaffDocumentSharePublicService } from './staff-document-share-public.service';
import { StaffDocumentShareRateLimitService } from './staff-document-share-rate-limit.service';
import { StaffDocumentShareService } from './staff-document-share.service';
import { StaffDocumentsOpsController } from './staff-documents-ops.controller';
import { StaffDocumentsService } from './staff-documents.service';
import { StaffPortalDocumentsController } from './staff-portal-documents.controller';

@Module({
  imports: [DrizzleModule, StorageModule, StaffPortalModule],
  controllers: [
    StaffPortalDocumentsController,
    StaffDocumentsOpsController,
    StaffDocumentSharePublicController,
  ],
  providers: [
    StaffDocumentsService,
    StaffDocumentShareService,
    StaffDocumentShareLifecycleService,
    StaffDocumentSharePublicAuthService,
    StaffDocumentSharePublicService,
    StaffDocumentShareRateLimitService,
  ],
  exports: [
    StaffDocumentsService,
    StaffDocumentShareService,
    StaffDocumentShareLifecycleService,
    StaffDocumentSharePublicService,
  ],
})
export class StaffDocumentsModule {}
