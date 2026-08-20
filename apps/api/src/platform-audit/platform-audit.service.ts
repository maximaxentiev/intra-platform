import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { platformAuditEvents } from '../db/schema';
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_ACTOR_TYPES,
  PLATFORM_AUDIT_ENTITY_TYPES,
  PLATFORM_AUDIT_METADATA_ALLOWLIST,
  defaultEntityTypeForAction,
  type PlatformAuditAction,
  type PlatformAuditActorType,
  type PlatformAuditEntityType,
} from './platform-audit.constants';

export type PlatformAuditDbExecutor = Pick<DbExecutor, 'insert'>;

export type PlatformAuditRecordParams = {
  action: PlatformAuditAction;
  actorType: PlatformAuditActorType;
  actorUserId?: string | null;
  entityType?: PlatformAuditEntityType;
  entityId?: string | null;
  staffId?: string | null;
  shiftId?: string | null;
  centreId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

const FORBIDDEN_METADATA_KEYS = /token|password|secret|hash|cookie|storage|provider|signing|url/i;

@Injectable()
export class PlatformAuditService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(params: PlatformAuditRecordParams, executor?: PlatformAuditDbExecutor): Promise<void> {
    assertSupportedAction(params.action);
    assertSupportedActorType(params.actorType);
    if (params.entityType) {
      assertSupportedEntityType(params.entityType);
    }

    const metadata = sanitizePlatformAuditMetadata(params.metadata ?? {});
    const db = executor ?? this.db;

    await db.insert(platformAuditEvents).values({
      occurredAt: params.occurredAt ?? new Date(),
      actorType: params.actorType,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType ?? defaultEntityTypeForAction(params.action),
      entityId: params.entityId ?? params.shiftId ?? params.centreId ?? params.targetUserId ?? params.staffId ?? null,
      staffId: params.staffId ?? null,
      shiftId: params.shiftId ?? null,
      centreId: params.centreId ?? null,
      targetUserId: params.targetUserId ?? null,
      metadata,
    });
  }
}

export function sanitizePlatformAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeMetadataValue(metadata, PLATFORM_AUDIT_METADATA_ALLOWLIST) as Record<
    string,
    unknown
  >;
}

function sanitizeMetadataValue(
  value: unknown,
  allowlist: Set<string>,
  key?: string,
  inChanges = false,
): unknown {
  if (key && FORBIDDEN_METADATA_KEYS.test(key)) {
    throw new BadRequestException(`Unsupported audit metadata key "${key}".`);
  }
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (FORBIDDEN_METADATA_KEYS.test(value)) {
      throw new BadRequestException('Unsupported audit metadata value.');
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadataValue(entry, allowlist, undefined, inChanges));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const nextInChanges = inChanges || key === 'changes';
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_METADATA_KEYS.test(childKey)) {
        throw new BadRequestException(`Unsupported audit metadata key "${childKey}".`);
      }
      const allowed =
        key === 'changes' ||
        allowlist.has(childKey) ||
        (nextInChanges && (childKey === 'from' || childKey === 'to'));
      if (allowed) {
        out[childKey] = sanitizeMetadataValue(childValue, allowlist, childKey, nextInChanges);
      }
    }
    return out;
  }

  throw new BadRequestException('Unsupported audit metadata type.');
}

function assertSupportedAction(action: string): asserts action is PlatformAuditAction {
  if (!(Object.values(PLATFORM_AUDIT_ACTIONS) as string[]).includes(action)) {
    throw new BadRequestException(`Unsupported platform audit action "${action}".`);
  }
}

function assertSupportedActorType(actorType: string): asserts actorType is PlatformAuditActorType {
  if (!(PLATFORM_AUDIT_ACTOR_TYPES as readonly string[]).includes(actorType)) {
    throw new BadRequestException(`Unsupported platform audit actor type "${actorType}".`);
  }
}

function assertSupportedEntityType(
  entityType: string,
): asserts entityType is PlatformAuditEntityType {
  if (!(PLATFORM_AUDIT_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    throw new BadRequestException(`Unsupported platform audit entity type "${entityType}".`);
  }
}

export function buildFieldChanges<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: readonly (keyof T)[],
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    const from = before[field];
    const to = after[field];
    if (from !== to) {
      changes[String(field)] = { from, to };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

export function truncateAuditPreview(value: string, max = 120): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
