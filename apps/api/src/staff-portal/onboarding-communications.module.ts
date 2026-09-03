import { Module } from '@nestjs/common';
import { AutomatedCommunicationsModule } from '../automated-communications/automated-communications.module';
import { OnboardingReminderService } from './onboarding-reminder.service';

/**
 * Onboarding reminder scheduling — no circular StaffPortal deps.
 * Imported by StaffPortalModule and the worker.
 */
@Module({
  imports: [AutomatedCommunicationsModule],
  providers: [OnboardingReminderService],
  exports: [OnboardingReminderService],
})
export class OnboardingCommunicationsModule {}
