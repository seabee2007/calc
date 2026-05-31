import React, { useState } from 'react';
import type { CalendarSubView, ScheduleFilters, ScheduleView } from '../../types/scheduleEvent';
import type { ScheduleConstructionKpis } from '../../utils/scheduleConstructionKpis';
import ScheduleCalendarToolbar from './ScheduleCalendarToolbar';
import ScheduleConstructionKpiBar from './ScheduleConstructionKpiBar';
import ScheduleFiltersDrawer from './ScheduleFiltersDrawer';
import { SCHEDULE_CALENDAR_GRID } from './scheduleTheme';

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  view: ScheduleView;
  cal: CalendarSubView;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCalChange: (cal: CalendarSubView) => void;
  onViewChange: (view: ScheduleView) => void;
  onAddEvent?: () => void;
  isOwner: boolean;
  filters: ScheduleFilters;
  onFiltersChange: (patch: Partial<ScheduleFilters>) => void;
  onApplyPreset: (filters: ScheduleFilters) => void;
  filterProjects: ProjectOption[];
  trades: string[];
  crews: string[];
  assignedUsers: string[];
  lockProjectId?: string;
  userId?: string;
  isMobile: boolean;
  onOpenFiltersMobile: () => void;
  constructionKpis?: ScheduleConstructionKpis;
  children: React.ReactNode;
}

export default function ScheduleCalendarShell({
  view,
  cal,
  rangeLabel,
  onPrev,
  onNext,
  onToday,
  onCalChange,
  onViewChange,
  onAddEvent,
  isOwner,
  filters,
  onFiltersChange,
  onApplyPreset,
  filterProjects,
  trades,
  crews,
  assignedUsers,
  lockProjectId,
  userId,
  isMobile,
  onOpenFiltersMobile,
  constructionKpis,
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpenFilters = () => {
    if (isMobile) onOpenFiltersMobile();
    else setDrawerOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScheduleCalendarToolbar
        view={view}
        cal={cal}
        rangeLabel={rangeLabel}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
        onCalChange={onCalChange}
        onViewChange={onViewChange}
        onOpenFilters={handleOpenFilters}
        onAddEvent={onAddEvent}
        isOwner={isOwner}
        showCalSwitcher={view === 'calendar'}
      />
      {view === 'calendar' && constructionKpis && (
        <ScheduleConstructionKpiBar kpis={constructionKpis} />
      )}
      <div className={`${SCHEDULE_CALENDAR_GRID} min-h-0 flex-1`}>{children}</div>
      {!isMobile && (
        <ScheduleFiltersDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          filters={filters}
          onChange={onFiltersChange}
          onApplyPreset={onApplyPreset}
          projects={filterProjects}
          trades={trades}
          crews={crews}
          assignedUsers={assignedUsers}
          lockProjectId={lockProjectId}
          userId={userId}
        />
      )}
    </div>
  );
}
