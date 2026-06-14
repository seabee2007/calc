import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FieldToolPageLayout, { type FieldToolPlannerReturn } from '../FieldToolPageLayout';
import { FileText } from 'lucide-react';

const mockSetCurrentProject = vi.fn();

vi.mock('../../../store', () => ({
  useProjectStore: () => ({
    projects: [
      {
        id: 'p1',
        name: 'Garage Project',
        jobsiteAddress: { street: '1 Main St', city: 'Austin', state: 'TX', zip: '78701' },
      },
    ],
    currentProject: {
      id: 'p1',
      name: 'Garage Project',
      jobsiteAddress: { street: '1 Main St', city: 'Austin', state: 'TX', zip: '78701' },
    },
    setCurrentProject: mockSetCurrentProject,
  }),
}));

function renderLayout(plannerReturn?: FieldToolPlannerReturn) {
  return render(
    <MemoryRouter>
      <FieldToolPageLayout
        title="Document Builder"
        subtitle="Create documents"
        icon={FileText}
        actions={null}
        plannerReturn={plannerReturn}
      >
        <div>Body</div>
      </FieldToolPageLayout>
    </MemoryRouter>,
  );
}

describe('FieldToolPageLayout project selector', () => {
  beforeEach(() => {
    mockSetCurrentProject.mockClear();
  });

  it('shows a single save-location message for Document Builder', () => {
    renderLayout();

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(
      screen.getByText('Saved documents appear under Planner → Documents.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/saved to Planner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Saves appear under/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Jobsite:/)).toBeInTheDocument();
  });

  it('omits save-location helper when returning from a planner documents tab', () => {
    renderLayout({ tab: 'contracts', label: 'Contracts' });

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(
      screen.queryByText('Saved documents appear under Planner → Documents.'),
    ).not.toBeInTheDocument();
  });
});
