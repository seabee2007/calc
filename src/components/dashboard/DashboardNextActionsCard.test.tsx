import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardNextActionsCard from './DashboardNextActionsCard';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

describe('DashboardNextActionsCard', () => {
  it('renders an empty state (never null) when there are no actions', () => {
    render(
      <MemoryRouter>
        <DashboardNextActionsCard proposals={[]} extraActions={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Next actions')).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('renders extra actions when provided', () => {
    render(
      <MemoryRouter>
        <DashboardNextActionsCard
          proposals={[]}
          extraActions={[
            { id: 'a1', title: 'Review overdue QC tests', detail: '2 tests overdue', onClick: vi.fn() },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Review overdue QC tests')).toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });
});
