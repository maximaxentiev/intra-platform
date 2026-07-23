import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsCron } from './shifts.cron';
import { ShiftsService } from './shifts.service';

@Module({
  controllers: [ShiftsController],
  providers: [ShiftsService, ShiftsCron],
  exports: [ShiftsService],
})
export class ShiftsModule {}
