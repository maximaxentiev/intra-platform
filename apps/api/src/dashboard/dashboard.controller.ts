import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DashboardService } from './dashboard.service';

class SummaryQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekEnd!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;
}

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@Query() q: SummaryQuery) {
    return this.dashboard.summary(q.weekStart, q.weekEnd, q.dayOfWeek);
  }
}
