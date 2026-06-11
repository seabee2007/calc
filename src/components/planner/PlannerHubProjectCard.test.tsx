import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlannerHubProjectCard from './PlannerHubProjectCard';

describe('PlannerHubProjectCard', () => {
  it('uses accessible link behavior for opening the planner board', () => {
    const onOpen = vi.fn();
    render(
      <MemoryRouter>
        <PlannerHubProjectCard
          project={{
            id: 'proj-1',
            name: 'Test Project',
            statusLabel: 'In Progress',
            nextActionLabel: 'Review tasks',
          }}
          onOpen={onOpen}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Open plan for Test Project/i });
    expect(link).toHaveAttribute('href', '/projects/proj-1/planner/board');
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledWith('proj-1');
    expect(screen.getByText('Open plan')).toBeInTheDocument();
  });
});
