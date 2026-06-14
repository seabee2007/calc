import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectCard from './ProjectCard';
import type { TrackedProposalRow } from '../../types/proposalTracking';

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) =>
        function MotionStub({
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) {
          return React.createElement(String(tag), props, children);
        },
    },
  ),
}));

vi.mock('../../services/hapticService', () => ({
  hapticService: { selection: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/soundService', () => ({
  soundService: { play: vi.fn() },
}));

const trackedProposalsState = vi.hoisted(() => ({
  proposals: [] as TrackedProposalRow[],
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
}));

vi.mock('../../hooks/useTrackedProposals', () => ({
  useTrackedProposals: () => trackedProposalsState,
}));

const baseProject = {
  id: 'proj-1',
  name: 'Office Buildout',
  description: 'Interior remodel',
  createdAt: '2026-06-14T12:00:00.000Z',
  updatedAt: '2026-06-14T12:00:00.000Z',
  calculations: [],
};

describe('ProjectCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trackedProposalsState.proposals = [];
  });

  it('renders PM command layout with metric lines and workflow readiness', () => {
    render(
      <ProjectCard
        project={baseProject}
        folder="active"
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Office Buildout')).toBeInTheDocument();
    expect(screen.getByText('Next action')).toBeInTheDocument();
    expect(screen.getByText('Workflow readiness')).toBeInTheDocument();
    expect(screen.getByText('Estimate: Not started')).toBeInTheDocument();
    expect(screen.getByText('Schedule: Not started')).toBeInTheDocument();
    expect(screen.getByText('Financial: No proposal')).toBeInTheDocument();
    expect(screen.getByText(/Open items:/)).toBeInTheDocument();
    expect(screen.getByText('Tasks 0 · RFIs 0 · Docs 0')).toBeInTheDocument();
    expect(screen.queryByText(/CY/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PSI/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Placement order/i)).not.toBeInTheDocument();
  });

  it('opens whole card on click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ProjectCard
        project={baseProject}
        folder="active"
        onClick={onClick}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('project-card-proj-1'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('deletes from overflow menu without opening the card', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onDelete = vi.fn();

    render(
      <ProjectCard
        project={baseProject}
        folder="active"
        onClick={onClick}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Project actions' }));
    await user.click(screen.getByRole('menuitem', { name: /Delete project/i }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('wraps long project titles instead of overflowing the card', () => {
    render(
      <ProjectCard
        project={{
          ...baseProject,
          name: 'GU26-200 Detached Garage and Workshop Addition With Extended Driveway',
        }}
        folder="active"
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const title = screen.getByText(
      'GU26-200 Detached Garage and Workshop Addition With Extended Driveway',
    );
    expect(title.className).toContain('line-clamp-2');
    expect(title.className).toContain('break-words');
  });
});
