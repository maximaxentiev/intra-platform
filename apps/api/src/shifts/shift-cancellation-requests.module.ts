import { Module } from '@nestjs/common';
import { StaffPortalAuditService } from '../staff-portal/staff-portal-audit.service';
import { ShiftCancellationRequestsService } from './shift-cancellation-requests.service';

@Module({
  providers: [ShiftCancellationRequestsService, StaffPortalAuditService],
  exports: [ShiftCancellationRequestsService],
})
export class ShiftCancellationRequestsModule {}
