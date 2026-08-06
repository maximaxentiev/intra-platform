import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CarerPortalEnabledGuard } from './carer-portal-enabled.guard';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffSessionGuard } from './staff-session.guard';
import { StaffSessionService } from './staff-session.service';

@Module({
  imports: [AuthModule],
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffSessionService, StaffSessionGuard, CarerPortalEnabledGuard],
  exports: [StaffAuthService, StaffSessionService, StaffSessionGuard],
})
export class StaffPortalModule {}
