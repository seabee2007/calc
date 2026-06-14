import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AccountingTaxPage from '../AccountingTaxPage';
import type { SavedProposal } from '../../lib/proposalService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const trackedProposalsState = vi.hoisted(() => ({
  proposals: [] as SavedProposal[],
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
}));

vi.mock('../../hooks/useTrackedProposals', () => ({
  useTrackedProposals: () => trackedProposalsState,
}));

vi.mock('../../store', () => ({
  useProjectStore: () => ({
    projects: [],
    loadProjects: vi.fn().mockResolvedValue(undefined),
  }),
  useSettingsStore: () => ({
    companySettings: { companyName: 'Test Construction LLC' },
  }),
}));

vi.mock('../../services/changeOrderService', () => ({
  fetchChangeOrdersForProjectIds: vi.fn().mockResolvedValue([]),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountingTaxPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountingTaxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trackedProposalsState.proposals = [];
    trackedProposalsState.loading = false;
  });

  it('renders the page with test id', () => {
    renderPage();
    expect(screen.getByTestId('accounting-tax-page')).toBeInTheDocument();
  });

  it('renders the page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Accounting.*Tax/i })).toBeInTheDocument();
  });

  it('renders the not-tax-advice disclaimer unconditionally', () => {
    renderPage();
    expect(screen.getByTestId('tax-disclaimer')).toBeInTheDocument();
    expect(screen.getByTestId('tax-disclaimer').textContent).toContain('not tax advice');
  });

  it('renders the Schedule C style label (not just "Schedule C")', () => {
    renderPage();
    expect(screen.getAllByText(/Schedule C style/i).length).toBeGreaterThan(0);
  });

  it('does NOT render entity-type warning when Sole Proprietor is selected', () => {
    renderPage();
    expect(screen.queryByTestId('entity-type-warning')).not.toBeInTheDocument();
  });

  it('renders entity-type warning when LLC is selected', async () => {
    const user = userEvent.setup();
    renderPage();
    const entitySelect = screen.getByTestId('entity-type-selector');
    await user.selectOptions(entitySelect, 'llc');
    expect(await screen.findByTestId('entity-type-warning')).toBeInTheDocument();
    expect(screen.getByTestId('entity-type-warning').textContent).toContain(
      'may not apply to every entity type',
    );
  });

  it('renders entity-type warning when S-Corp is selected', async () => {
    const user = userEvent.setup();
    renderPage();
    const entitySelect = screen.getByTestId('entity-type-selector');
    await user.selectOptions(entitySelect, 's_corp');
    expect(await screen.findByTestId('entity-type-warning')).toBeInTheDocument();
  });

  it('shows cash-method note when cash accounting method is selected', async () => {
    const user = userEvent.setup();
    renderPage();
    const methodSelect = screen.getByTestId('accounting-method-selector');
    await user.selectOptions(methodSelect, 'cash');
    expect(await screen.findByTestId('cash-method-note')).toBeInTheDocument();
    expect(screen.getByTestId('cash-method-note').textContent).toContain(
      'paid_at / deposit_paid_at',
    );
  });

  it('does NOT show cash-method note when accrual is selected', () => {
    renderPage();
    expect(screen.queryByTestId('cash-method-note')).not.toBeInTheDocument();
  });

  it('renders Tax Prep Helper card with "later phase" note', () => {
    renderPage();
    expect(screen.getByTestId('tax-prep-card')).toBeInTheDocument();
    expect(screen.getByTestId('tax-prep-note').textContent).toContain('later phase');
  });

  it('does NOT claim direct import', () => {
    renderPage();
    const note = screen.getByTestId('tax-prep-note').textContent ?? '';
    expect(note).not.toMatch(/direct.*import.*works/i);
    expect(note).not.toMatch(/guaranteed/i);
  });

  it('renders QuickBooks card with "later phase" sync note', () => {
    renderPage();
    expect(screen.getByTestId('quickbooks-card')).toBeInTheDocument();
    const cardText = screen.getByTestId('quickbooks-card').textContent ?? '';
    expect(cardText.toLowerCase()).toContain('later phase');
  });

  it('renders Job Cost Summary button, not "Expenses" button', () => {
    renderPage();
    expect(screen.getByTestId('download-job-cost-summary')).toBeInTheDocument();
    const qbCard = screen.getByTestId('quickbooks-card').textContent ?? '';
    expect(qbCard).not.toMatch(/^Expenses CSV$/m);
  });

  it('renders job cost summary helper text noting it is not a vendor expense ledger', () => {
    renderPage();
    const qbCard = screen.getByTestId('quickbooks-card').textContent ?? '';
    expect(qbCard.toLowerCase()).toContain('not a full vendor expense ledger');
  });

  it('renders tax year selector', () => {
    renderPage();
    expect(screen.getByTestId('tax-year-selector')).toBeInTheDocument();
  });

  it('renders the settings card', () => {
    renderPage();
    expect(screen.getByTestId('accounting-settings-card')).toBeInTheDocument();
  });

  it('renders tax package card with CPA Workbook button', () => {
    renderPage();
    expect(screen.getByTestId('tax-package-card')).toBeInTheDocument();
    expect(screen.getByTestId('download-cpa-workbook')).toBeInTheDocument();
  });

  it('renders tax category mapping card', () => {
    renderPage();
    expect(screen.getByTestId('tax-category-card')).toBeInTheDocument();
    expect(screen.getByTestId('tax-category-mapping')).toBeInTheDocument();
  });
});
