import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="No projects"
        description="Create your first project to get started."
      />,
    );
    expect(screen.getByText('No projects')).toBeInTheDocument();
    expect(screen.getByText('Create your first project to get started.')).toBeInTheDocument();
  });

  it('calls action handler when button clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Start Project', onClick }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start Project' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
