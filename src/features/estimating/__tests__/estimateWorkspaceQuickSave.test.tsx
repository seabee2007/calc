import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EstimateWorkspaceToolbarActions from '../ui/components/EstimateWorkspaceToolbarActions';
import { SAVE_QUICK_ESTIMATE_TOOLBAR_LABEL } from '../ui/estimateWorkspaceToolbar';

const workspacePageSource = readFileSync(
  resolve(process.cwd(), 'src/features/estimating/ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

const defaultHandlers = {
  showCollapseAll: false,
  showSaveQuick: true,
  canSaveQuick: true,
  showAddDivision: false,
  collapseAll: vi.fn(),
  saveQuick: vi.fn(),
  openAddDivision: vi.fn(),
};

function renderQuickSaveToolbar(options: {
  canSaveQuick?: boolean;
  saving?: boolean;
  saveQuick?: () => void;
} = {}) {
  const saveQuick = options.saveQuick ?? vi.fn();
  return {
    saveQuick,
    ...render(
      <EstimateWorkspaceToolbarActions
        showAddDivision={false}
        showCollapseAll={false}
        showReset={false}
        showSaveBucket={false}
        showSaveQuick={true}
        showImportExport={false}
        canEdit={true}
        canSaveQuick={options.canSaveQuick ?? true}
        saving={options.saving ?? false}
        saveStatus="saved"
        saveStatusActiveOperations={0}
        hasPendingEstimateChanges={false}
        handlers={{
          ...defaultHandlers,
          saveQuick,
        }}
        onReset={vi.fn()}
        onSave={vi.fn()}
        onRetrySave={vi.fn()}
        onImportEstimate={vi.fn()}
        onExportEstimate={vi.fn()}
        onDownloadImportTemplate={vi.fn()}
        onOpenHelp={vi.fn()}
      />,
    ),
  };
}

describe('estimateWorkspaceQuickSave toolbar', () => {
  it('renders Save Quick Estimate in the toolbar', () => {
    renderQuickSaveToolbar();
    expect(screen.getByTestId('estimate-workspace-save-quick-button')).toHaveTextContent(
      SAVE_QUICK_ESTIMATE_TOOLBAR_LABEL,
    );
  });

  it('uses outline toolbar styling instead of the filled accent variant', () => {
    renderQuickSaveToolbar();
    const button = screen.getByTestId('estimate-workspace-save-quick-button');
    expect(button.className).toContain('border');
    expect(button.className).not.toContain('bg-cyan-600');
  });

  it('calls the quick save handler when Save Quick Estimate is clicked', async () => {
    const user = userEvent.setup();
    const { saveQuick } = renderQuickSaveToolbar();
    await user.click(screen.getByTestId('estimate-workspace-save-quick-button'));
    expect(saveQuick).toHaveBeenCalledTimes(1);
  });

  it('shows Saving... and disables the button while saving', () => {
    renderQuickSaveToolbar({ saving: true });
    const button = screen.getByTestId('estimate-workspace-save-quick-button');
    expect(button).toHaveTextContent('Saving...');
    expect(button).toBeDisabled();
  });

  it('keeps save disabled when quick estimate cannot be saved', () => {
    renderQuickSaveToolbar({ canSaveQuick: false });
    expect(screen.getByTestId('estimate-workspace-save-quick-button')).toBeDisabled();
  });

  it('uses the same save status component for saved state on other toolbar save tabs', () => {
    render(
      <EstimateWorkspaceToolbarActions
        showAddDivision={false}
        showCollapseAll={false}
        showReset={false}
        showSaveBucket={true}
        showSaveQuick={false}
        showImportExport={false}
        canEdit={true}
        canSaveQuick={false}
        saving={false}
        saveStatus="saved"
        saveStatusActiveOperations={0}
        hasPendingEstimateChanges={false}
        handlers={null}
        onReset={vi.fn()}
        onSave={vi.fn()}
        onRetrySave={vi.fn()}
        onImportEstimate={vi.fn()}
        onExportEstimate={vi.fn()}
        onDownloadImportTemplate={vi.fn()}
        onOpenHelp={vi.fn()}
      />,
    );

    expect(screen.getByText('Saved ✓')).toBeInTheDocument();
  });

  it('still renders the Actions dropdown trigger', () => {
    renderQuickSaveToolbar();
    expect(screen.getAllByTestId('estimate-workspace-actions-trigger').length).toBeGreaterThan(0);
  });
});

describe('estimateWorkspaceQuickSave page wiring', () => {
  it('wires quick estimate tab preview changes and save handlers', () => {
    expect(workspacePageSource).toContain('onPreviewChange={handleQuickFeasibilityPreviewChange}');
    expect(workspacePageSource).toContain('handleQuickTabSave');
    expect(workspacePageSource).toContain('activeTab === \'quick-estimate\'');
    expect(workspacePageSource).toContain('setQuickFeasibilityPreview');
  });

  it('uses quick estimate save toast messages', () => {
    expect(workspacePageSource).toContain('QUICK_ESTIMATE_SAVE_SUCCESS_MESSAGE');
    expect(workspacePageSource).toContain('QUICK_ESTIMATE_SAVE_ERROR_MESSAGE');
  });

  it('does not change production-rate bucket save wiring', () => {
    expect(workspacePageSource).toContain('onSave={() => void handleSaveEstimate()}');
    expect(workspacePageSource).not.toContain('handleSaveEstimate(quickFeasibilityPreview');
  });
});
