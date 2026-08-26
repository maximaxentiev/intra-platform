# Intra Ops — Design System

Frontend visual source of truth for the Intra Operations platform (`apps/web`).
Carer Portal shell is out of scope for this document.

Implementation lives in:

- `src/styles.css` — Tailwind v4 theme + CSS variable tokens (single token system)
- `src/components/ui/` — shadcn primitives (unmodified conventions)
- `src/components/ui-kit/` — Intra shared design-system components

---

## 1. Product personality

Effortless, operational, clean, dense but not cramped, confident, approachable,
fast, predictable, satisfying, and **quiet when healthy**.

> **Core principle: visual prominence must be earned by operational importance.**

Do not build a decorative SaaS surface. Banned by default: gradients,
glassmorphism, giant cards everywhere, rainbow status colours, decorative
charts, oversized healthy/empty states, animation for its own sake, and making
every action purple.

References for tone: the Dashboard (`/dashboard`) and Ops Staff → Documents.

---

## 2. Visual hierarchy

Order of emphasis on any screen:

1. Things that are broken or time-critical (unfilled shift today, failed comms)
2. Things needing a decision today
3. Routine scheduled information
4. Historical / reference information

Rules:

- One page-level primary action; everything else is secondary/ghost/overflow.
- Colour is a signal, not decoration. Healthy states are grey/neutral.
- A healthy section should collapse to a single quiet row, not a big card.
- Never rely on colour alone — always pair with label and/or icon.

---

## 3. Semantic colour roles

Brand palette: Primary `#6366F1`; accents `#18181B`, `#FFFFFF`, `#585691`,
`#5C6F3D`, `#FFF4DB`; secondaries `#F4F4F5`, `#E8EEFE`, `#F1F7E6`, `#FFF4DB`,
`#FEE8F7`, `#FEDFD8`.

| Role | Token(s) | Use |
| --- | --- | --- |
| Brand primary | `--primary` / `bg-primary`, `text-primary` | Brand identity, links, primary buttons, chart 1 |
| Primary action | `--primary-action` / `bg-primary-action` | Small white-text controls needing AA body contrast |
| Primary soft | `--primary-soft` (`#E8EEFE` tone) | Tinted backgrounds behind primary icons/metrics |
| Ink / foreground | `--foreground` (`#18181B` family) | All body and heading text |
| Surfaces | `--background`, `--surface`, `--surface-muted`, `--card` | Page background is warm brand **beige**; content surfaces (cards, tables, panels) are white/near-white so information visibly sits *on* the page |
| Muted | `--muted`, `--muted-foreground` | Neutral chips, secondary text, healthy/zero states |
| Success (sage) | `--success`, `--success-soft` (`#F1F7E6`) | Completed, compliant, active |
| Warning (amber/cream) | `--warning`, `--warning-soft` (`#FFF4DB`) | Pending, expiring, needs attention |
| Info (dusk) | `--info`, `--info-soft` (`#585691` / `#E8EEFE`) | Filled/assigned, neutral informational emphasis |
| Destructive | `--destructive` | Irreversible deletion, hard failures only |
| Border / input / ring | `--border`, `--input`, `--ring` | Separators, fields, focus |

Reserved, **not yet in use**: `#FEE8F7` and `#FEDFD8`. Do not introduce them
decoratively; they wait for a real semantic role.

Rules:

- `--primary` stays the brand identity colour. When white text sits on indigo at
  small sizes, use `bg-primary-action text-primary-action-foreground`.
- Destructive red is never reused for "warning" or "pending".
- Never write `text-white`, `bg-black`, or a hex value in a component. If a value
  is missing, add a token in `src/styles.css` first.
- Dark mode is token-driven; every new token must define a `.dark` value.

---

## 4. Typography

| Level | Class | Use |
| --- | --- | --- |
| Page title | `text-2xl sm:text-[1.75rem] font-semibold tracking-tight` | `PageHeader` / `ObjectHeader` |
| Section title | `text-[15px] font-semibold tracking-tight` | `SectionCard`, `DashboardSection` |
| Section description | `text-[13px] text-muted-foreground` | Supporting line under a section title |
| Body | `text-sm` | Tables, forms, most content |
| Secondary | `text-[13px] text-muted-foreground` | Supporting metadata |
| Eyebrow / column head | `text-xs font-medium uppercase tracking-wide text-muted-foreground` | Table headers, property labels |
| Metric value | `text-2xl` (tile) / `text-3xl` (card), `font-semibold tabular-nums` | Metrics |

All numeric columns and metrics use `tabular-nums`.

---

## 5. Spacing rhythm

- Page sections: `space-y-8`; content inside a section: `space-y-3`.
- Card padding: `px-4 py-3.5`; card header: `px-4 py-3`.
- Table cell padding: `px-3`, row height `h-11`, header `h-9`.
- Grid gaps: `gap-3` dense (metrics, filters), `gap-4` general.
- Minimum interactive target: 32px desktop, 40px+ on touch rows.

---

## 6. Buttons

| Hierarchy | Variant | Notes |
| --- | --- | --- |
| Primary | `default` | One per page/section |
| Secondary | `outline` | Common alternate actions |
| Tertiary | `ghost` | Back, toggles, inline actions |
| Navigational | `link` | Inline text links |
| Destructive | `destructive` | Only inside confirmation dialogs, or an overflow item |

Sizes: `sm` (h-8) inside sections/tables, `default` (h-9) for page actions,
`icon` for overflow triggers (always with `aria-label`).

---

## 7. Cards

Use `SectionCard` for a meaningful grouped concept only.

- No card-on-card nesting. A card inside a card means the inner one should be a
  plain block with a heading.
- Cards carry `border-border/70` and `shadow-xs`; heavier shadows are reserved
  for overlays.
- Full-bleed table/list bodies use `padded={false}`.

---

## 8. Tables

`dataTable` in `src/components/ui-kit/DataTable.tsx` holds the conventions:
shell, header typography, row height, separators, hover/focus, status and
trailing action cells.

- Header: uppercase 12px muted on `surface-muted`.
- Rows: 44px, `border-b border-border/60`, hover `bg-muted/50`.
- Clickable rows use `rowInteractive` and must still expose a real link or
  button inside for keyboard users.
- Status column sits immediately before the trailing actions column.
- Trailing actions are right-aligned, `w-px`, and collapse into an overflow menu
  beyond two actions.
- Loading uses `DataTableLoadingRows` (shape-matched), never a spinner.
- Empty uses `DataTableEmptyRow` with a single quiet sentence.
- Responsive: horizontal scroll for wide dense tables, or a compact card list on
  `<sm` for tables with a natural row identity (Staff, Shifts, Users).

---

## 9. Filters

- `FilterPanel` — common filters always visible, advanced filters behind a
  disclosure, apply/clear, result context (`Showing 1–25 of 312`).
- `FilterChipBar` — readable active filters, individual removal with a labelled
  remove button, clear all.

These are presentation shells only. Report filtering keeps its existing
`ReportFilterRuleBuilder`, URL param names, Zod `validateSearch`, and
serialization.

---

## 10. Forms

- Label above field, `text-xs font-medium text-muted-foreground` in filters,
  standard `Label` in forms.
- Field height 36px (`h-9`); full-width within its grid cell.
- Errors: short, below the field, referenced with `aria-describedby`.
- Group related fields in a `fieldset` with a `legend` on multi-step flows.
- Unsaved-change guards keep the Carer onboarding pattern.

---

## 11. Statuses

- `StatusPill` — high-level operational states: Pending, Filled, Completed,
  Cancelled, Active, Inactive, Disabled, Neutral. Unknown values degrade to
  `neutral`.
- `DocumentStatusPills` — specialised document workflow family. Document
  business logic stays there; do not force it into `StatusPill`.

Pills always contain text; icons are decorative (`aria-hidden`).

---

## 12. Tabs

Tabs group views of the same object. They do not replace navigation, never
exceed ~5 items, and preserve URL state where a view is linkable.

---

## 13. Empty states

`EmptyState` with two variants:

- `compact` (default) — expected/healthy emptiness: a thin dashed strip with a
  sentence and an optional inline action.
- `full` — only when the empty condition dominates the page (a brand-new
  directory with no records).

Never show a large illustration-style empty state for a routine "nothing today".

---

## 14. Loading

`ListLoading`, `DetailLoadingState`, `SectionLoading`, `MetricsLoading`,
`DataTableLoadingRows`. Skeletons are shape-matched to the content they replace,
wrapped in `aria-busy` + `aria-live="polite"` with an `sr-only` label. Large
central spinners are not used; inline spinners are allowed inside a button.

---

## 15. Errors

- Field-level errors inline.
- Request failures: an `Alert` in place of the content, stating what failed and a
  retry action. Never a bare toast for a blocking failure.
- Never surface raw API/stack text to Ops users.

---

## 16. Notifications

`sonner` toasts for confirmation of completed background-ish actions
(saved, invite sent). Keep them short, one line, no stacked spam. Blocking
errors belong in the page, not in a toast.

---

## 17. Destructive actions

Use `ConfirmDestructiveDialog`.

- Destructive triggers never compete with the page primary action; Delete lives
  in secondary or overflow treatment.
- The description explains the consequence and reversibility.
- Cancel is always first and never de-emphasised.
- Operational workflows (cancel a shift, revoke a share link) may stay directly
  accessible and use `tone="default"` — they are reversible operations, not
  deletions.
- All existing business-rule enforcement stays server-side.

---

## 18. Activity feeds

`ActivityFeed` + `ActivityItem` provide the shared visual model.

- `density="compact"` — Dashboard: title with inlined description, one metadata
  line.
- `density="detailed"` — Reports activity log: description on its own line,
  timestamp, optional expandable details.

Data shapes and label logic stay with each feature.

---

## 19. Detail headers

`ObjectHeader` for Staff / Centre / Shift detail screens: back link, eyebrow,
title, status/meta pills, supporting info, up to two visible actions, plus an
overflow menu for the rest (including destructive items). `PageHeader` remains
correct for list/report pages.

`PropertyList` renders readable label/value detail (`<dl>`), supporting links and
pill values, wrapping responsively.

---

## 20. Metrics

`MetricTile` is the shared visual primitive.

- `layout="tile"` — dense Dashboard tile with a tinted trailing icon.
- `layout="card"` — Report card with a tone-chipped label.
- Optional `to`/`search`/`params` makes the whole tile a link with a focus ring.
- Tone is semantic, not decorative: neutral by default.

---

## 21. Responsive principles

- Desktop-first density for Ops tables, with a deliberate mobile fallback.
- Mobile: stack headers, wrap actions, keep the primary action reachable, use
  sticky action bars only for long editing flows.
- Never horizontally clip actions; allow wrapping.
- Touch targets ≥40px in mobile card lists.

---

## 22. Accessibility

- Every interactive element is keyboard reachable with a visible focus ring
  (global `:focus-visible` shadow ring).
- Icon-only controls require `aria-label`; decorative icons use `aria-hidden`.
- No colour-only state communication.
- Loading regions use `aria-busy` + `aria-live="polite"`; empty states use
  `role="status"`.
- Repeated row actions get contextual labels ("Remove filter Centre: X").
- Detail data uses real `<dl>`/`<table>` semantics.

---

## 23. Interaction & motion

- Transitions: colour/opacity only, ~150ms. No layout-shifting animation.
- Hover: `bg-muted/50` on rows, subtle border tint on linked cards.
- Active: `translate-y-px` on card links; nothing more elaborate.
- `prefers-reduced-motion: reduce` neutralises animations and transitions
  globally (`src/styles.css`); skeletons stop pulsing, spinners keep turning at a
  calm rate, and all non-motion feedback is preserved.

---

## 24. Adoption status

The design system is adopted **page by page**, not by bulk refactor. A primitive
becomes a platform standard only once a real workflow depends on it.

### Adopted today

| Primitive | Where it is live |
| --- | --- |
| `StatusPill` (via the `StatusBadge` facade) | Shifts list, Shift detail, Dashboard, Staff |
| `MetricTile` | Dashboard tiles, Report metric cards |
| `LoadingState` (`ListLoading`, `DetailLoadingState`) | Shifts list (mobile), detail screens |
| `dataTable` conventions + `DataTableLoadingRows` / `DataTableEmptyRow` | Shifts list (desktop) |
| `FilterPanel` + `FilterChipBar` | Shifts list (compact chip / result / action footer) |
| `EmptyState` (compact) | Shifts list, Shift detail assignment |
| `SectionCard` | Shift detail, Create shift, Shift internal comments |
| `PropertyList` | Shift detail |
| `ConfirmDestructiveDialog` | Shift deletion |
| `Tooltip` (field helper on label) | Shifts list (Staffpoint column), Create shift (Staffpoint) |
| Reduced-motion handling | Global (`src/styles.css`) |

### Planned — adopt during page migration

These exist and are documented, but no shipped workflow depends on them yet.
They are not platform standards until a real page adopts them.

- `ObjectHeader` — Shifts intentionally kept `PageHeader`; revisit with Staff /
  Centre detail.
- `ActivityFeed` / `ActivityItem` beyond the Dashboard and Reports activity log.
- `ComboboxField` outside its current single caller.
- `EmptyState` `full` variant.

### Reserved tokens

- `--primary-action` / `bg-primary-action` — **RESERVED**. Shifts did not need
  it; the `Button` component is deliberately *not* rewired to consume it. Use it
  only for a specific small-text-on-indigo contrast problem.
- `#FEE8F7`, `#FEDFD8` — reserved, awaiting a real semantic role.


---

## Surface, button, tab and navigation contract (redesign)

- **Page background** is warm brand beige (`--background`). **Content surfaces** are
  white (`--card` / `--surface`). Never place white-on-white; every information
  block belongs in a `SectionCard` or equivalent bordered white surface.
- **Primary actions** (Add, Create, Save, Edit, Apply, Export, Add contact,
  document/shift actions) use the default `Button` variant — Intra purple. Never
  leave a real action as a plain white rectangle.
- **Secondary / cancel** actions use `outline` (bordered white) or `ghost`;
  destructive uses `destructive`.
- **Back navigation** uses `BackLink` from `ui-kit`, always placed *above* the
  page title, never inline with page actions.
- **Tabs** use the shared `Tabs` primitive: bordered pill bar, solid purple
  active state, hover affordance on inactive tabs.
- **Field labels** are semibold 13px muted; **values** are 15px foreground.
  Uppercase eyebrow labels above an object title are not used.
- **Copy**: remove descriptions the UI already communicates. Exception: Reports
  keeps the explanatory copy under each report title.
- **Branding**: the Ops product name is "Intra Platform". The mark in
  `AppShell.tsx` is a placeholder slot — swap in the official Intra logo asset
  when supplied; do not redraw it.
