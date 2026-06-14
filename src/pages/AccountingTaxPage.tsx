import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FileSpreadsheet,
  ArrowLeft,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import AppPage from '../components/ui/AppPage';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import InlineNotice from '../components/ui/InlineNotice';
import TaxCategoryMapping from '../components/accounting/TaxCategoryMapping';
import ExportValidationChecklist from '../components/accounting/ExportValidationChecklist';
import { useTrackedProposals } from '../hooks/useTrackedProposals';
import { useProjectStore } from '../store';
import { useSettingsStore } from '../store';
import { fetchChangeOrdersForProjectIds } from '../services/changeOrderService';
import {
  buildAccountingExportData,
  loadTaxCategoryMap,
  DEFAULT_TAX_YEAR,
  ENTITY_TYPE_LABELS,
  NON_SCHEDULE_C_ENTITIES,
  type AccountingExportSettings,
  type AccountingMethod,
  type BusinessEntityType,
  type TaxCategoryMap,
} from '../utils/accountingExport';
import {
  downloadScheduleCSummaryCsv,
  downloadScheduleCSummaryPdf,
  SCHEDULE_C_DISCLAIMER,
  SCHEDULE_C_LABEL,
} from '../utils/scheduleCExport';
import { downloadCpaWorkbook } from '../utils/cpaWorkbookExport';
import {
  downloadQuickBooksCustomersCsv,
  downloadQuickBooksInvoicesCsv,
  downloadJobCostSummaryCsv,
  downloadTurboTaxHelperCsv,
  TURBOTAX_HELPER_DISCLAIMER,
} from '../utils/quickbooksExport';
import type { ChangeOrder } from '../types/changeOrder';

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => {
  const y = DEFAULT_TAX_YEAR - i;
  return { value: String(y), label: String(y) };
});

const ENTITY_OPTIONS = (
  Object.entries(ENTITY_TYPE_LABELS) as [BusinessEntityType, string][]
).map(([value, label]) => ({ value, label }));

const METHOD_OPTIONS: { value: AccountingMethod; label: string }[] = [
  { value: 'accrual', label: 'Accrual (recommended — uses accepted dates)' },
  { value: 'cash', label: 'Cash (uses paid / deposit timestamps)' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const AccountingTaxPage: React.FC = () => {
  const navigate = useNavigate();
  const { proposals, loading: proposalsLoading } = useTrackedProposals();
  const { projects, loadProjects } = useProjectStore();
  const { companySettings } = useSettingsStore();
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);

  // Settings
  const [taxYear, setTaxYear] = useState<number>(DEFAULT_TAX_YEAR);
  const [entityType, setEntityType] = useState<BusinessEntityType>('sole_proprietor');
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>('accrual');
  const [taxCategoryMap, setTaxCategoryMap] = useState<TaxCategoryMap>(() =>
    loadTaxCategoryMap(),
  );

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (projects.length === 0) return;
    const ids = projects.map((p) => p.id);
    void fetchChangeOrdersForProjectIds(ids)
      .then(setChangeOrders)
      .catch(() => setChangeOrders([]));
  }, [projects]);

  const settings: AccountingExportSettings = useMemo(
    () => ({ taxYear, entityType, accountingMethod, taxCategoryMap }),
    [taxYear, entityType, accountingMethod, taxCategoryMap],
  );

  const exportData = useMemo(
    () =>
      proposalsLoading
        ? null
        : buildAccountingExportData(proposals, changeOrders, projects, settings),
    [proposals, changeOrders, projects, settings, proposalsLoading],
  );

  const showEntityWarning =
    NON_SCHEDULE_C_ENTITIES.includes(entityType);

  const businessName = companySettings?.companyName;

  // ---------------------------------------------------------------------------
  // Export actions
  // ---------------------------------------------------------------------------

  function handleScheduleCSummaryCsv() {
    if (!exportData) return;
    downloadScheduleCSummaryCsv(exportData);
  }

  async function handleScheduleCSummaryPdf() {
    if (!exportData) return;
    await downloadScheduleCSummaryPdf(exportData);
  }

  function handleCpaWorkbook() {
    if (!exportData) return;
    downloadCpaWorkbook(exportData);
  }

  function handleQbCustomers() {
    if (!exportData) return;
    downloadQuickBooksCustomersCsv(exportData);
  }

  function handleQbInvoices() {
    if (!exportData) return;
    downloadQuickBooksInvoicesCsv(exportData);
  }

  function handleJobCostSummary() {
    if (!exportData) return;
    downloadJobCostSummaryCsv(exportData);
  }

  function handleTurboTaxHelper() {
    if (!exportData) return;
    downloadTurboTaxHelperCsv(exportData);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <AppPage
        data-testid="accounting-tax-page"
        header={
          <PageHeader
            title="Accounting &amp; Tax Prep Package"
            subtitle="Year-end export package for CPAs, QuickBooks, and tax preparation."
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={<ArrowLeft size={16} />}
                onClick={() => navigate('/settings')}
                data-testid="accounting-back-button"
              >
                Back to Settings
              </Button>
            }
          />
        }
      >
        <div className="space-y-6">
          {/* Validation checklist */}
          {exportData && (
            <ExportValidationChecklist
              data={exportData}
              businessName={businessName}
              data-testid="export-validation-checklist"
            />
          )}

          {/* Report settings */}
          <Card className="p-6" data-testid="accounting-settings-card">
            <div className="mb-5 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Report Settings
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tax Year
                </label>
                <Select
                  value={String(taxYear)}
                  onChange={(v) => setTaxYear(Number(v))}
                  options={YEAR_OPTIONS}
                  data-testid="tax-year-selector"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Business Entity Type
                </label>
                <Select
                  value={entityType}
                  onChange={(v) => setEntityType(v as BusinessEntityType)}
                  options={ENTITY_OPTIONS}
                  data-testid="entity-type-selector"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Used as a report label only. Does not change calculations.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Accounting Method
                </label>
                <Select
                  value={accountingMethod}
                  onChange={(v) => setAccountingMethod(v as AccountingMethod)}
                  options={METHOD_OPTIONS}
                  data-testid="accounting-method-selector"
                />
                {accountingMethod === 'cash' && (
                  <p
                    className="mt-1 text-xs text-amber-700 dark:text-amber-400"
                    data-testid="cash-method-note"
                  >
                    Based on paid_at / deposit_paid_at timestamps. Review with your CPA if
                    payment records are incomplete.
                  </p>
                )}
                {accountingMethod === 'accrual' && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Based on accepted proposal / change order dates.
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Year-End Tax Package */}
          <Card className="p-6" data-testid="tax-package-card">
            <div className="mb-5 flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Year-End Tax Prep Package
              </h2>
            </div>

            {/* Always-visible disclaimer */}
            <div
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              data-testid="tax-disclaimer"
            >
              <p className="font-medium">Important</p>
              <p className="mt-1">{SCHEDULE_C_DISCLAIMER}</p>
            </div>

            {/* Entity-type warning (shown if entity ≠ Sole Proprietor) */}
            {showEntityWarning && (
              <div data-testid="entity-type-warning" className="mb-5">
                <InlineNotice
                  variant="warning"
                  title="Schedule C style layout may not apply to every entity type. Review with your CPA or tax preparer."
                />
              </div>
            )}

            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              <strong>{SCHEDULE_C_LABEL}</strong> — not an official IRS form.
              {exportData && (
                <> {exportData.recognizedProposals.length} proposal(s) recognized for {taxYear}.</>
              )}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={16} />}
                onClick={handleScheduleCSummaryCsv}
                disabled={!exportData}
                data-testid="download-schedule-c-csv"
              >
                Schedule C Style Summary CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={16} />}
                onClick={() => void handleScheduleCSummaryPdf()}
                disabled={!exportData}
                data-testid="download-schedule-c-pdf"
              >
                Schedule C Style Summary PDF
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<FileSpreadsheet size={16} />}
                onClick={handleCpaWorkbook}
                disabled={!exportData}
                data-testid="download-cpa-workbook"
              >
                CPA Workbook XLSX
              </Button>
            </div>
          </Card>

          {/* QuickBooks Export */}
          <Card className="p-6" data-testid="quickbooks-card">
            <div className="mb-5 flex items-center gap-3">
              <Download className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                QuickBooks Export (CSV)
              </h2>
            </div>

            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Export CSV files for QuickBooks import workflows. Phase 1 is CSV-only.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={16} />}
                onClick={handleQbCustomers}
                disabled={!exportData}
                data-testid="download-qb-customers"
              >
                Customers CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={16} />}
                onClick={handleQbInvoices}
                disabled={!exportData}
                data-testid="download-qb-invoices"
              >
                Invoices / Sales Receipts CSV
              </Button>
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Download size={16} />}
                  onClick={handleJobCostSummary}
                  disabled={!exportData}
                  data-testid="download-job-cost-summary"
                >
                  Job Cost Summary CSV
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Exports job-cost categories from proposal data. This is not a full vendor
                  expense ledger.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Direct QuickBooks Online sync will be added in a later phase.
            </p>
          </Card>

          {/* TurboTax Helper */}
          <Card className="p-6" data-testid="turbotax-card">
            <div className="mb-5 flex items-center gap-3">
              <Download className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                TurboTax Helper Export
              </h2>
            </div>

            <p
              className="mb-4 text-sm text-slate-600 dark:text-slate-400"
              data-testid="turbotax-note"
            >
              {TURBOTAX_HELPER_DISCLAIMER}
            </p>

            <Button
              variant="outline"
              size="sm"
              icon={<Download size={16} />}
              onClick={handleTurboTaxHelper}
              disabled={!exportData}
              data-testid="download-turbotax-helper"
            >
              TurboTax Helper CSV
            </Button>
          </Card>

          {/* Tax Category Mapping */}
          <Card className="p-6" data-testid="tax-category-card">
            <div className="mb-5 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Tax Category Mapping
              </h2>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Customize how Arden Project OS categories map to tax/accounting labels in your
              exports.
            </p>
            <TaxCategoryMapping onChange={setTaxCategoryMap} />
          </Card>
        </div>
      </AppPage>
    </motion.div>
  );
};

export default AccountingTaxPage;
