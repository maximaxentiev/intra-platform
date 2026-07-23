import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShiftsService } from './shifts.service';

/**
 * Replaces the legacy pg_cron job: every minute, complete filled shifts whose
 * end datetime has passed.
 */
@Injectable()
export class ShiftsCron {
  private readonly logger = new Logger('ShiftsCron');

  constructor(private readonly shifts: ShiftsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async autoComplete() {
    try {
      const n = await this.shifts.autoCompletePastShifts();
      if (n > 0) this.logger.log(`Auto-completed ${n} shift(s).`);
    } catch (err) {
      this.logger.error(`Auto-complete failed: ${(err as Error).message}`);
    }
  }
}
