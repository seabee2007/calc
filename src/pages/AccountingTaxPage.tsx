import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FileSpreadsheet,
  ArrowLeft,
  BookOpen,
  Calculator,
  Tags,
  Receipt,
} from 'lucide-react';
import AppPage from '../components/ui/AppPage';
import PageHeader from '../components/ui/PageHeader';
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
import {
  BORDER_DEFAULT,
  TEXT_FOREGROUND,
  TEXT_MUTED,
  TEXT_SUBTLE,
} from '../theme/appTheme';

const KPI_CARD =
  'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80';

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

const SECTION_CARD =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900';

const FIELD_LABEL = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';
const FIELD_HELPER = `mt-1.5 text-xs ${TEXT_SUBTLE}`;

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function accountingMethodLabel(method: AccountingMethod): string {
  return method === 'accrual' ? 'Accrual' : 'Cash';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const AccountingTaxPage: React.FC = () => {
  const navigate = useNavigate();
  const { proposals, loading: proposalsLoading } = useTrackedProposals();
  const { projects, loadProjects } = useProjectStore();
  const { companySettings } = useSettingsStore();
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);

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
    () => ({
      taxYear,
      entityType,
      accountingMethod,
      taxCategoryMap,
      company: {
        name: companySettings?.companyName,
        address: companySettings?.address,
        phone: companySettings?.phone,
        email: companySettings?.email,
        licenseNumber: companySettings?.licenseNumber,
      },
    }),
    [taxYear, entityType, accountingMethod, taxCategoryMap, companySettings],
  );

  const exportData = useMemo(
    () =>
      proposalsLoading
        ? null
        : buildAccountingExportData(proposals, changeOrders, projects, settings),
    [proposals, changeOrders, projects, settings, proposalsLoading],
  );

  const showEntityWarning = NON_SCHEDULE_C_ENTITIES.includes(entityType);
  const businessName = companySettings?.companyName;

  const recognizedRevenueDisplay = exportData
    ? formatCurrency(exportData.grossReceipts + exportData.changeOrderRevenue)
    : proposalsLoading
      ? '…'
      : 'Not tracked';

  const proposalsIncludedDisplay = exportData
    ? String(exportData.recognizedProposals.length)
    : proposalsLoading
      ? '…'
      : 'Not tracked';

  const changeOrdersIncludedDisplay = exportData
    ? String(exportData.acceptedChangeOrders.length)
    : proposalsLoading
      ? '…'
      : 'Not tracked';

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
            title="Accounting & Tax Prep Package"
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
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
            aria-label="Export summary"
            data-testid="accounting-summary-row"
          >
            <SummaryStat label="Tax year" value={String(taxYear)} />
            <SummaryStat label="Recognized revenue" value={recognizedRevenueDisplay} />
            <SummaryStat label="Accepted proposals" value={proposalsIncludedDisplay} />
            <SummaryStat label="Change orders" value={changeOrdersIncludedDisplay} />
            <SummaryStat
              label="Accounting method"
              value={accountingMethodLabel(accountingMethod)}
            />
          </section>

          {exportData ? (
            <ExportValidationChecklist
              data={exportData}
              businessName={businessName}
              data-testid="export-validation-checklist"
            />
          ) : null}

          <section className={SECTION_CARD} data-testid="accounting-settings-card">
            <SectionHeader
              icon={<BookOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="Report Settings"
              description="Configure labels and recognition method for export files. These settings do not change underlying project calculations."
            />
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div>
                <label className={FIELD_LABEL} htmlFor="tax-year-selector">
                  Tax Year
                </label>
                <Select
                  id="tax-year-selector"
                  value={String(taxYear)}
                  onChange={(v) => setTaxYear(Number(v))}
                  options={YEAR_OPTIONS}
                  data-testid="tax-year-selector"
                />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="entity-type-selector">
                  Business Entity Type
                </label>
                <Select
                  id="entity-type-selector"
                  value={entityType}
                  onChange={(v) => setEntityType(v as BusinessEntityType)}
                  options={ENTITY_OPTIONS}
                  data-testid="entity-type-selector"
                />
                <p className={FIELD_HELPER}>
                  Used as a report label only. Does not change calculations.
                </p>
                {showEntityWarning ? (
                  <div className="mt-3" data-testid="entity-type-warning">
                    <InlineNotice
                      variant="warning"
                      title="Schedule C style layout may not apply to every entity type. Review with your CPA or tax preparer."
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="accounting-method-selector">
                  Accounting Method
                </label>
                <Select
                  id="accounting-method-selector"
                  value={accountingMethod}
                  onChange={(v) => setAccountingMethod(v as AccountingMethod)}
                  options={METHOD_OPTIONS}
                  data-testid="accounting-method-selector"
                />
                {accountingMethod === 'cash' ? (
                  <p
                    className={`${FIELD_HELPER} text-amber-700 dark:text-amber-400`}
                    data-testid="cash-method-note"
                  >
                    Based on paid_at / deposit_paid_at timestamps. Review with your CPA if payment
                    records are incomplete.
                  </p>
                ) : (
                  <p className={FIELD_HELPER}>Based on accepted proposal / change order dates.</p>
                )}
              </div>
            </div>
          </section>

          <ExportCard
            testId="tax-package-card"
            icon={<FileSpreadsheet className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
            title="Year-End Tax Prep Package"
            description={
              <>
                <strong className={TEXT_FOREGROUND}>{SCHEDULE_C_LABEL}</strong> — not an official
                IRS form.
                {exportData ? (
                  <>
                    {' '}
                    {exportData.recognizedProposals.length} proposal(s) recognized for {taxYear}.
                  </>
                ) : null}
              </>
            }
          >
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-100"
              data-testid="tax-disclaimer"
            >
              <p className="font-semibold">Important</p>
              <p className="mt-1 leading-relaxed">{SCHEDULE_C_DISCLAIMER}</p>
            </div>

            <div className="flex flex-wrap gap-2">
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
          </ExportCard>

          <ExportCard
            testId="quickbooks-card"
            icon={<Receipt className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
            title="QuickBooks Export (CSV)"
            description="Export CSV files for QuickBooks import workflows. Phase 1 is CSV-only."
            footer="Direct QuickBooks Online sync will be added in a later phase."
          >
            <div className="flex flex-wrap gap-2">
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
            </div>
            <p className={`text-xs leading-relaxed ${TEXT_SUBTLE}`}>
              Exports job-cost categories from proposal data. This is not a full vendor expense
              ledger.
            </p>
          </ExportCard>

          <ExportCard
            testId="tax-prep-card"
            icon={<Calculator className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
            title="Tax Prep Helper Export"
            description={
              <span data-testid="tax-prep-note">{TURBOTAX_HELPER_DISCLAIMER}</span>
            }
          >
            <Button
              variant="outline"
              size="sm"
              icon={<Download size={16} />}
              onClick={handleTurboTaxHelper}
              disabled={!exportData}
              data-testid="download-tax-prep-helper"
            >
              Tax Prep Helper CSV
            </Button>
          </ExportCard>

          <section className={SECTION_CARD} data-testid="tax-category-card">
            <SectionHeader
              icon={<Tags className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              title="Tax Category Mapping"
              description="Customize how Arden Project OS categories map to tax/accounting labels in your exports."
            />
            <div className="mt-6">
              <TaxCategoryMapping onChange={setTaxCategoryMap} />
            </div>
          </section>
        </div>
      </AppPage>
    </motion.div>
  );
};

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={KPI_CARD}>
      <p className={`text-xs font-medium uppercase tracking-wide ${TEXT_SUBTLE}`}>{label}</p>
      <p className={`mt-1 text-lg font-semibold ${TEXT_FOREGROUND}`}>{value}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${BORDER_DEFAULT} bg-slate-50 dark:bg-slate-800/80`}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className={`text-lg font-semibold ${TEXT_FOREGROUND}`}>{title}</h2>
        {description ? (
          <p className={`mt-1 text-sm leading-relaxed ${TEXT_MUTED}`}>{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function ExportCard({
  testId,
  icon,
  title,
  description,
  children,
  footer,
}: {
  testId: string;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <section className={`${SECTION_CARD} space-y-4`} data-testid={testId}>
      <SectionHeader icon={icon} title={title} description={description} />
      {children}
      {footer ? <p className={`text-xs leading-relaxed ${TEXT_SUBTLE}`}>{footer}</p> : null}
    </section>
  );
}

export default AccountingTaxPage;
