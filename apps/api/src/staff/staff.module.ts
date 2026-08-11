import { Module } from '@nestjs/common';
import { StaffDocumentsModule } from '../staff-documents/staff-documents.module';
import { StaffPortalModule } from '../staff-portal/staff-portal.module';
import { StaffController } from './staff.controller';
import { StaffCsvImportService } from './staff-csv-import.service';
import { StaffService } from './staff.service';

@Module({
  imports: [StaffPortalModule, StaffDocumentsModule],
  controllers: [StaffController],
  providers: [StaffService, StaffCsvImportService],
  exports: [StaffService],
})
export class StaffModule {}
