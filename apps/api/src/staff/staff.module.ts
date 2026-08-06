import { Module } from '@nestjs/common';
import { StaffPortalModule } from '../staff-portal/staff-portal.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [StaffPortalModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
