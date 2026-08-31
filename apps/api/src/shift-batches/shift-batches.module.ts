import { Module } from '@nestjs/common';
import { ShiftsModule } from '../shifts/shifts.module';
import { ShiftBatchesController } from './shift-batches.controller';
import { ShiftBatchesService } from './shift-batches.service';

@Module({
  imports: [ShiftsModule],
  controllers: [ShiftBatchesController],
  providers: [ShiftBatchesService],
  exports: [ShiftBatchesService],
})
export class ShiftBatchesModule {}
