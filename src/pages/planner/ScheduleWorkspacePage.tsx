import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerAccessibleProjects } from '../../hooks/usePlannerAccessibleProjects';
import { useProjectStore } from '../../store';
import type {
  CalendarSubView,
  RecurrenceEditScope,
  ScheduleEvent,
  ScheduleFilters,
  ScheduleEventSavePayload,
  ScheduleView,
} from '../../types/scheduleEvent';
import { CALENDAR_SUB_VIEWS, SCHEDULE_VIEWS } from '../../types/scheduleEvent';
import {
  addScheduleEventComment,
  applyScheduleFilters,
  duplicateScheduleEvent,
  enrichEventsWithProjectNames,
  fetchScheduleEventsInDateRange,
  markScheduleEventComplete,
} from '../../services/scheduleEventService';
import {
  deleteRecurringScheduleEvent,
  saveRecurringScheduleEvent,
} from '../../services/scheduleRecurrenceService';
import {
  createTask,
  ensurePlannerBoard,
  fetchPlannerBoardBundle,
} from '../../services/plannerService';
import ScheduleCalendarShell from '../../components/schedule/ScheduleCalendarShell';
import ScheduleFiltersBar from '../../components/schedule/ScheduleFiltersBar';
import ScheduleFilterPresetsControl from '../../components/schedule/ScheduleFilterPresetsControl';
import ScheduleEventFormModal from '../../components/schedule/ScheduleEventFormModal';
import ScheduleRecurrenceEditScopeModal from '../../components/schedule/ScheduleRecurrenceEditScopeModal';
import ScheduleEventDetailPanel from '../../components/schedule/ScheduleEventDetailPanel';
import ScheduleEventDetailDrawer from '../../components/schedule/ScheduleEventDetailDrawer';
import ScheduleListView from '../../components/schedule/views/ScheduleListView';
import ScheduleTimelineView from '../../components/schedule/views/ScheduleTimelineView';
import ScheduleMilestoneView from '../../components/schedule/views/ScheduleMilestoneView';
import ScheduleCalendarMonthView from '../../components/schedule/views/calendar/ScheduleCalendarMonthView';
import ScheduleCalendarWeekView from '../../components/schedule/views/calendar/ScheduleCalendarWeekView';
import ScheduleCalendarDayView from '../../components/schedule/views/calendar/ScheduleCalendarDayView';
import ScheduleCalendarAgendaView from '../../components/schedule/views/calendar/ScheduleCalendarAgendaView';
import Modal from '../../components/ui/Modal';
import { SCHEDULE_PAGE_BG } from '../../components/schedule/scheduleTheme';
import {
  distinctAssignedUsers,
  distinctCrews,
  distinctTrades,
  filterEventsForVisibleRange,
  getCalendarLoadRange,
  getCalendarRangeLabel,
  getDefaultDateRange,
  shiftCalendarAnchor,
  toIsoDate,
} from '../../utils/scheduleEventUtils';
import { buildScheduleConstructionKpis } from '../../utils/scheduleConstructionKpis';
import {
  expandRecurringEventsForRange,
  isRecurringOccurrenceSelection,
  isRecurringSeriesMaster,
} from '../../utils/scheduleRecurrenceUtils';

interface Props {
  lockedProjectId?: string;
}

function defaultCalendarSubView(): CalendarSubView {
  if (typeof window !== 'undefined' && window.innerWidth < 768) return 'agenda';
  return 'week';
}

function parseView(raw: string | null): ScheduleView {
  if (raw === 'weekly') return 'calendar';
  if (raw && SCHEDULE_VIEWS.includes(raw as ScheduleView)) {
    return raw as ScheduleView;
  }
  return 'calendar';
}

function parseCal(raw: string | null): CalendarSubView {
  if (raw && CALENDAR_SUB_VIEWS.includes(raw as CalendarSubView)) {
    return raw as CalendarSubView;
  }
  return defaultCalendarSubView();
}

export default function ScheduleWorkspacePage({ lockedProjectId }: Props) {
  const { user, isOwner } = useAuth();
  const { projects, projectIds, projectNames, loading: projectsLoading } =
    usePlannerAccessibleProjects();
  const { projects: storeProjects } = useProjectStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultRange = getDefaultDateRange();
  const [filters, setFilters] = useState<ScheduleFilters>({
    projectId: lockedProjectId ?? '',
    trade: '',
    crew: '',
    status: '',
    eventType: '',
    priority: '',
    assignedUser: '',
    weatherRisk: '',
    dateFrom: defaultRange.dateFrom,
    dateTo: defaultRange.dateTo,
  });
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [rescheduleOnly, setRescheduleOnly] = useState(false);
  const [pendingSave, setPendingSave] = useState<ScheduleEventSavePayload | null>(null);
  const [recurrenceScopeModal, setRecurrenceScopeModal] = useState<{
    open: boolean;
    mode: 'edit' | 'delete';
  }>({ open: false, mode: 'edit' });
  const [isMobile, setIsMobile] = useState(false);
  const [anchorIso, setAnchorIso] = useState(() => toIsoDate(new Date()));

  const view = parseView(searchParams.get('view'));
  const cal = parseCal(searchParams.get('cal'));
  const selectedId = searchParams.get('event');

  const anchorDate = useMemo(() => new Date(anchorIso + 'T12:00:00'), [anchorIso]);
  const calendarYear = anchorDate.getFullYear();
  const calendarMonth = anchorDate.getMonth();
  const rangeLabel = useMemo(
    () => getCalendarRangeLabel(cal, anchorIso),
    [cal, anchorIso],
  );

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (!searchParams.get('view')) {
      next.set('view', 'calendar');
      changed = true;
    }
    if (searchParams.get('view') === 'weekly') {
      next.set('view', 'calendar');
      changed = true;
    }
    if (!searchParams.get('cal') && next.get('view') === 'calendar') {
      next.set('cal', defaultCalendarSubView());
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const accessibleIds = useMemo(() => {
    if (lockedProjectId) return [lockedProjectId];
    if (filters.projectId) return [filters.projectId];
    return projectIds;
  }, [lockedProjectId, filters.projectId, projectIds]);

  const loadRange = useMemo(
    () =>
      view === 'calendar'
        ? getCalendarLoadRange(cal, anchorIso, filters.dateFrom, filters.dateTo)
        : { dateFrom: filters.dateFrom, dateTo: filters.dateTo },
    [view, cal, anchorIso, filters.dateFrom, filters.dateTo],
  );

  const load = useCallback(async () => {
    if (accessibleIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchScheduleEventsInDateRange(
        accessibleIds,
        loadRange.dateFrom,
        loadRange.dateTo,
      );
      setEvents(enrichEventsWithProjectNames(rows, projectNames));
    } catch (err) {
      console.error('Failed to load schedule events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [accessibleIds, loadRange.dateFrom, loadRange.dateTo, projectNames]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (lockedProjectId) {
      setFilters((f) => ({ ...f, projectId: lockedProjectId }));
    }
  }, [lockedProjectId]);

  const calendarVisibleRange = useMemo(
    () => getCalendarLoadRange(cal, anchorIso, '', ''),
    [cal, anchorIso],
  );

  const filterBase = useMemo(
    () => ({
      projectId: lockedProjectId ? lockedProjectId : filters.projectId,
      trade: filters.trade,
      crew: filters.crew,
      status: filters.status,
      eventType: filters.eventType,
      priority: filters.priority,
      assignedUser: filters.assignedUser,
      weatherRisk: filters.weatherRisk,
    }),
    [filters, lockedProjectId],
  );

  const filteredEvents = useMemo(() => {
    if (view === 'calendar') {
      const withoutDates = applyScheduleFilters(events, filterBase);
      return filterEventsForVisibleRange(
        withoutDates,
        calendarVisibleRange.dateFrom,
        calendarVisibleRange.dateTo,
      );
    }
    return applyScheduleFilters(events, {
      ...filterBase,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
  }, [events, filterBase, view, calendarVisibleRange, filters.dateFrom, filters.dateTo]);

  const displayRange = useMemo(() => {
    if (view === 'calendar') return calendarVisibleRange;
    return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  }, [view, calendarVisibleRange, filters.dateFrom, filters.dateTo]);

  const displayEvents = useMemo(
    () =>
      expandRecurringEventsForRange(
        filteredEvents,
        displayRange.dateFrom,
        displayRange.dateTo,
      ),
    [filteredEvents, displayRange],
  );

  const constructionKpis = useMemo(
    () =>
      buildScheduleConstructionKpis(
        displayEvents,
        calendarVisibleRange.dateFrom,
        calendarVisibleRange.dateTo,
      ),
    [displayEvents, calendarVisibleRange],
  );

  const selectedEvent = useMemo(
    () =>
      displayEvents.find((e) => e.id === selectedId) ??
      filteredEvents.find((e) => e.id === selectedId) ??
      events.find((e) => e.id === selectedId) ??
      null,
    [displayEvents, filteredEvents, events, selectedId],
  );

  const needsRecurrenceScope = useCallback((ev: ScheduleEvent | null) => {
    if (!ev) return false;
    return (
      isRecurringOccurrenceSelection(ev) ||
      isRecurringSeriesMaster(ev) ||
      !!ev.recurrenceSeriesId
    );
  }, []);

  const trades = useMemo(() => distinctTrades(events), [events]);
  const crews = useMemo(() => distinctCrews(events), [events]);
  const assignedUsers = useMemo(() => distinctAssignedUsers(events), [events]);

  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects],
  );

  const milestoneProjects = useMemo(() => {
    if (lockedProjectId) {
      return [{ id: lockedProjectId, name: projectNames.get(lockedProjectId) ?? 'Project' }];
    }
    if (filters.projectId) {
      return [
        { id: filters.projectId, name: projectNames.get(filters.projectId) ?? 'Project' },
      ];
    }
    return projectOptions;
  }, [lockedProjectId, filters.projectId, projectNames, projectOptions]);

  const projectForWeather = useMemo(() => {
    const id = lockedProjectId ?? filters.projectId;
    if (!id) return null;
    return storeProjects.find((p) => p.id === id) ?? null;
  }, [lockedProjectId, filters.projectId, storeProjects]);

  const setView = (v: ScheduleView) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', v);
    if (v === 'calendar') {
      if (!next.get('cal')) next.set('cal', defaultCalendarSubView());
    } else {
      next.delete('cal');
    }
    setSearchParams(next, { replace: true });
  };

  const setCal = (sub: CalendarSubView) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', 'calendar');
    next.set('cal', sub);
    setSearchParams(next, { replace: true });
  };

  const selectEvent = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('event', id);
    if (!next.get('view')) next.set('view', view);
    setSearchParams(next, { replace: true });
  };

  const clearSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    setSearchParams(next, { replace: true });
  };

  const openCreate = () => {
    setEditingEvent(null);
    setRescheduleOnly(false);
    setFormOpen(true);
  };

  const openEdit = () => {
    if (!selectedEvent) return;
    setEditingEvent(selectedEvent);
    setRescheduleOnly(false);
    setFormOpen(true);
  };

  const openReschedule = () => {
    if (!selectedEvent) return;
    setEditingEvent(selectedEvent);
    setRescheduleOnly(true);
    setFormOpen(true);
  };

  const performSave = async (
    input: ScheduleEventSavePayload,
    scope?: RecurrenceEditScope,
  ) => {
    if (!user) return;
    setBusy(true);
    try {
      const saved = await saveRecurringScheduleEvent(input, {
        editingEventId: editingEvent?.id,
        occurrenceDate: input.occurrenceDate,
        scope: scope ?? input.recurrenceEditScope,
        userId: user.id,
      });
      await load();
      setFormOpen(false);
      setEditingEvent(null);
      setPendingSave(null);
      setRecurrenceScopeModal({ open: false, mode: 'edit' });
      if (saved?.id) selectEvent(saved.id);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (input: ScheduleEventSavePayload) => {
    if (!user) return;
    if (editingEvent && needsRecurrenceScope(editingEvent) && !input.recurrenceEditScope) {
      setPendingSave(input);
      setRecurrenceScopeModal({ open: true, mode: 'edit' });
      return;
    }
    await performSave(input);
  };

  const handleRecurrenceScopeConfirm = async (scope: RecurrenceEditScope) => {
    if (recurrenceScopeModal.mode === 'delete') {
      if (!selectedEvent || !user) return;
      setBusy(true);
      try {
        await deleteRecurringScheduleEvent(selectedEvent.id, scope, {
          occurrenceDate: selectedEvent.occurrenceDate ?? undefined,
          userId: user.id,
        });
        clearSelection();
        await load();
      } finally {
        setBusy(false);
        setRecurrenceScopeModal({ open: false, mode: 'delete' });
      }
      return;
    }
    if (pendingSave) {
      await performSave({ ...pendingSave, recurrenceEditScope: scope }, scope);
    }
  };

  const handleComplete = async () => {
    if (!selectedEvent || !user) return;
    setBusy(true);
    try {
      const targetId = selectedEvent.seriesMasterId ?? selectedEvent.id;
      await markScheduleEventComplete(targetId, user.id);
      if (selectedEvent.isRecurringInstance && selectedEvent.occurrenceDate) {
        await saveRecurringScheduleEvent(
          {
            projectId: selectedEvent.projectId,
            createdBy: user.id,
            title: selectedEvent.title,
            eventType: selectedEvent.eventType,
            status: 'completed',
            priority: selectedEvent.priority,
            startDate: selectedEvent.occurrenceDate,
            endDate: selectedEvent.endDate,
            startTime: selectedEvent.startTime,
            endTime: selectedEvent.endTime,
            trade: selectedEvent.trade,
            crew: selectedEvent.crew,
            location: selectedEvent.location,
            notes: selectedEvent.notes,
            assignedTo: selectedEvent.assignedTo,
            relatedDocuments: selectedEvent.relatedDocuments,
            relatedPhotos: selectedEvent.relatedPhotos,
            weatherRisk: selectedEvent.weatherRisk,
            milestoneKey: selectedEvent.milestoneKey,
          },
          {
            editingEventId: selectedEvent.id,
            occurrenceDate: selectedEvent.occurrenceDate,
            scope: 'this',
            userId: user.id,
          },
        );
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!window.confirm('Delete this schedule event?')) return;
    if (needsRecurrenceScope(selectedEvent)) {
      setRecurrenceScopeModal({ open: true, mode: 'delete' });
      return;
    }
    setBusy(true);
    try {
      await deleteRecurringScheduleEvent(selectedEvent.id, 'entire_series', {
        userId: user!.id,
      });
      clearSelection();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedEvent || !user) return;
    setBusy(true);
    try {
      const copy = await duplicateScheduleEvent(selectedEvent.id, user.id);
      selectEvent(copy.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleAddComment = async (body: string) => {
    if (!selectedEvent || !user) return;
    setCommentBusy(true);
    try {
      await addScheduleEventComment(selectedEvent.id, user.id, body);
      await load();
    } finally {
      setCommentBusy(false);
    }
  };

  const handleConvertToTask = async () => {
    if (!selectedEvent || !user || !isOwner) return;
    setBusy(true);
    try {
      const board = await ensurePlannerBoard(selectedEvent.projectId, user.id);
      const bundle = await fetchPlannerBoardBundle(selectedEvent.projectId);
      const bucketId = bundle?.buckets[0]?.id;
      if (!bucketId) throw new Error('No planner bucket available');
      const task = await createTask({
        boardId: board.id,
        bucketId,
        projectId: selectedEvent.projectId,
        title: selectedEvent.title,
        description: selectedEvent.notes ?? undefined,
        assignedTo: selectedEvent.assignedTo[0] ?? null,
        createdBy: user.id,
        dueDate: selectedEvent.startDate,
      });
      await updateScheduleEvent(selectedEvent.id, { taskId: task.id });
      await load();
    } catch (err) {
      console.error('Convert to task failed:', err);
      window.alert('Could not create planner task. Try again from the project planner.');
    } finally {
      setBusy(false);
    }
  };

  const detailProps = {
    event: selectedEvent,
    isOwner: !!isOwner,
    onClose: clearSelection,
    onEdit: openEdit,
    onComplete: handleComplete,
    onReschedule: openReschedule,
    onDelete: handleDelete,
    onDuplicate: isOwner ? handleDuplicate : undefined,
    onConvertToTask: isOwner ? handleConvertToTask : undefined,
    onAddComment: isOwner ? handleAddComment : undefined,
    busy,
    commentBusy,
  };

  const renderCalendarContent = () => {
    if (loading || projectsLoading) {
      return (
        <div className="flex flex-1 items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#2563EB]" />
        </div>
      );
    }

    const viewProps = {
      events: displayEvents,
      selectedId,
      onSelect: selectEvent,
    };

    switch (cal) {
      case 'month':
        return (
          <ScheduleCalendarMonthView
            {...viewProps}
            year={calendarYear}
            month={calendarMonth}
          />
        );
      case 'day':
        return (
          <ScheduleCalendarDayView
            {...viewProps}
            anchorIso={anchorIso}
            projectForWeather={projectForWeather}
          />
        );
      case 'agenda':
        return (
          <ScheduleCalendarAgendaView
            {...viewProps}
            todayIso={toIsoDate(new Date())}
          />
        );
      case 'work_week':
        return (
          <ScheduleCalendarWeekView
            {...viewProps}
            anchorIso={anchorIso}
            mode="work_week"
          />
        );
      case 'week':
      default:
        return (
          <ScheduleCalendarWeekView {...viewProps} anchorIso={anchorIso} mode="week" />
        );
    }
  };

  const renderOverflowContent = () => {
    if (loading || projectsLoading) {
      return (
        <div className="flex flex-1 items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#2563EB]" />
        </div>
      );
    }

    const viewProps = {
      events: displayEvents,
      selectedId,
      onSelect: selectEvent,
    };

    switch (view) {
      case 'timeline':
        return (
          <ScheduleTimelineView
            {...viewProps}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
          />
        );
      case 'milestone':
        return (
          <ScheduleMilestoneView
            events={filteredEvents}
            projects={milestoneProjects}
            selectedId={selectedId}
            onSelect={selectEvent}
          />
        );
      case 'list':
        return <ScheduleListView {...viewProps} />;
      default:
        return null;
    }
  };

  return (
    <div className={`${SCHEDULE_PAGE_BG} flex min-h-0 flex-1 flex-col`}>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ScheduleCalendarShell
            view={view}
            cal={cal}
            rangeLabel={rangeLabel}
            onPrev={() => setAnchorIso((a) => shiftCalendarAnchor(cal, a, -1))}
            onNext={() => setAnchorIso((a) => shiftCalendarAnchor(cal, a, 1))}
            onToday={() => setAnchorIso(toIsoDate(new Date()))}
            onCalChange={setCal}
            onViewChange={setView}
            onAddEvent={isOwner ? openCreate : undefined}
            isOwner={!!isOwner}
            filters={filters}
            onFiltersChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onApplyPreset={(f) => setFilters(f)}
            filterProjects={projectOptions}
            trades={trades}
            crews={crews}
            assignedUsers={assignedUsers}
            lockProjectId={lockedProjectId}
            userId={user?.id}
            isMobile={isMobile}
            onOpenFiltersMobile={() => setFilterSheetOpen(true)}
            constructionKpis={view === 'calendar' ? constructionKpis : undefined}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1 sm:p-2">
              {view === 'calendar' ? renderCalendarContent() : renderOverflowContent()}
            </div>
          </ScheduleCalendarShell>
        </div>

        {!isMobile && (
          <ScheduleEventDetailPanel {...detailProps} open={!!selectedEvent} />
        )}
      </div>

      {isMobile && selectedEvent && (
        <ScheduleEventDetailDrawer {...detailProps} />
      )}

      {user && (
        <ScheduleEventFormModal
          isOpen={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingEvent(null);
          }}
          onSave={handleSave}
          projects={projectOptions}
          defaultProjectId={lockedProjectId ?? filters.projectId}
          event={editingEvent}
          focusDatesOnly={rescheduleOnly}
          userId={user.id}
        />
      )}

      <ScheduleRecurrenceEditScopeModal
        isOpen={recurrenceScopeModal.open}
        mode={recurrenceScopeModal.mode}
        onClose={() => {
          setRecurrenceScopeModal({ open: false, mode: 'edit' });
          setPendingSave(null);
        }}
        onConfirm={(scope) => void handleRecurrenceScopeConfirm(scope)}
      />

      <Modal
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filters"
        size="md"
      >
        <ScheduleFiltersBar
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          projects={projectOptions}
          trades={trades}
          crews={crews}
          assignedUsers={assignedUsers}
          lockProjectId={lockedProjectId}
        />
        {user && (
          <ScheduleFilterPresetsControl
            userId={user.id}
            filters={filters}
            onApply={(f) => setFilters(f)}
          />
        )}
      </Modal>
    </div>
  );
}
