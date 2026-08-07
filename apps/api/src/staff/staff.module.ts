import { Module } from '@nestjs/common';
import { StaffPortalModule } from '../staff-portal/staff-portal.module';
import { StaffController } from './staff.controller';
import { StaffCsvImportService } from './staff-csv-import.service';
import { StaffService } from './staff.service';

@Module({
  imports: [StaffPortalModule],
  controllers: [StaffController],
  providers: [StaffService, StaffCsvImportService],
  exports: [StaffService],
})
export class StaffModule {}
