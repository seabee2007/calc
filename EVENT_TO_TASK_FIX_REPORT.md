# Event To Task Fix Report

## Root Cause

Runtime logs confirmed the conversion created planner tasks successfully, then failed while linking the task back to the schedule event:

- `planner task created` was logged with a valid task id.
- The next step failed with `ReferenceError: updateScheduleEvent is not defined`.

The handler in `ScheduleWorkspacePage.tsx` called `updateScheduleEvent(...)` but did not import it from `scheduleEventService.ts`.

## Files Changed

- `src/pages/planner/ScheduleWorkspacePage.tsx`
- `EVENT_TO_TASK_FIX_REPORT.md`

## Required Fields For Planner Task Creation

The conversion uses the existing `createTask` service with:

- `boardId`
- `bucketId`
- `projectId`
- `title`
- `createdBy`
- Optional `description`
- Optional `assignedTo`
- Optional `dueDate`

The task payload maps from the schedule event:

- title: `event.title`
- description: `event.notes`
- due date: `event.occurrenceDate ?? event.startDate`
- assigned user: first `event.assignedTo` value, when present

## Project ID Resolution

The conversion now resolves project id from:

1. `selectedEvent.projectId`
2. `lockedProjectId`
3. active project filter (`filters.projectId`)

If no project id is available, insertion is skipped and the user sees:

`This event is not linked to a project. Select a project before creating a planner task.`

## Error Messages Improved

- Missing project: `This event is not linked to a project. Select a project before creating a planner task.`
- Already linked: `This event is already linked to a task.`
- Permission/RLS: `You do not have permission to create tasks for this project.`
- Validation/missing required details: `Task could not be created because required event details are missing.`
- Unknown: `Could not create planner task. Please try again.`

The real error is still logged in development/console via:

`console.error('Create task from event failed', err)`

## Mobile And Desktop Confirmation

The mobile drawer and desktop detail panel both use the same `handleConvertToTask` callback from `ScheduleWorkspacePage.tsx`, so the import fix and improved handling apply to both paths.

No Supabase schema, calendar layout, schedule data model, swipe behavior, or event creation logic was changed.

## Instrumentation Cleanup

Temporary HTTP debug instrumentation was removed after verification. A repository search found no remaining debug endpoint/session references.

## Validation

- Targeted lints for `ScheduleWorkspacePage.tsx`: clean.
- `npm run build`: passed.
