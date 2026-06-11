import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PlannerHubPage from './PlannerHubPage';

const mockNavigate = vi.hoisted(() => vi.fn());
const supabaseFromMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: { id: 'owner-1' },
  isOwner: true,
  isEmployee: false,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../services/employeeService', () => ({
  fetchAssignedProjects: vi.fn(),
}));

vi.mock('../../utils/projectWorkflow', () => ({
  resolveProjectWorkflow: vi.fn(() => ({
    stage: 'in_progress',
    stageLabel: 'In Progress',
    nextAction: { label: 'Review tasks', path: '/projects/x/planner/board' },
  })),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

function mockProjectsQuery(
  rows: Array<{ id: string; name: string; pour_date?: string | null; placement_order?: null }>,
  error: { message: string } | null = null,
) {
  supabaseFromMock.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: rows, error }),
      }),
    }),
  });
}

describe('PlannerHubPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    sessionStorage.clear();
  });

  it('renders the page title and subtitle', async () => {
    mockProjectsQuery([]);
    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Planner Hub' })).toBeInTheDocument();
    expect(
      screen.getByText(/Open a project plan board to manage field tasks, assignments, and field updates/i),
    ).toBeInTheDocument();

    expect(await screen.findByText('No project plans yet')).toBeInTheDocument();
  });

  it('uses standard page gutter on the header so it aligns with cards', () => {
    mockProjectsQuery([]);
    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    const header = screen.getByRole('heading', { name: 'Planner Hub' }).closest('header');
    expect(header?.className).toContain('px-4');
    expect(header?.className).toContain('sm:px-6');
    expect(header?.className).toContain('lg:px-8');
  });

  it('renders loading skeleton cards', () => {
    mockProjectsQuery([]);
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn(() => new Promise(() => {})),
        }),
      }),
    });

    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByTestId('planner-hub-card-skeleton').length).toBeGreaterThan(0);
  });

  it('renders project cards for loaded projects', async () => {
    mockProjectsQuery([
      { id: 'proj-1', name: 'GA26-200 Single-Story House Construction' },
      { id: 'proj-2', name: 'GU26-201 Single-Story Residential House with extended title' },
    ]);

    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('planner-hub-project-proj-1')).toBeInTheDocument();
    expect(
      screen.getByText('GA26-200 Single-Story House Construction'),
    ).toBeInTheDocument();
    expect(screen.getByText('Active plans')).toBeInTheDocument();
  });

  it('truncates long project names cleanly', async () => {
    mockProjectsQuery([
      {
        id: 'proj-long',
        name: 'GU26-201 Single-Story Residential House with a very long project name that should truncate',
      },
    ]);

    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId('planner-hub-project-proj-long');
    const title = card.querySelector('h2');
    expect(title?.textContent).toContain('GU26-201 Single-Story Residential House');
    expect(title?.className).toContain('truncate');
  });

  it('navigates to the planner board when a card is clicked', async () => {
    mockProjectsQuery([{ id: 'proj-1', name: 'Riverfront Slab' }]);

    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    const link = await screen.findByRole('link', { name: /Open plan for Riverfront Slab/i });
    fireEvent.click(link);

    expect(link).toHaveAttribute('href', '/projects/proj-1/planner/board');
  });

  it('renders empty state when there are zero projects', async () => {
    mockProjectsQuery([]);

    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No project plans yet')).toBeInTheDocument();
    expect(
      screen.getByText('Create a project plan to start managing field tasks.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Project Plan' })).toBeInTheDocument();
  });

  it('renders error state with retry', async () => {
    mockProjectsQuery([], { message: 'network down' });

    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Could not load project plans.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not crash when there are zero projects', async () => {
    mockProjectsQuery([]);

    expect(() =>
      render(
        <MemoryRouter>
          <PlannerHubPage />
        </MemoryRouter>,
      ),
    ).not.toThrow();

    await waitFor(() => {
      expect(screen.queryByTestId(/planner-hub-project-/)).not.toBeInTheDocument();
    });
  });

  it('opens new project plan from empty state action', async () => {
    const user = userEvent.setup();
    mockProjectsQuery([]);

    render(
      <MemoryRouter>
        <PlannerHubPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'New Project Plan' }));
    expect(mockNavigate).toHaveBeenCalledWith('/projects', { state: { openCreate: true } });
  });
});
