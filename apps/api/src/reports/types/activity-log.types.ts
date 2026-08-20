/** Default Activity Log window — last 30 Toronto calendar days inclusive. */
export const ACTIVITY_LOG_DEFAULT_DAYS = 30;

export const ACTIVITY_LOG_CATEGORIES = [
  'shifts',
  'staff',
  'documents',
  'communications',
  'centres',
  'users',
  'system',
] as const;

export type ActivityLogCategory = (typeof ACTIVITY_LOG_CATEGORIES)[number];

export const ACTIVITY_LOG_ACTOR_TYPES = [
  'ops_user',
  'staff',
  'system',
  'unknown',
] as const;

export type ActivityLogActorType = (typeof ACTIVITY_LOG_ACTOR_TYPES)[number];

export interface ActivityLogActor {
  type: ActivityLogActorType;
  id: string | null;
  name: string | null;
}

export interface ActivityLogStaffRef {
  id: string;
  name: string;
}

export interface ActivityLogCentreRef {
  id: string;
  name: string;
}

export interface ActivityLogShiftRef {
  id: string;
  shiftDate: string;
}

export interface ActivityLogItem {
  id: string;
  occurredAt: string;
  category: ActivityLogCategory;
  action: string;
  title: string;
  description: string | null;
  actor: ActivityLogActor;
  staff?: ActivityLogStaffRef;
  centre?: ActivityLogCentreRef;
  shift?: ActivityLogShiftRef;
  metadata?: Record<string, unknown>;
}

export interface ActivityLogResponse {
  dateFrom: string;
  dateTo: string;
  category: ActivityLogCategory | null;
  actorType: ActivityLogActorType | null;
  staffId: string | null;
  centreId: string | null;
  shiftId: string | null;
  items: ActivityLogItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

/** Raw row returned by the UNION ALL activity query. */
export interface ActivityLogRawRow {
  source_key: string;
  occurred_at: Date | string;
  category: ActivityLogCategory;
  action: string;
  actor_type: ActivityLogActorType;
  actor_user_id: string | null;
  staff_id: string | null;
  centre_id: string | null;
  shift_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown> | null;
}
