import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PlatformAuditModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
