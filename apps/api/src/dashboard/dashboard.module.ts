import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { DashboardController } from './dashboard.controller';
import { DashboardOverviewService } from './dashboard-overview.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ReportsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardOverviewService],
})
export class DashboardModule {}
