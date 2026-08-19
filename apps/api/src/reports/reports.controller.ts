import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Ops-only reporting endpoints (Phase 9C–9F).
 * Global SessionGuard applies — no @Public().
 */
@ApiTags('reports')
@Controller('reports')
export class ReportsController {}
