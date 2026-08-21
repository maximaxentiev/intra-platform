# Dashboard Overview API

Ops command-centre data contract for the redesigned Dashboard.

## Endpoint

`GET /api/dashboard/overview`

- Ops-authenticated only (global `SessionGuard`)
- No query parameters — all calendar anchors are resolved server-side

The legacy `GET /api/dashboard/summary` endpoint remains unchanged for the current MVP Dashboard UI.

## Timezone

All business-date logic uses **America/Toronto**, reusing report date utilities (`report-date.util.ts`, `shift-toronto.util.ts`).

| Term | Definition |
|------|------------|
| **Today** | Current Toronto calendar date |
| **Tomorrow** | Today + 1 calendar day |
| **Next 7 Days** | Tomorrow through today + 7 calendar days (inclusive). Today is excluded. |

## Sections

### Today

Shift counts where `shift_date = Toronto today` (all statuses in total).

Returns up to **12** today shifts sorted by start time, then centre name, with `hasMoreShifts`.

Pending rows include `startsAt` (ISO UTC instant) and `minutesUntilStart` (Toronto wall-clock math).

### Attention — urgent pending shifts

Pending shifts where:

- `shift_date >= Toronto today`
- Toronto start datetime `<= now + 24 hours`

Includes past-start pending shifts still on today's date. Excludes yesterday and shifts beyond the rolling 24-hour window.

Up to **5** rows plus `totalUrgentPendingCount` / `hasMoreUrgentPending`.

**No smart matching** is run on Dashboard load. Assignment eligibility remains on Shift Detail.

### Next 7 Days

Aggregated shift counts and fill rate for the Next 7 Days date range.

Fill rate reuses report semantics:

`(filled + completed) / (pending + filled + completed) × 100`

Cancelled excluded; `null` when denominator is zero.

Up to **5** pending shifts in range for staffing-risk display.

### Documents

Reuses `ReportsDocumentsService.getActiveStaffComplianceSummary()` — same semantics as the Document Compliance report default (active staff only).

`attention.documents` surfaces blocking Ops-action counts: `pendingReview`, `issueFlagged`, `expired`.

### Staff readiness

Portal account status counts for **active** staff only, using `resolvePortalAccountDisplayStatus`.

### Communications

Authoritative failure counts only:

- `shift_assignment_notifications.status = failed`
- `scheduled_communications.status = failed` (excluding `test_*` types)

Does **not** count transient failed delivery attempts when the scheduled communication ultimately succeeded.

### Recent activity

Latest **6** items from the Activity Log union (default 30-day Toronto window). No new audit events are created.

## Performance

Parallel independent queries:

1. Today status counts (SQL aggregate)
2. Today shift rows (single join query)
3. Urgent pending candidates (coarse date filter + in-memory 24h filter)
4. Next 7 Days status counts (SQL aggregate)
5. Next 7 Days pending rows (single join query)
6. Document compliance summary (reused report service)
7. Staff readiness (active staff + portal accounts)
8. Communication failure counts + recent items
9. Activity log page (6 items)

No per-shift matching. No full report payloads. No document file loading.
