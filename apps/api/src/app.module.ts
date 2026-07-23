import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.validation';
import { DrizzleModule } from './db/drizzle.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/session.guard';
import { RolesGuard } from './auth/roles.guard';
import { UsersModule } from './users/users.module';
import { StaffModule } from './staff/staff.module';
import { CentresModule } from './centres/centres.module';
import { AvailabilityModule } from './availability/availability.module';
import { ShiftsModule } from './shifts/shifts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    RedisModule,
    AuthModule,
    UsersModule,
    StaffModule,
    CentresModule,
    AvailabilityModule,
    ShiftsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global auth: every route requires a valid session unless @Public().
    { provide: APP_GUARD, useClass: SessionGuard },
    // Role checks run after authentication for @Roles()-annotated routes.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
