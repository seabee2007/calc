import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScheduleOperationsSection from './ScheduleOperationsSection';
import type { ScheduleDashboardSnapshot } from '../../../utils/scheduleDashboard';
import type { ScheduleEvent } from '../../../types/scheduleEvent';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderSection(
  props: Partial<React.ComponentProps<typeof ScheduleOperationsSection>> = {},
) {
  return render(
    <MemoryRouter>
      <ScheduleOperationsSection snapshot={null} {...props} />
    </MemoryRouter>,
  );
}

const sampleEvent: ScheduleEvent = {
  id: 'evt-1',
  projectId: 'proj-1',
  title: 'Pour inspection',
  eventType: 'inspection',
  startDate: '2026-06-17',
  status: 'scheduled',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

const sampleSnapshot: ScheduleDashboardSnapshot = {
  todayEvents: [sampleEvent],
  upcomingDeadlines: [{ ...sampleEvent, id: 'dl-1', eventType: 'bid_due_date', title: 'Bid due' }],
  upcomingDeliveries: [],
  upcomingInspections: [],
  activeCrews: [],
  weatherDelayCount: 0,
  upcomingMilestones: [],
  recentChanges: [],
};

describe('ScheduleOperationsSection', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renders both panels with empty states when snapshot is null', () => {
    renderSection();

    expect(screen.getByText('Schedule & Deadlines')).toBeInTheDocument();
    expect(screen.getByText('Today on schedule')).toBeInTheDocument();
    expect(screen.getByText('No events scheduled for today.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open calendar' })).toBeInTheDocument();

    expect(screen.getByText('Upcoming deadlines')).toBeInTheDocument();
    expect(screen.getByText('No deadlines in the next two weeks.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View schedule' })).toBeInTheDocument();
  });

  it('shows counts and preview rows when snapshot has data', () => {
    renderSection({ snapshot: sampleSnapshot });

    expect(screen.getByText('Pour inspection')).toBeInTheDocument();
    expect(screen.getByText(/Bid due/)).toBeInTheDocument();
  });

  it('navigates to calendar and schedule views from action buttons', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/planner/schedule'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'View schedule' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/planner/schedule'),
    );
  });

  it('stacks panels vertically when stackPanels is true', () => {
    renderSection({ stackPanels: true });
    const panels = screen.getByTestId('schedule-operations-panels');
    expect(panels.className).not.toContain('sm:grid-cols-2');
  });

  it('uses side-by-side layout at sm+ when stackPanels is false', () => {
    renderSection({ stackPanels: false });
    const panels = screen.getByTestId('schedule-operations-panels');
    expect(panels.className).toContain('sm:grid-cols-2');
  });
});
