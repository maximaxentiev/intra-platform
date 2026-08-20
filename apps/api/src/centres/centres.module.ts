import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { CentresController } from './centres.controller';
import { CentresService } from './centres.service';

@Module({
  imports: [PlatformAuditModule],
  controllers: [CentresController],
  providers: [CentresService],
  exports: [CentresService],
})
export class CentresModule {}
