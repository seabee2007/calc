import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlannerSidebar from '../PlannerSidebar';
import {
  EstimateWorkspaceSidebarNavProvider,
  useRegisterEstimateWorkspaceSidebarNav,
} from '../../../features/estimating/ui/EstimateWorkspaceSidebarNavContext';
import { useEffect } from 'react';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    isOwner: true,
    isEmployee: false,
  }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [] })),
        })),
      })),
    })),
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

describe('PlannerSidebar documents navigation', () => {
  function renderSidebar(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/projects/:projectId/planner/*"
            element={<PlannerSidebar mobileOpen={false} onMobileClose={() => undefined} />}
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('shows document section links in the main sidebar on the Documents route', () => {
    renderSidebar('/projects/project-1/planner/documents?tab=contracts');

    expect(screen.getByTestId('planner-documents-sidebar-nav')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contracts' })).toHaveAttribute(
      'href',
      '/projects/project-1/planner/documents?tab=contracts',
    );
    expect(screen.getByRole('link', { name: 'QC Reports' })).toHaveAttribute(
      'href',
      '/projects/project-1/planner/documents?tab=qc-reports',
    );
  });

  it('hides document section links outside the Documents route', () => {
    renderSidebar('/projects/project-1/planner/board');

    expect(screen.queryByTestId('planner-documents-sidebar-nav')).not.toBeInTheDocument();
  });
});

function EstimateSidebarTabsStub({
  tabs,
}: {
  tabs: Array<{ id: string; label: string }>;
}) {
  const setTabs = useRegisterEstimateWorkspaceSidebarNav();
  useEffect(() => {
    setTabs(tabs);
    return () => setTabs([]);
  }, [setTabs, tabs]);
  return null;
}

describe('PlannerSidebar estimate navigation', () => {
  const detailedEstimateTabs = [
    { id: 'activities', label: 'Activities' },
    { id: '3d-takeoff', label: '3D Takeoff' },
    { id: 'design-builder', label: 'Design Builder' },
    { id: 'schedule-preview', label: 'Schedule Preview' },
    { id: 'overview', label: 'Costs & Markup' },
  ];

  function renderEstimateSidebar(path: string) {
    return render(
      <EstimateWorkspaceSidebarNavProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/projects/:projectId/planner/*"
              element={
                <>
                  <EstimateSidebarTabsStub tabs={detailedEstimateTabs} />
                  <PlannerSidebar mobileOpen={false} onMobileClose={() => undefined} />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </EstimateWorkspaceSidebarNavProvider>,
    );
  }

  it('shows estimate section links in the main sidebar on the Estimate route', () => {
    renderEstimateSidebar('/projects/project-1/planner/estimate');

    expect(screen.getByTestId('planner-estimate-sidebar-nav')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Activities' })).toHaveAttribute(
      'href',
      '/projects/project-1/planner/estimate',
    );
    expect(screen.getByRole('link', { name: '3D Takeoff' })).toHaveAttribute(
      'href',
      '/projects/project-1/planner/estimate/3d-takeoff',
    );
    expect(screen.getByRole('link', { name: 'Costs & Markup' })).toHaveAttribute(
      'href',
      '/projects/project-1/planner/estimate/overview',
    );
  });

  it('hides estimate section links outside the Estimate route', () => {
    render(
      <EstimateWorkspaceSidebarNavProvider>
        <MemoryRouter initialEntries={['/projects/project-1/planner/board']}>
          <Routes>
            <Route
              path="/projects/:projectId/planner/*"
              element={<PlannerSidebar mobileOpen={false} onMobileClose={() => undefined} />}
            />
          </Routes>
        </MemoryRouter>
      </EstimateWorkspaceSidebarNavProvider>,
    );

    expect(screen.queryByTestId('planner-estimate-sidebar-nav')).not.toBeInTheDocument();
  });
});
