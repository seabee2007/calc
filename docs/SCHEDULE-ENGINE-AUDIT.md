# Schedule Engine Audit

Status: **Audit only — no production behavior was changed by this document.**
Scope: CPM baseline, logic links, precedence diagram, logic-network rendering, Level III
Gantt, resource leveling, leveled dates, critical path, total/free float, schedule preview,
Gantt/Logic-network exports, persistence, clear leveling, rerun CPM, dirty/save state.

The goal is a complete source-of-truth map so the remaining Resource-Leveled Logic Network
connector-line bug can be fixed with a small, surgical change to the **rendered link list
only** — not to schedule math.

> Reading note: file paths are relative to `calc/`. Function names are the real exported/
> internal symbols verified in code at the time of writing.

---

## 1. Schedule Source of Truth

| Item | File | Type / interface | Created | Mutated | Saved | Loaded | Consumed | Canonical or derived |
|---|---|---|---|---|---|---|---|---|
| Construction activities (schedule) | `src/features/estimating/scheduling/adapters/estimateLineItemsToScheduleActivities.ts` + `constructionActivitiesToScheduleActivities.ts` | `ScheduleActivity` | Adapted from estimate line items / construction activities | Re-derived on line-item change | Not directly (derived from line items) | Rebuilt each render via adapters | CPM, Gantt, leveling, logic network, exports | **Canonical** input (durations, crew sizes) |
| `logicLinks` | `src/features/estimating/scheduling/cpmTypes.ts` (`CpmLogicLink`) | `CpmLogicLink[]` | Logic Network editor / AI seed / import | Editor add/edit/delete (`onLinksChange`) | `assumptions.logicLinks` | `parseLogicLinksFromAssumptions` | CPM, logic-network rendering, export | **Canonical** (user dependency logic) |
| `scheduleSettings` | `cpmTypes.ts` (`ScheduleSettings`) | `{projectStartDate, hoursPerDay, availableCrewSize, includeWeekends}` | `useScheduleSettings` | `updateScheduleSettings` | `assumptions.scheduleSettings` | `parseScheduleSettingsFromAssumptions` | CPM start day, Gantt calendar, leveling crew | **Canonical** |
| `leveledActivityOffsets` | numeric map | `Record<string, number>` (code → day offset) | `handleApplyResourceLeveling` (from leveling result) | `setLeveledOffsets`, cleared on Clear Leveling | `assumptions.leveledActivityOffsets` | `parseLeveledOffsetsFromAssumptions` | `resolveEffectiveSchedule`, Gantt rows/cells, leveled logic | **Canonical** for the leveled schedule (the single thing that shifts dates) |
| `resourceLevelingResults` | `cpmTypes.ts` (`ResourceLevelingResult`, subset persisted) | `{ movedActivities: MovedActivity[] }` persisted subset | `resourceLevelSchedule()` in preview, persisted in `handleApplyResourceLeveling` | Replaced on each apply; removed on Clear Leveling | `assumptions.resourceLevelingResults` | **Read ad-hoc** in `EstimateWorkspacePage` memo (NOT via `useScheduleSettings`) | Provider records → resource-dummy connector lines | **Canonical** for *provider records*; derived from leveling run |
| Committed CPM result | `cpmTypes.ts` (`CpmResult`) | full CPM result | `runCpmCalculation` (Run CPM) / `recomputeCommittedCpmFromSavedState` on load | Run CPM, invalidated on logic change | `assumptions.precedenceDiagram` (+ legacy `cpmResultCache`) | `parsePrecedenceDiagramFromAssumptions` + recompute | Gantt, logic network baseline, effective schedule, exports | **Derived** from activities + logicLinks |
| Gantt computed rows | `levelThreeGanttUtils.ts` (`LevelThreeGanttRow`) | rows w/ `plannedStart/Finish`, `leveledOffset` | `getLevelThreeGanttRows` | Pure (recomputed) | Not persisted | n/a | Level III Gantt, Gantt PDF/Excel | **Derived** (baseline CPM + offsets) |
| Effective schedule summary | `effectiveSchedule.ts` (`EffectiveScheduleSummary`) | dates map + durations | `resolveEffectiveSchedule` | Pure | Not persisted | n/a | Schedule Preview, effective analysis | **Derived** (canonical *resolver* over CPM + offsets) |
| Effective leveled analysis | `effectiveSchedule.ts` (`EffectiveScheduleAnalysis`) | leveled CPM, links, controlling set | `getEffectiveScheduleAnalysis` → `buildLeveledLogicNetworkFromGanttSchedule` | Pure | Not persisted | n/a | Resource-Leveled Logic Network only | **Derived** |
| Exported schedule data | `export/levelThreeGanttPdfExport.ts`, `ganttExcelExport.ts`, `logicNetworkExcelExport.ts` | workbook/PDF | On export click | n/a | downloaded file | n/a | user | **Derived** |
| Supabase persisted state | `application/currentEstimateService.ts` | `estimates.assumptions` JSONB | save funcs | save funcs | DB column `assumptions` | `currentEstimateService` load | hydration | **Canonical persisted store** |
| Local/session state | React state in `EstimateWorkspacePage`, `useScheduleSettings`, canvas | various | component mount | hooks | cached per project (`cacheCurrentEstimateForProject`) | cache + DB | UI | derived/cache |

Key takeaway: there are exactly **two canonical schedule-shifting inputs** — `logicLinks`
(baseline logic) and `leveledActivityOffsets` (the leveled shift). Everything else about
dates/duration is derived. `resourceLevelingResults.movedActivities[].resourceProviderActivityCodes`
is the only canonical source permitted for resource-dummy connectors.

---

## 2. File Map

### CPM / logic
- `scheduling/cpm/calculateCpm.ts` — Core CPM. `calculateCpm` (forward/backward pass, TF/FF, critical) and `runCpmCalculation` (user-triggered, attaches `hasRunCpm`/`hardErrors`).
- `scheduling/cpm/cpmDisplayCritical.ts` — `isDisplayCritical`, `resolveTopologyLabel`. The single definition of "display-critical" (red) used by Gantt, cards, and edges.
- `scheduling/cpm/criticalPathContinuity.ts`, `validateCriticalPathContinuity.ts` — Continuity validation; produces `displayCriticalActivityCodes`, open-start/finish sets.
- `scheduling/cpm/cpmCriticalPathPreview.ts` — Live-preview CPM critical styling for Logic Network mode.
- `scheduling/cpmTypes.ts` — All shared interfaces (`CpmLogicLink`, `CpmActivityResult`, `CpmResult`, `ScheduleSettings`, `MovedActivity`, `ResourceLevelingResult`, etc.).
- `scheduling/logic/*` — `logicNetworkTopology.ts` (pred/succ counts, topology labels), `logicCycleUtils.ts` (cycle guard), `validateCpmReadiness.ts`, `autoLayoutLogicNetwork.ts`.
- `scheduling/precedenceDiagram.ts` — Committed CPM persistence/recompute (`buildPrecedenceDiagramRunState`, `recomputeCommittedCpmFromSavedState`, signatures, stale detection).

### Effective schedule / leveling
- `scheduling/effectiveSchedule.ts` — Canonical resolver + leveled analysis. `resolveEffectiveSchedule`, `getEffectiveScheduleAnalysis`, `buildLeveledLogicNetworkFromGanttSchedule`, `validateResourceLeveledRenderedLinks` (dev-only), interfaces `EffectiveActivityDates/Analysis`, `EffectiveScheduleSummary/Analysis`, `ResourceLeveledDelayRecord`.
- `scheduling/resources/resourceLevelSchedule.ts` — The leveling algorithm. `resourceLevelSchedule` (entry), `enforceSuccessorConstraints`, `buildLeveledActivities`, `projectDurationFromOffsets`, `attachResourceProviders` (provider records), crew-fit helpers.
- `scheduling/resources/resourceHistogramCalculator.ts` — Daily crew demand (`calculateResourceHistogram`), used before/after leveling.
- `scheduling/resources/scheduleActivityCrewSize.ts`, `projectAvailableCrewSize.ts` — Crew-size resolution inputs to leveling.

### Level III Gantt
- `scheduling/levelThreeGanttUtils.ts` — `getLevelThreeGanttRows` (row order = `earlyStart + leveledOffset`), `resolveGanttCellKind`, `resolveGanttRowCodeClassName` (leveled critical/float coloring), timeline builders.
- `scheduling/levelThreeGanttGrid.ts`, `levelThreeGanttFullscreen.ts`, `levelThreeGanttWorkspaceSummary.ts` — grid math, fullscreen, summary text.
- `ui/components/scheduling/LevelThreeGantt.tsx`, `LevelThreeGanttWorkspace.tsx`, `ResourceHistogram.tsx`, `ResourceLevelingModal.tsx`, `LevelThreeGanttExportMenu.tsx`, `LevelThreeGanttLegend.tsx` — Gantt UI, histogram, leveling modal, export menu.

### Logic Network
- `ui/components/scheduling/EstimateLogicNetworkCanvas.tsx` — React Flow canvas. `linkToEdge`, `mapLogicLinksToEdges`, `buildLogicNetworkNodes`, and the leveled-mode selectors (`leveledGraphActive`, `activeCpmResult`, `displayLogicLinks`, `sanitizedLogicLinks`, `generatedLeveledFsLinkKeys`, `mappedEdges`). **This is where rendered connector lines are produced.**
- `ui/components/scheduling/CpmActivityNode.tsx` — Card rendering (baseline + leveled overlay fields).
- `ui/components/scheduling/LogicNetworkWorkspace.tsx` — Wrapper: mode toggle, live preview CPM, Logic Network Excel export trigger.
- `scheduling/logicNetworkLayout.ts`, `logicNetworkViewportPolicy.ts`, `logicNetworkSaveLayout.ts`, `logicNetworkFullscreen.ts` — layout/viewport/persistence helpers.

### Schedule preview
- `ui/components/EstimateSchedulePreviewPanel.tsx` — Consumes `resolveEffectiveSchedule` for duration labels.

### Save / load / persistence
- `scheduling/scheduleAssumptions.ts` — `mergeScheduleAssumptions`, all `parse*FromAssumptions`, `SCHEDULE_LAYER_ASSUMPTION_KEYS`, `stripScheduleLayerKeys`, sanitizers.
- `ui/hooks/useScheduleSettings.ts` — `rehydrateFromEstimate`; parses assumptions into state. **Does not parse `resourceLevelingResults`.**
- `application/currentEstimateService.ts` — DB load/save of `estimates.assumptions` JSONB.
- `ui/EstimateWorkspacePage.tsx` — Orchestrator. Builds `effectiveSchedule`, `effectiveAnalysis`, `resourceLeveledDelayRecords`; handles Run CPM, apply/clear leveling, saves.

### Exports
- `export/logicNetworkExcelExport.ts` — `exportLogicLinksToExcel` (Logic Links + Activities sheets).
- `export/levelThreeGanttPdfExport.ts`, `ganttExcelExport.ts`, `ganttPdfExport.ts` — Gantt exports.

### Tests (representative)
- `scheduling/__tests__/calculateCpm.test.ts`, `cpmMathRegression.test.ts`, `cpmCriticalPathUnified.test.ts` — CPM math.
- `resourceLevelSchedule.test.ts`, `resourceHistogramCalculator.test.ts` — leveling.
- `levelThreeGanttUtils.test.ts`, `levelThreeGanttSort.test.ts` — Gantt rows/coloring.
- `scheduleAssumptionsSanitize.test.ts`, `logicNetworkSaveLayout*.test.ts`, `precedenceDiagramPersistence.test.ts` — persistence.
- `__tests__/levelThreeGanttExport.test.ts`, `ganttExcelExport.test.ts`, `ganttPdfExport.test.ts` — exports.

---

## 3. CPM Baseline Flow

```
estimate line items / construction activities
  └─ estimateLineItemsToScheduleActivities() ────────────► ScheduleActivity[]
logicLinks (assumptions.logicLinks)
  └─ parseLogicLinksFromAssumptions() ───────────────────► CpmLogicLink[]
ScheduleActivity[] + CpmLogicLink[]
  └─ runCpmCalculation() → calculateCpm()
        forward pass  → earlyStart / earlyFinish
        backward pass → lateStart / lateFinish
        float         → totalFloat = LS-ES (== LF-EF), freeFloat
        critical      → isCritical = (totalFloat === 0)
        continuity    → validateCriticalPathContinuity()
                        → displayCriticalActivityCodes (alias validCriticalPathActivityCodes)
  └─► CpmResult (committed via setCommittedCpmResult / persisted in precedenceDiagram)
CpmResult
  ├─ Logic Network (precedence-diagram mode): buildLogicNetworkNodes() + mapLogicLinksToEdges()
  │     red = isDisplayCritical(cpmResult, code) on BOTH endpoints
  ├─ Level III Gantt: getLevelThreeGanttRows() + resolveGanttCellKind() (offsets = {})
  └─ Exports: logicNetworkExcelExport (livePreviewCpm), levelThreeGanttPdfExport (cpmResult)
```

Display-critical (red) is **always** `isDisplayCritical()` from
`cpm/cpmDisplayCritical.ts` reading `CpmResult.validCriticalPathActivityCodes`. Raw
`isCritical`/`criticalPathActivityCodes` are math-only and not used for styling.

---

## 4. Resource Leveling Flow

```
committed CpmResult + ScheduleActivity[] + scheduleSettings + projectAvailableCrewSize
  └─ runResourceLevelingPreview(allowProjectExtension)
        └─ resourceLevelSchedule({activities, logicLinks, availableCrewSize, projectStartDate, allowProjectExtension})
              calculateResourceHistogram()                  → crew demand before
              loop:
                computeRequiredCrewForDay() / activityFitsAtStart()
                pick over-allocated day, choose movable activity (has float or extension allowed)
                push offset; enforceSuccessorConstraints() cascades successors
              attachResourceProviders(movedActivities, activities, baseCpm, offsets)
                 provider A recorded for delayed B iff:
                   offset_B > 0
                   AND leveledFinish(A) === leveledStart(B)   (direct crew handoff)
                   AND baseline overlap(A,B)                   (real baseline crew competition)
              buildLeveledActivities() + histogram after
              projectDurationFromOffsets()
  └─► ResourceLevelingResult { appliedOffsets, movedActivities(+providers), histograms, durations, warnings }
handleApplyResourceLeveling()
  └─ setLeveledOffsets(appliedOffsets)
  └─ persist assumptions.leveledActivityOffsets + assumptions.resourceLevelingResults.movedActivities
leveledActivityOffsets (canonical)
  └─ resolveEffectiveSchedule() → leveledStart/Finish, leveledDurationDays
  └─ getLevelThreeGanttRows(offsets) → leveled Gantt bars, order, coloring
     leveled float (Gantt) = max(0, baseline.totalFloat - leveledOffset)
     leveled critical (Gantt) = isDisplayCritical(baseline) OR (offset>0 AND adjustedFloat===0)
```

The Level III Gantt is the visual source of truth for the leveled schedule and derives
everything from `baseline CPM + leveledActivityOffsets`. It never uses logic links.

---

## 5. Resource-Leveled Logic Network Flow (current code)

In `EstimateLogicNetworkCanvas.tsx`, Resource-Leveled mode is active when
`leveledGraphActive` is true:

```
leveledGraphActive =
  viewMode === 'precedence-diagram'
  && leveledViewActive
  && showCpmFields
  && effectiveAnalysis.effectiveLeveledLinks.length > 0
  && effectiveAnalysis.leveledCpmResult != null
```

What each visual element uses in leveled mode:

| Visual element | Source (current code) |
|---|---|
| Card X position | `effectiveAnalysis.byActivityCode[code].leveledStartDayIndex` (from offsets — Gantt-derived) |
| Card Y position | saved layout `y` or index spacing |
| Card ES/EF/LS/LF/TF/FF numbers | `activeCpmResult = effectiveAnalysis.leveledCpmResult` (CPM run on `cpmInputLinks`) |
| Card "eff. float" / controlling badge | `effectiveAnalysis.byActivityCode[code].effectiveTotalFloat` + `controllingAfterLeveling` |
| Node red (critical) coloring | `leveled.controllingAfterLeveling` = `leveledCriticalActivityIds` = `ganttExpectedCriticalCodes` (Gantt-derived; link-independent) |
| Edge red coloring | `isDisplayCritical(activeCpmResult, …)` on both endpoints (precedence mode) |
| **Rendered connector lines** | `sanitizeLogicLinksForActivities(displayLogicLinks)` where `displayLogicLinks = effectiveAnalysis.effectiveLeveledLinks` |
| Generated-link amber styling | edges whose key ∈ `effectiveAnalysis.generatedLeveledFsLinks` (or `link.generated === true`) |

Where rendered connector lines currently come from (after the most recent change in
`buildLeveledLogicNetworkFromGanttSchedule`):

- `effectiveLeveledLinks` (the **rendered** field) = `preservedLinks` (sanitized baseline
  saved links still valid in the leveled graph) **+ `resourceDummyLinks`** (provider-derived).
- `resourceDummyLinks` are built **only** from `resourceLeveledDelayRecords`
  (`movedActivities[].resourceProviderActivityCodes`), gated by: target delayed, provider
  frees crew by target start, not a duplicate of a baseline link, no cycle.
- The historical date/sibling-generated FS links now live in a **separate** internal array
  `cpmInputLinks` that feeds `leveledCpmResult` only and is **not** rendered.

So as of the current code, rendered edges are: **saved baseline links + provider-derived
resource-dummy links** — not date adjacency, not layout order. The remaining risks are
enumerated in §11 and §13.

---

## 6. Link Source Matrix

| Variable / function | File | Source | Used for CPM? | Used for rendering? | Used for export? | Persisted? | Generated? | Baseline or leveled | Risk / notes |
|---|---|---|---|---|---|---|---|---|---|
| `logicLinks` | `useScheduleSettings`, `EstimateWorkspacePage` | user edits / import / AI | ✅ baseline CPM | ✅ baseline mode | ✅ logic export | ✅ `assumptions.logicLinks` | ❌ | baseline | Canonical user logic. |
| `preservedLinks` | `effectiveSchedule.buildLeveledLogicNetworkFromGanttSchedule` | baseline links filtered to leveled graph (drops `generated`/`resource_leveling`, dedup, valid codes) | indirect (seed of `cpmInputLinks`) | ✅ (seed of rendered `effectiveLeveledLinks`) | ❌ | ❌ | ❌ | leveled view | Should equal the baseline links still valid post-leveling. |
| `cpmInputLinks` | `effectiveSchedule` (internal) | `preservedLinks` + date/sibling-generated FS | ✅ **feeds `leveledCpmResult`** | ❌ (not rendered) | ❌ | ❌ | ✅ (sibling rule) | leveled | **Hidden CPM links** not traceable to provider records — violates an invariant (see §13). Drives leveled ES/EF/TF shown on cards. |
| `resourceDummyLinks` | `effectiveSchedule` | `resourceLeveledDelayRecords` only | ❌ | ✅ rendered (amber) | ❌ | ❌ (links); source records ✅ | ✅ (`source:'resource_leveling'`, `reason:'crew_limit'`) | leveled | Correct, traceable. For GU26-200 expected = `06-01-05 → 06-01-04`. |
| `effectiveLeveledLinks` (returned field) | `effectiveSchedule` → `EffectiveScheduleAnalysis` | `preservedLinks + resourceDummyLinks` | ❌ | ✅ **rendered list** (`displayLogicLinks`) | ❌ | ❌ | partly | leveled | What the renderer receives in leveled mode. |
| `generatedLeveledFsLinks` (returned field) | `effectiveSchedule` | `resourceDummyLinks` | ❌ | ✅ (amber styling key set) | ❌ | ❌ | ✅ | leveled | Drives amber/"Resource leveling constraint" labels. |
| `displayLogicLinks` | `EstimateLogicNetworkCanvas` | `leveledGraphActive ? effectiveLeveledLinks : logicLinks` | ❌ | ✅ | ❌ | ❌ | mixed | both | The branch that selects the rendered set per mode. |
| `sanitizedLogicLinks` | `EstimateLogicNetworkCanvas` | `sanitizeLogicLinksForActivities(displayLogicLinks)` | ❌ | ✅ (final edge input) | ❌ | ❌ | mixed | both | Drops links with missing endpoints before `mapLogicLinksToEdges`. |
| `mappedEdges` / React Flow `edges` | `EstimateLogicNetworkCanvas` | `mapLogicLinksToEdges(sanitizedLogicLinks, …)` | ❌ | ✅ | ❌ | ❌ | mixed | both | Final drawn edges. No edge invented here beyond the input list. |
| `leveledCpmResult.*` links | — | n/a | n/a | n/a | n/a | n/a | n/a | n/a | CPM result has no link list; only activities. |
| Export `logicLinks` arg | `logicNetworkExcelExport` via `LogicNetworkWorkspace` | `canvasProps.logicLinks` (baseline) | ❌ | ❌ | ✅ | ❌ | ❌ | **always baseline** | Export ignores leveled/generated links entirely (see §9). |

`resourceConstraintLinks` / `generatedLeveledLinks` / `renderLinks` as standalone names do
**not** exist in current code (renamed/internalized). `renderLinks` is the internal local in
`buildLeveledLogicNetworkFromGanttSchedule` returned as `effectiveLeveledLinks`.

---

## 7. Date Source Matrix

| Variable / function | File | Baseline or leveled | Working or calendar days | Includes weekends? | Gantt? | Logic Network? | Schedule Preview? | Export? | Persisted? | Risk / notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `CpmActivityResult.earlyStart/earlyFinish` | `calculateCpm` | baseline | working (activity-day index, day 0 based) | n/a (index space) | ✅ (base) | ✅ | ✅ | ✅ | via CPM | Canonical baseline index. Finish exclusive. |
| `lateStart/lateFinish`, `totalFloat`, `freeFloat` | `calculateCpm` | baseline | working | n/a | rows coloring | cards | indirect | logic export | via CPM | Float basis for leveled adjustments. |
| `leveledActivityOffsets[code]` | state/assumptions | leveled delta | working days | n/a | ✅ | ✅ | ✅ | ✅ PDF/Excel | ✅ | The only stored leveled shift. |
| `getLevelThreeGanttRows().{plannedStart,plannedFinish}` | `levelThreeGanttUtils` | leveled (offsets) | calendar via `addDaysToScheduleDate` | depends on `addDaysToScheduleDate` impl | ✅ | ❌ | ❌ | ✅ Gantt | ❌ | Row order = `earlyStart+offset`. |
| `resolveGanttCellKind` tf/floatEnd | `levelThreeGanttUtils` | leveled | working index | n/a | ✅ | ❌ | ❌ | ✅ | ❌ | `tf = max(0, totalFloat - offset)`. |
| `EffectiveActivityDates.leveledStartDayIndex/leveledFinishDayIndex` | `resolveEffectiveSchedule` | leveled | working index | n/a | preview | ✅ (card X) | ✅ | ❌ | ❌ | `= earlyStart + offset`. Card X position basis. |
| `EffectiveScheduleSummary.leveledDurationDays` | `resolveEffectiveSchedule` | leveled | working | n/a | preview/labels | ✅ (label) | ✅ | ❌ | ❌ | `max(maxLeveledFinish, baselineDuration)`. |
| `EffectiveScheduleAnalysis.leveledDurationDays` | `buildLeveledLogicNetworkFromGanttSchedule` | leveled | working | n/a | ❌ | ✅ | ❌ | ❌ | ❌ | Set to `leveledSchedule.leveledDurationDays` (Gantt-aligned, link-independent). |
| `plannedProjectStart/Finish` | `resolveEffectiveSchedule` | leveled | calendar | depends | preview | ❌ | ✅ | ❌ | ❌ | Min/max of planned dates. |
| Gantt PDF timeline | `levelThreeGanttPdfExport` | leveled | calendar | depends | ✅ | ❌ | ❌ | ✅ | n/a | Uses `getLevelThreeGanttRows` + offsets. |

Convention (documented in `effectiveSchedule.ts`): `earlyStart` is inclusive day-0 index;
finish index is exclusive (`start + durationDays`).

---

## 8. Critical Path / Float Matrix

| Function / file | Input links | Input dates | Output fields | Baseline or leveled | Cards? | Gantt? | Export? | Mismatch risk |
|---|---|---|---|---|---|---|---|---|
| `calculateCpm` (`cpm/calculateCpm.ts`) | `logicLinks` | activity durations | TF, FF, `isCritical`, `criticalPathActivityCodes` | baseline | ✅ (base) | ✅ (base) | ✅ | Source of truth for baseline. |
| `validateCriticalPathContinuity` | valid links | CPM activities | `displayCriticalActivityCodes`, open-start/finish | baseline | ✅ | ✅ | ✅ | Display set ⊆ math-critical. |
| `isDisplayCritical` (`cpm/cpmDisplayCritical.ts`) | — | reads `validCriticalPathActivityCodes` | boolean | baseline | ✅ | ✅ | ✅ | Single red-styling gate. |
| `resolveGanttCellKind` / `resolveGanttRowCodeClassName` | — | `earlyStart+offset`, `totalFloat-offset` | cell kind / row class | **leveled** | ❌ | ✅ | ✅ Gantt | `leveled critical = baselineDisplayCritical OR (offset>0 && adjFloat===0)`. |
| `buildLeveledLogicNetworkFromGanttSchedule` → `ganttExpectedCriticalCodes` | — | offsets + baseline TF | `leveledCriticalActivityIds` | leveled | ✅ (node red) | mirrors Gantt | ❌ | **Intentionally mirrors Gantt formula** → cards agree with Gantt. |
| `getEffectiveScheduleAnalysis` → `effectiveTotalFloat` | `cpmInputLinks` (via `leveledCpmResult`) | leveled CPM | per-card leveled TF | leveled | ✅ (card numbers) | ❌ | ❌ | **Risk:** card TF derives from `cpmInputLinks` (hidden sibling links), not from the Gantt `max(0, TF-offset)`. Can drift from Gantt float if sibling links differ. |
| `leveledCpmResult` (edge coloring) | `cpmInputLinks` | leveled CPM | `validCriticalPathActivityCodes` | leveled | edges | ❌ | ❌ | **Risk:** edge red set may differ from node red set (`ganttExpectedCriticalCodes`). |

The two highlighted rows are the only places leveled visuals still depend on the hidden
`cpmInputLinks`. Node red and Gantt agree (both Gantt-derived); **edge red and per-card TF
do not, because they ride on `leveledCpmResult`.**

---

## 9. Export Audit

| Export | File | Schedule used | Links used | Critical source | Leveled-aware? |
|---|---|---|---|---|---|
| Level III Gantt PDF | `export/levelThreeGanttPdfExport.ts` | baseline CPM + `leveledOffsets` | none (bar chart, no connectors) | `isDisplayCritical` + leveled `adjustedFloat===0` via Gantt rows | ✅ reflects leveled schedule |
| Level III Gantt Excel | `export/ganttExcelExport.ts` | baseline CPM + offsets (`GanttExportMode`) | none | same as Gantt | ✅ |
| Logic Network Excel | `export/logicNetworkExcelExport.ts` | `livePreviewCpm` (Logic-Network live preview) | **`canvasProps.logicLinks` = saved baseline links only** | `predCpm.isCritical` (math) | ❌ **always baseline** |
| Detailed estimate export | `importExport/estimateExportBuilder.ts` / `excel/estimateExcelExportBuilder.ts` | line-item totals; schedule data not embedded as leveled graph | n/a | n/a | n/a |

Finding (matches user's observation): the Logic Network Excel export is **baseline-only and
mode-agnostic** — it never receives `effectiveLeveledLinks` or `generatedLeveledFsLinks`. So
the "Logic Links" sheet is identical for baseline and leveled exports. The on-screen renderer
diverges from the export because the renderer (correctly) switches `displayLogicLinks` to the
leveled set, while the export does not.

---

## 10. Persistence Audit

- **Store:** Supabase `estimates.assumptions` (JSONB), via `application/currentEstimateService.ts`.
- **JSON paths inside `assumptions`:**
  - `logicLinks: CpmLogicLink[]`
  - `leveledActivityOffsets: Record<string, number>`
  - `resourceLevelingResults: { movedActivities: MovedActivity[] }` (provider records persisted here)
  - `precedenceDiagram` (committed CPM run state) + legacy `cpmResultCache`/`cpmCalculatedAt`
  - `logicNetworkLayout`, `logicNetworkViewMode`, `logicNetworkInitialized`, `logicReviewIgnored`
- **Save:** `mergeScheduleAssumptions(patch, existing)` (`scheduleAssumptions.ts`) → `saveCurrentEstimateWithLineItems`. `resourceLevelingResults` is now an allowed patch key and is copied/removed by the merge.
- **Load / hydration:** `useScheduleSettings.rehydrateFromEstimate` parses `scheduleSettings`, `logicLinks`, `leveledActivityOffsets`, layout, view mode, precedence diagram, and recomputes committed CPM. **It does NOT parse `resourceLevelingResults`.** Provider records are read separately in `EstimateWorkspacePage` via `currentEstimate.assumptions.resourceLevelingResults` inside the `resourceLeveledDelayRecords` memo.
- **Reset on activity replacement:** `resourceLevelingResults` is in `SCHEDULE_LAYER_ASSUMPTION_KEYS`, so `stripScheduleLayerKeys` clears it when activities are replaced.
- **Clear Leveling:** `saveLogicLinksSafely({clearLevelingState:true})` sets `leveledOffsets={}` and deletes `resourceLevelingResults` + `logicReviewAiSuggestions` from assumptions, then persists and updates `currentEstimate`.

Survival check:

| Scenario | leveledOffsets (Gantt) | resourceLevelingResults (connectors) |
|---|---|---|
| Navigate away/back (cached estimate) | ✅ | ✅ (read from cached `currentEstimate.assumptions`) |
| Hard refresh | ✅ (DB) | ✅ (DB) |
| Logout/login | ✅ (DB) | ✅ (DB) |
| Other browser | ✅ (DB) | ✅ (DB) |
| **Immediately after Apply, before reload** | ✅ (`setLeveledOffsets`) | ⚠️ **GAP** — `handleApplyResourceLeveling` sets `levelingModalResult=null` and does **not** write the saved assumptions back into in-memory `currentEstimate`, so `resourceLeveledDelayRecords` is empty until the estimate is re-hydrated. Connectors fall back to baseline-only until reload. |

The post-Apply gap is the most likely reason resource-dummy connectors "appear only after
re-apply/reload." It is a **persistence-timing** issue, not a math issue.

---

## 11. Known Current Bug

Symptom history: Resource-Leveled Logic Network shows correct card order / critical / float,
but connector lines were wrong/too many and did not follow the leveled controlling chain.

Current state of the code (post most-recent change): rendered edges in leveled mode =
`preservedLinks` (baseline still-valid) + `resourceDummyLinks` (provider-derived only). This
already removes the broad date/sibling-derived edges from the rendered output. The remaining
defects the audit surfaces are:

1. **Hidden CPM links (`cpmInputLinks`)** still drive the *numbers* shown on cards
   (`effectiveTotalFloat`) and the *edge* red coloring (`leveledCpmResult`). These sibling FS
   links are generated by date/order heuristics and are **not traceable to provider records**,
   violating the "no hidden CPM links" invariant. They can make edge-red disagree with
   node-red, and per-card leveled TF disagree with the Gantt's `max(0, TF − offset)`.
2. **Post-Apply timing gap** (§10): provider records are not in memory until reload, so
   resource-dummy connectors can be missing right after Apply.
3. **Export divergence** (§9): Logic Network Excel ignores leveled/generated links, so the
   exported "Logic Links" sheet never matches the leveled on-screen graph.

Root cause of the *connector* problem specifically: the rendered link list and the leveled
schedule numbers were historically computed from the **same** link set
(`effectiveLeveledLinks` = baseline + generated). The fix direction (already started) is to
make the renderer consume a single validated list (baseline + provider dummies) while the
leveled numbers come from a link-independent, Gantt-derived source.

---

## 12. GU26-200 Fixture Analysis

Source: user-provided baseline/leveled Gantt + logic-network Excel exports.

Baseline:
- Activities include `06-01-03 Decking Installation`, `06-01-04 Stairs and Landings`,
  `06-01-05 Railing System`, `07-01-01 Flashing and Weatherproofing`, `09-01-01 Stain and Seal`.
- Baseline links:
  - `06-01-03 → 06-01-04`
  - `06-01-03 → 06-01-05`
  - `06-01-04 → 09-01-01`
  - `06-01-05 → 09-01-01`
  - `07-01-01 → 09-01-01`
- Baseline floats: `06-01-04 Stairs and Landings` = **1 day**; `06-01-05 Railing System` = 0;
  `09-01-01 Stain and Seal` = 0.
- Baseline project finish ≈ **Jul 11** (CPM baseline duration ≈ 22 working days per prior notes).

Resource-leveled:
- Leveled finish ≈ **Jul 13** (≈ 25 working days).
- Leveled critical/0-float: `06-01-05 Railing System`, `06-01-04 Stairs and Landings`,
  `09-01-01 Stain and Seal`.
- Expected controlling chain:
  `06-01-03 Decking → 06-01-05 Railing → 06-01-04 Stairs → 09-01-01 Stain and Seal`.
- Resource provider record (expected): `06-01-04 Stairs and Landings` was delayed; its crew
  handoff provider is `06-01-05 Railing System` (Railing finishes as Stairs starts; they
  overlapped in the baseline).
- Expected generated resource-dummy link: **`06-01-05 Railing System → 06-01-04 Stairs and Landings`** (and nothing else).
- Expected Resource-Leveled rendered links = the 5 baseline links + that 1 dummy link.

Verification checklist (to be encoded as a test, see §15):
- [ ] Railing / Stairs / Stain and Seal all controlling after leveling (node red).
- [ ] Connector lines do not bypass Stairs (`06-01-05 → 09-01-01` does not visually skip the controlling chain).
- [ ] Rendered links == baseline links + `{06-01-05 → 06-01-04}` exactly.
- [ ] No extra cross-network edges.

(Numeric day counts above are from the user's exports; the recommended fixture test should
assert the structural facts — link set, controlling set, duration equality with the Gantt —
rather than hard-coded calendar dates.)

---

## 13. Invariants / Rules

1. The renderer must not invent schedule links. It receives one validated list per mode.
2. CPM must not use hidden links that are not explainable. **Currently violated** by
   `cpmInputLinks` (date/sibling-generated FS feeding `leveledCpmResult`).
3. Resource-leveled view must not mutate baseline `logicLinks` (currently honored — generated
   links are runtime-only and never persisted into `logicLinks`).
4. Resource-dummy links must come from actual resource-leveling provider records
   (`movedActivities[].resourceProviderActivityCodes`) — currently honored for the rendered set.
5. Date adjacency alone is never enough to create a link.
6. Card position is never enough to create a link.
7. Baseline mode and Resource-Leveled mode must be separate (separate CPM result, separate link set).
8. Gantt, Logic Network, and exports must agree on duration/critical path for the active mode.
   - Gantt vs Logic Network node-critical: agree (both Gantt-derived).
   - Logic Network edge-critical and per-card TF vs Gantt: **at risk** (ride on `leveledCpmResult`).
   - Logic Network Excel export vs on-screen leveled graph: **disagree** (export is baseline-only).
9. Clear Leveling must remove resource-dummy links and leveled schedule data — honored
   (`leveledOffsets={}` + strip `resourceLevelingResults`; analysis returns baseline because
   `levelingApplied` is false).
10. Rerun CPM after logic/duration change should mark leveling stale or require re-leveling.
    Partially honored: CPM invalidation exists (`shouldInvalidateCpmOnEstimateSave`,
    precedence-diagram staleness) but there is **no explicit "leveling is stale" flag** when
    logic/durations change while offsets remain; offsets can become inconsistent with new CPM.

---

## 14. Recommended Minimal Fix (DO NOT IMPLEMENT YET)

Objective: make the Resource-Leveled view fully link-independent for math, so the renderer
consumes exactly one validated list and nothing leveled rides on hidden links.

Exact data source that should feed Resource-Leveled rendered connector lines:
- `preservedLinks` (baseline saved links still valid in the leveled graph)
- **plus** `resourceDummyLinks` derived **only** from
  `assumptions.resourceLevelingResults.movedActivities[].resourceProviderActivityCodes`.

Files / functions to change (small surface):
1. `scheduling/effectiveSchedule.ts`
   - In `getEffectiveScheduleAnalysis`/`buildLeveledLogicNetworkFromGanttSchedule`, compute
     leveled per-activity fields from the **Gantt formula** instead of `leveledCpmResult`:
     - `effectiveTotalFloat = max(0, baselineTotalFloat − leveledOffsetDays)`
     - leveled ES/EF/LS/LF from baseline ± offset and effective float
     - This removes the dependency on `cpmInputLinks` for displayed numbers.
   - **Delete the date/sibling generation block** (`predecessorGroups`/`siblingDecisionLogs`)
     and the `cpmInputLinks` array entirely. `leveledCpmResult` becomes either (a) a synthetic
     result built from Gantt-derived values, or (b) removed in favor of passing
     `leveledCriticalActivityIds` for edge coloring.
   - Make edge red use `leveledCriticalActivityIds` (= `ganttExpectedCriticalCodes`) so edge-red
     == node-red.
2. `ui/components/scheduling/EstimateLogicNetworkCanvas.tsx`
   - Ensure `activeCpmResult` for edge coloring in leveled mode uses a result whose
     `validCriticalPathActivityCodes === leveledCriticalActivityIds` (or color edges from the
     leveled controlling set directly).
3. `ui/EstimateWorkspacePage.tsx`
   - Close the post-Apply timing gap: in `handleApplyResourceLeveling`, after a successful
     save, write the returned assumptions into `currentEstimate` (as the Clear-Leveling path
     already does) so `resourceLeveledDelayRecords` is populated without a reload.
4. (Optional, export agreement) `export/logicNetworkExcelExport.ts` + `LogicNetworkWorkspace.tsx`
   - When exporting in leveled mode, pass `effectiveAnalysis.effectiveLeveledLinks` and label
     generated dummy links in a `link_type` column; keep baseline-only export in baseline mode.

What must NOT be touched:
- `calculateCpm` math, `isDisplayCritical`, continuity validation.
- Resource leveling algorithm (`resourceLevelSchedule`) except it already produces providers.
- `leveledActivityOffsets` semantics, Gantt row/cell math.
- `logicLinks` persistence / baseline mode rendering.

Net effect: leveled numbers, node-critical, edge-critical, and Gantt all derive from
`baseline CPM + offsets` (one source); rendered connectors = baseline + provider dummies (one
validated list). No hidden links remain.

---

## 15. Test Plan (add before the final fix)

1. **Baseline CPM fixture test** — GU26-200 baseline: assert duration, `displayCriticalActivityCodes`, and floats (`06-01-04` TF = 1).
2. **Resource leveling fixture test** — assert `appliedOffsets`, leveled duration, and that `attachResourceProviders` records `06-01-05` as provider for `06-01-04`.
3. **Rendered link-source test** — `getEffectiveScheduleAnalysis` leveled `effectiveLeveledLinks` == baseline links + `{06-01-05 → 06-01-04}`; assert no other generated edges.
4. **No-hidden-CPM-link test** — assert that leveled per-card `effectiveTotalFloat` equals `max(0, baselineTF − offset)` for every activity (i.e., independent of any generated link).
5. **Gantt / Logic Network duration + critical match test** — `effectiveAnalysis.leveledDurationDays === resolveEffectiveSchedule().leveledDurationDays`; leveled node-critical set === Gantt leveled-critical set === edge-critical set.
6. **Export link test** — Logic Network Excel in baseline mode contains only baseline links; in leveled mode contains baseline + clearly labeled dummy links.
7. **Reload persistence test** — after Apply + rehydrate, `resourceLeveledDelayRecords` is non-empty and dummy links render; after Apply *without* reload, also non-empty (timing-gap regression guard).
8. **Clear leveling test** — after Clear, `leveledOffsets === {}`, `resourceLevelingResults` removed, leveled analysis returns baseline (no dummy links).

---

## Command Results

- `npm test` — run after writing this audit; see session output (expected: pass, no behavior change).
- `npm run build` — run after writing this audit; see session output (expected: pass).

This document adds no runtime code paths. The only repository-wide code already present that
relates to dev instrumentation is `validateResourceLeveledRenderedLinks` and the existing
`[Logic Network]` info log, both gated behind `import.meta.env.DEV`.
