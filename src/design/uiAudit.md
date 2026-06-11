# UI Audit — Concrete Calc

Screen-by-screen notes driving the design-system milestone. Priority: **P0** (ship blocker) → **P2** (polish).

## Operations Dashboard (`/`)

| Field | Notes |
|-------|-------|
| **Purpose** | Daily command center — schedule, field ops, project health |
| **Primary action** | Start Project, Quick Quote |
| **Clutter** | Full proposal pipeline + full finance duplicated from dedicated pages |
| **Hierarchy** | Hero KPIs compete with 8+ equal-weight panels |
| **Priority** | **P0** — highest visibility; proves shared components |

**Target layout:** `PageHeader` → `KpiStrip` → 2/3 schedule + field + 1/3 next actions → compact business snapshot (link to `/financials`) → active projects.

---

## Estimate Workspace (`/projects/:id/estimate`)

| Field | Notes |
|-------|-------|
| **Purpose** | Build and price construction activities |
| **Primary action** | Add Activity, Save |
| **Clutter** | Custom modal chrome; tab bar not using shared `Tabs` |
| **Hierarchy** | Estimate type chip buried; save/actions scroll away on mobile |
| **Priority** | **P0** — most complex product surface |

**Target:** Sticky header with type chip + actions; `ModalShell` wizard for Add Activity (3 steps).

---

## Proposals (`/proposals`)

| Field | Notes |
|-------|-------|
| **Purpose** | CRM pipeline — send, track, win proposals |
| **Primary action** | New proposal |
| **Clutter** | Hero typography with drop-shadow on interior page; bespoke KPI cards |
| **Hierarchy** | Filters and pipeline board lack consistent toolbar |
| **Priority** | **P1** |

**Target:** `PageHeader` + `KpiStrip` + `PageToolbar` filter chips.

---

## Financial Details (`/financials`)

| Field | Notes |
|-------|-------|
| **Purpose** | Full revenue / cost / margin breakdown |
| **Primary action** | Back to dashboard |
| **Clutter** | Ad-hoc back button + title block |
| **Hierarchy** | Metrics not in `KpiStrip` |
| **Priority** | **P1** |

**Target:** `AppPage` + `PageHeader` + `KpiStrip` + existing `FinancialDetailsPanel`.

---

## Projects List (`/projects`)

| Field | Notes |
|-------|-------|
| **Purpose** | Browse and create projects |
| **Primary action** | Create project |
| **Clutter** | Custom empty state |
| **Priority** | **P2** — adopt `EmptyState` |

---

## Documents / RFIs / FARs

| Field | Notes |
|-------|-------|
| **Purpose** | Field records and attachments |
| **Primary action** | Create record |
| **Clutter** | One-off empty placeholders |
| **Priority** | **P2** — adopt `EmptyState` + `InlineNotice` |

---

## Modals (cross-cutting)

| Field | Notes |
|-------|-------|
| **Issue** | Inconsistent header/footer padding, no sticky footer, mixed close buttons |
| **Priority** | **P1** — `ModalShell` with cancel left / primary right |

**Affected:** Add Activity, conceptual line item, labor rate recalc, production rate library, choose estimate type, RFI, FAR, change order modals.

---

## Token gaps (resolved in Phase 1)

- `FOCUS_RING`, `PAGE_MAX_WIDTH`, `PAGE_GUTTER`, `SECTION_SPACING`, `CARD_PADDING`
- Elevation: `SURFACE_0`, `SURFACE_1`, `SURFACE_2`
- Tailwind aliases: `rounded-card`, `shadow-card`, `p-page`, etc.

---

## Component gaps (resolved in Phase 2)

`PageHeader`, `SectionHeader`, `AppPage`, `PageToolbar`, `EmptyState`, `KpiStrip`, `DataTable`, `InlineNotice`, `ModalShell`
