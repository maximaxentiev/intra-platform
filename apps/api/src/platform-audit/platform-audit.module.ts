import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { PlatformAuditService } from './platform-audit.service';

@Module({
  imports: [DrizzleModule],
  providers: [PlatformAuditService],
  exports: [PlatformAuditService],
})
export class PlatformAuditModule {}
