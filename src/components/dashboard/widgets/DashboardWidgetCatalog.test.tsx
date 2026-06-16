import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DashboardWidgetCatalog from './DashboardWidgetCatalog';
import type { DashboardCardId } from '../../../lib/dashboardLayout';
import { canUseFeature, type FeatureKey, type PlanId } from '../../../lib/entitlements';

// Render the modal inline so we can assert on its body without portals/animation.
vi.mock('../../ui/ModalShell', () => ({
  default: ({ isOpen, children, title }: { isOpen: boolean; children: React.ReactNode; title: string }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

function hasFeatureForPlan(plan: PlanId) {
  return (feature: FeatureKey) => canUseFeature(plan, feature);
}

function renderCatalog(
  overrides: Partial<React.ComponentProps<typeof DashboardWidgetCatalog>> = {},
) {
  const plan = overrides.plan ?? 'business';
  const onAdd = vi.fn();
  const props: React.ComponentProps<typeof DashboardWidgetCatalog> = {
    isOpen: true,
    onClose: vi.fn(),
    plan,
    isOwner: true,
    hasFeature: hasFeatureForPlan(plan),
    activeIds: new Set<DashboardCardId>(),
    onAdd,
    ...overrides,
  };
  render(<DashboardWidgetCatalog {...props} />);
  return { onAdd };
}

describe('DashboardWidgetCatalog', () => {
  it('lists available widgets with an Add action', () => {
    renderCatalog();
    const tile = screen.getByTestId('widget-tile-quickActions');
    expect(within(tile).getByText('Quick Actions')).toBeInTheDocument();
    expect(within(tile).getByRole('button', { name: /Add Quick Actions/i })).toBeEnabled();
  });

  it('lists Phase 5A tool and shortcut widgets', () => {
    renderCatalog();
    expect(screen.getByTestId('widget-tile-ardenCalc')).toBeInTheDocument();
    expect(within(screen.getByTestId('widget-tile-ardenCalc')).getByText('Arden Calc')).toBeInTheDocument();
    expect(screen.getByTestId('widget-tile-quickEstimateLauncher')).toBeInTheDocument();
    expect(within(screen.getByTestId('widget-tile-quickEstimateLauncher')).getByText('Quick Estimate')).toBeInTheDocument();
    expect(screen.getByTestId('widget-tile-newProjectShortcut')).toBeInTheDocument();
    expect(within(screen.getByTestId('widget-tile-newProjectShortcut')).getByText('New Project')).toBeInTheDocument();
    expect(screen.getByTestId('widget-tile-accountingTaxLauncher')).toBeInTheDocument();
    expect(within(screen.getByTestId('widget-tile-accountingTaxLauncher')).getByText('Accounting & Tax')).toBeInTheDocument();
  });

  it('marks already-added widgets as Added and disables them', () => {
    renderCatalog({ activeIds: new Set<DashboardCardId>(['businessSnapshot']) });
    const tile = screen.getByTestId('widget-tile-businessSnapshot');
    const button = within(tile).getByRole('button', { name: /Added Business Snapshot/i });
    expect(button).toBeDisabled();
  });

  it('locks widgets above the user plan and prevents adding them', () => {
    const { onAdd } = renderCatalog({ plan: 'free' });
    const tile = screen.getByTestId('widget-tile-qcDue');
    const button = within(tile).getByRole('button', { name: /Upgrade required QC Due/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('locks Accounting & Tax for free users', () => {
    const { onAdd } = renderCatalog({ plan: 'free' });
    const tile = screen.getByTestId('widget-tile-accountingTaxLauncher');
    const button = within(tile).getByRole('button', { name: /Upgrade required Accounting & Tax/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('allows business users to add Accounting & Tax Launcher', () => {
    const { onAdd } = renderCatalog({ plan: 'business' });
    const tile = screen.getByTestId('widget-tile-accountingTaxLauncher');
    fireEvent.click(within(tile).getByRole('button', { name: /Add Accounting & Tax/i }));
    expect(onAdd).toHaveBeenCalledWith('accountingTaxLauncher');
  });

  it('adds an available widget when its Add button is clicked', () => {
    const { onAdd } = renderCatalog();
    const tile = screen.getByTestId('widget-tile-quickActions');
    fireEvent.click(within(tile).getByRole('button', { name: /Add Quick Actions/i }));
    expect(onAdd).toHaveBeenCalledWith('quickActions');
  });

  it('filters widgets by search query', () => {
    renderCatalog();
    fireEvent.change(screen.getByLabelText('Search widgets'), {
      target: { value: 'follow-up' },
    });
    expect(screen.getByTestId('widget-tile-proposalsFollowUp')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-tile-quickActions')).not.toBeInTheDocument();
  });

  it('finds Arden Calc via search', () => {
    renderCatalog();
    fireEvent.change(screen.getByLabelText('Search widgets'), {
      target: { value: 'arden calc' },
    });
    expect(screen.getByTestId('widget-tile-ardenCalc')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-tile-quickActions')).not.toBeInTheDocument();
  });

  it('filters widgets by category', () => {
    renderCatalog();
    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));
    expect(screen.getByTestId('widget-tile-ardenCalc')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-tile-quickActions')).not.toBeInTheDocument();
  });

  it('hides owner-only widgets from non-owners', () => {
    renderCatalog({ isOwner: false });
    expect(screen.queryByTestId('widget-tile-qcDue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('widget-tile-accountingTaxLauncher')).not.toBeInTheDocument();
  });
});
