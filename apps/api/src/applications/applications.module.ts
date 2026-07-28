import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { NetworkApplicationApiKeyGuard } from './network-application-api-key.guard';
import { NetworkApplicationsSubmitService } from './network-applications-submit.service';
import { NetworkSubmitRateLimitService } from './network-submit-rate-limit.service';
import { PublicApplicationsController } from './public-applications.controller';

@Module({
  controllers: [ApplicationsController, PublicApplicationsController],
  providers: [
    ApplicationsService,
    NetworkApplicationsSubmitService,
    NetworkSubmitRateLimitService,
    NetworkApplicationApiKeyGuard,
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
