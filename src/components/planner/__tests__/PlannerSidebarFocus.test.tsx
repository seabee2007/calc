import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import PlannerSidebar from '../PlannerSidebar';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isOwner: false,
    isEmployee: false,
  }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('PlannerSidebar workspace focus', () => {
  it('collapses the desktop sidebar without changing mobile navigation state', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/projects/project-1/planner/estimate/3d-takeoff']}>
        <PlannerSidebar
          mobileOpen={false}
          onMobileClose={() => undefined}
          collapsedForWorkspaceFocus
        />
      </MemoryRouter>,
    );

    const desktopSidebar = container.querySelector('aside[aria-hidden="true"]');
    expect(desktopSidebar).toHaveClass('w-0');
    expect(desktopSidebar).toHaveClass('pointer-events-none');
  });

  it('renders the normal desktop sidebar when workspace focus is off', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/projects/project-1/planner/estimate/activities']}>
        <PlannerSidebar mobileOpen={false} onMobileClose={() => undefined} />
      </MemoryRouter>,
    );

    const desktopSidebar = container.querySelector('aside[aria-hidden="false"]');
    expect(desktopSidebar).toHaveClass('w-[220px]');
    expect(desktopSidebar).toHaveClass('opacity-100');
  });
});
