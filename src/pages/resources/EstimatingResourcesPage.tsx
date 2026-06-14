import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import AppPage from '../../components/ui/AppPage';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { PREMIUM_PANEL } from '../../theme/appTheme';
import {
  ARDEN_ESTIMATING_NOTE,
  BID_REVIEW_CHECKLIST_ITEMS,
  CHANGE_ORDER_PRICING_CHECKLIST_ITEMS,
  COMMON_UNITS_OF_MEASURE_ROWS,
  COST_BREAKDOWN_ROWS,
  ESTIMATE_LINE_ITEM_ANATOMY_ROWS,
  ESTIMATE_TYPES_ROWS,
  ESTIMATING_DISCLAIMER,
  ESTIMATING_PAGE_SUBTITLE,
  ESTIMATING_RESOURCES,
  ESTIMATING_WORKFLOW_ROWS,
  FEATURED_REFERENCE_IDS,
  LABOR_BURDEN_INTRO,
  LABOR_BURDEN_ROWS,
  LS_UNIT_WARNING,
  PRODUCTION_REFERENCE_FORMULAS,
  PRODUCTION_REFERENCE_INTRO,
  PRODUCTION_REFERENCE_WARNING,
  PROPRIETARY_DATA_NOTE,
  QUANTITY_TAKEOFF_FORMULA_ROWS,
  SUBCONTRACTOR_QUOTE_CHECKLIST_ITEMS,
  TAKEOFF_QA_CHECKLIST_ITEMS,
  getEstimatingResource,
  type EstimatingResource,
} from '../../features/resources/estimatingResourceCatalog';

function ResourceBadge({ resource }: { resource: EstimatingResource }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {resource.badge}
    </span>
  );
}

function PrintableBadge({ printable, status }: { printable?: boolean; status: EstimatingResource['status'] }) {
  if (status === 'coming-soon') {
    return (
      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        Coming soon
      </span>
    );
  }
  if (printable) {
    return (
      <>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-300">
          Printable-ready
        </span>
        <span className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Printable PDF coming soon
        </span>
      </>
    );
  }
  return null;
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-800/80">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="whitespace-normal px-3 py-2 text-slate-700 dark:text-slate-300"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormulaBlock({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-1.5">
      {lines.map((line) => (
        <li
          key={line}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function ChecklistBlock({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden>
            □
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ResourceBody({ resource }: { resource: EstimatingResource }) {
  if (resource.status === 'coming-soon') {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        This resource pack is being prepared for a future release.
      </p>
    );
  }

  switch (resource.id) {
    case 'estimating-workflow':
      return (
        <DataTable
          headers={['Step', 'What to verify', 'Arden note']}
          rows={ESTIMATING_WORKFLOW_ROWS.map((r) => [r.step, r.whatToVerify, r.ardenNote])}
        />
      );
    case 'estimate-types':
      return (
        <DataTable
          headers={['Estimate type', 'When used', 'Typical basis', 'Risk level']}
          rows={ESTIMATE_TYPES_ROWS.map((r) => [
            r.estimateType,
            r.whenUsed,
            r.typicalBasis,
            r.riskLevel,
          ])}
        />
      );
    case 'estimate-line-item-anatomy':
      return (
        <DataTable
          headers={['Field', 'Why it matters', 'Example']}
          rows={ESTIMATE_LINE_ITEM_ANATOMY_ROWS.map((r) => [r.field, r.whyItMatters, r.example])}
        />
      );
    case 'common-units-of-measure':
      return (
        <div className="space-y-4">
          <DataTable
            headers={['Unit', 'Used for', 'Estimator check']}
            rows={COMMON_UNITS_OF_MEASURE_ROWS.map((r) => [r.unit, r.usedFor, r.estimatorCheck])}
          />
          <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100/90">
            {LS_UNIT_WARNING}
          </p>
        </div>
      );
    case 'quantity-takeoff-formulas':
      return (
        <DataTable
          headers={['Calculation', 'Formula', 'Common use']}
          rows={QUANTITY_TAKEOFF_FORMULA_ROWS.map((r) => [r.calculation, r.formula, r.commonUse])}
        />
      );
    case 'cost-breakdown-reference':
      return (
        <DataTable
          headers={['Cost bucket', 'Includes', 'Review prompt']}
          rows={COST_BREAKDOWN_ROWS.map((r) => [r.costBucket, r.includes, r.reviewPrompt])}
        />
      );
    case 'labor-burden-reference':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {LABOR_BURDEN_INTRO}
          </p>
          <DataTable
            headers={['Component', 'Description']}
            rows={LABOR_BURDEN_ROWS.map((r) => [r.component, r.description])}
          />
        </div>
      );
    case 'production-reference-guide':
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {PRODUCTION_REFERENCE_INTRO}
          </p>
          <FormulaBlock lines={PRODUCTION_REFERENCE_FORMULAS} />
          <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100/90">
            {PRODUCTION_REFERENCE_WARNING}
          </p>
        </div>
      );
    case 'takeoff-qa-checklist':
      return <ChecklistBlock items={TAKEOFF_QA_CHECKLIST_ITEMS} />;
    case 'subcontractor-quote-review':
      return <ChecklistBlock items={SUBCONTRACTOR_QUOTE_CHECKLIST_ITEMS} />;
    case 'bid-review-checklist':
      return <ChecklistBlock items={BID_REVIEW_CHECKLIST_ITEMS} />;
    case 'change-order-pricing':
      return <ChecklistBlock items={CHANGE_ORDER_PRICING_CHECKLIST_ITEMS} />;
    default:
      return null;
  }
}

function EstimatingResourceCard({ resource }: { resource: EstimatingResource }) {
  return (
    <article
      id={`estimating-resource-${resource.id}`}
      data-testid={`estimating-resource-${resource.id}`}
      className={`${PREMIUM_PANEL} scroll-mt-6 break-inside-avoid p-5 sm:p-6`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ResourceBadge resource={resource} />
        <PrintableBadge printable={resource.printable} status={resource.status} />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{resource.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {resource.description}
      </p>
      <div className="mt-4">
        <ResourceBody resource={resource} />
      </div>
    </article>
  );
}

export default function EstimatingResourcesPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToResource = (id: string) => {
    const el = document.getElementById(`estimating-resource-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const breadcrumb = (
    <>
      <Link to="/resources" className="hover:text-cyan-700 dark:hover:text-cyan-400">
        Resources
      </Link>
      <span className="mx-1.5 text-slate-400">/</span>
      <span className="text-slate-700 dark:text-slate-300">Estimating</span>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <AppPage data-testid="estimating-resources-page" className="overflow-x-hidden">
        <PageHeader
          breadcrumb={breadcrumb}
          title="Estimating Tables"
          subtitle={ESTIMATING_PAGE_SUBTITLE}
          className="mb-6"
        />

        <Button
          variant="ghost"
          onClick={() => navigate('/resources')}
          icon={<ArrowLeft size={20} />}
          className="mb-4 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          Back to Resources
        </Button>

        <div
          className="mb-8 rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
          data-testid="estimating-disclaimer-card"
        >
          <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100/90">
            {ESTIMATING_DISCLAIMER}
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-6">
            {ESTIMATING_RESOURCES.map((resource) => (
              <EstimatingResourceCard key={resource.id} resource={resource} />
            ))}
          </section>

          <aside className="min-w-0 space-y-6">
            <div className={`${PREMIUM_PANEL} p-6`}>
              <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">
                Featured references
              </h2>
              <ul className="space-y-2">
                {FEATURED_REFERENCE_IDS.map((id) => {
                  const ref = getEstimatingResource(id);
                  if (!ref) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => scrollToResource(id)}
                        className="block w-full rounded-md p-2 text-left text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
                      >
                        {ref.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={`${PREMIUM_PANEL} p-6`} data-testid="arden-estimating-note">
              <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                Arden estimating note
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {ARDEN_ESTIMATING_NOTE}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {PROPRIETARY_DATA_NOTE}
              </p>
            </div>

            <div className={`${PREMIUM_PANEL} p-6`} data-testid="related-conversion-tables">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Need unit conversions?{' '}
                <Link
                  to="/resources/conversions"
                  className="font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  Open Conversion Tables
                </Link>
                .
              </p>
            </div>
          </aside>
        </div>
      </AppPage>
    </motion.div>
  );
}
