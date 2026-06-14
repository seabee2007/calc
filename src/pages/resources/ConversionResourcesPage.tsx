import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import AppPage from '../../components/ui/AppPage';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { PREMIUM_PANEL } from '../../theme/appTheme';
import {
  AREA_CONVERSION_ROWS,
  AREA_IMPERIAL_TO_METRIC_ROWS,
  AREA_METRIC_TO_IMPERIAL_ROWS,
  BASIC_LENGTH_CONVERSION_ROWS,
  CONVERSION_FIELD_NOTE,
  CONVERSION_MISTAKE_CARDS,
  CONVERSION_PAGE_SUBTITLE,
  CONVERSION_ROUNDING_NOTE,
  CONVERSION_SECTIONS,
  FEATURED_CONVERSION_IDS,
  GENERAL_CONVERSION_ROWS,
  IMPERIAL_FRACTION_METRIC_ROWS,
  LENGTH_IMPERIAL_TO_METRIC_ROWS,
  LENGTH_METRIC_TO_IMPERIAL_ROWS,
  LUMBER_BOARD_FEET_FORMULAS,
  LUMBER_LF_EXAMPLES,
  LUMBER_NOMINAL_NOTE,
  MATERIAL_WEIGHT_GROUPS,
  MATERIAL_WEIGHTS_NOTE,
  REBAR_REFERENCE_ROWS,
  REBAR_WEIGHT_NOTE,
  ROOF_PITCH_FOOTPRINT_NOTE,
  ROOF_SLOPE_FORMULAS,
  ROOF_SLOPE_ROWS,
  TRADE_QUICK_REFERENCE_CARDS,
  VOLUME_CONSTRUCTION_NOTES,
  VOLUME_CONVERSION_ROWS,
  WEIGHT_DENSITY_WARNING,
  WEIGHT_ORDERING_FORMULAS,
  WEIGHT_PLANNING_EXAMPLES,
  WEIGHT_TO_VOLUME_WARNING,
  getConversionSection,
  type ConversionSection,
} from '../../features/resources/conversionResourceCatalog';

function SectionBadge({ section }: { section: ConversionSection }) {
  if (!section.badge) return null;
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {section.badge}
    </span>
  );
}

function StatusBadge({ section }: { section: ConversionSection }) {
  if (section.status === 'coming-soon') {
    return (
      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        Coming soon
      </span>
    );
  }
  if (section.printable) {
    return (
      <span className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
        Printable PDF coming soon
      </span>
    );
  }
  return null;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
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

function WarningCard({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100/90">
      {text}
    </p>
  );
}

function SectionBody({ section }: { section: ConversionSection }) {
  if (section.status === 'coming-soon') {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        PDF-ready conversion sheets for field crews and estimators are being prepared for a future
        release.
      </p>
    );
  }

  switch (section.id) {
    case 'basic-length-conversions':
      return (
        <DataTable
          headers={['From', 'To', 'Factor', 'Formula', 'Common use']}
          rows={BASIC_LENGTH_CONVERSION_ROWS.map((r) => [
            r.from,
            r.to,
            r.factor,
            r.formula,
            r.useCase ?? '',
          ])}
        />
      );
    case 'area-conversions':
      return (
        <DataTable
          headers={['From', 'To', 'Factor', 'Formula', 'Common use']}
          rows={AREA_CONVERSION_ROWS.map((r) => [
            r.from,
            r.to,
            r.factor,
            r.formula,
            r.useCase ?? '',
          ])}
        />
      );
    case 'volume-conversions':
      return (
        <div className="space-y-4">
          <DataTable
            headers={['From', 'To', 'Factor', 'Formula', 'Common use']}
            rows={VOLUME_CONVERSION_ROWS.map((r) => [
              r.from,
              r.to,
              r.factor,
              r.formula,
              r.useCase ?? '',
            ])}
          />
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {VOLUME_CONSTRUCTION_NOTES.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="text-cyan-600 dark:text-cyan-400" aria-hidden>
                  •
                </span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'weight-material-ordering':
      return (
        <div className="space-y-4">
          <WarningCard text={WEIGHT_DENSITY_WARNING} />
          <FormulaBlock lines={WEIGHT_ORDERING_FORMULAS} />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Planning examples (verify before ordering)
            </p>
            <FormulaBlock lines={WEIGHT_PLANNING_EXAMPLES} />
          </div>
        </div>
      );
    case 'lumber-board-feet':
      return (
        <div className="space-y-4">
          <FormulaBlock lines={LUMBER_BOARD_FEET_FORMULAS} />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Common examples
            </p>
            <FormulaBlock lines={LUMBER_LF_EXAMPLES} />
          </div>
          <WarningCard text={LUMBER_NOMINAL_NOTE} />
        </div>
      );
    case 'imperial-fraction-metric':
      return (
        <DataTable
          headers={['Imperial', 'Decimal inches', 'Millimeters']}
          rows={IMPERIAL_FRACTION_METRIC_ROWS.map((r) => [
            r.imperial,
            r.decimalInches,
            r.millimeters,
          ])}
        />
      );
    case 'roof-slope-pitch':
      return (
        <div className="space-y-4">
          <FormulaBlock lines={ROOF_SLOPE_FORMULAS} />
          <DataTable
            headers={['Pitch', 'Rise per 12"', 'Percent slope', 'Angle']}
            rows={ROOF_SLOPE_ROWS.map((r) => [
              r.pitch,
              r.risePer12,
              r.percentSlope,
              r.angle,
            ])}
          />
          <WarningCard text={ROOF_PITCH_FOOTPRINT_NOTE} />
        </div>
      );
    case 'common-conversion-mistakes':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {CONVERSION_MISTAKE_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
            >
              <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">{card.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/80">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      );
    case 'trade-quick-reference':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {TRADE_QUICK_REFERENCE_CARDS.map((card) => (
            <div
              key={card.trade}
              className={`${PREMIUM_PANEL} border border-slate-200/80 p-4 dark:border-slate-700/80`}
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{card.trade}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {card.mismatch}
              </p>
            </div>
          ))}
        </div>
      );
    case 'length-imperial-to-metric':
      return (
        <DataTable
          headers={['Imperial', 'Centimeters', 'Millimeters', 'Meters']}
          rows={LENGTH_IMPERIAL_TO_METRIC_ROWS.map((r) => [
            r.imperial,
            r.centimeters,
            r.millimeters,
            r.meters,
          ])}
        />
      );
    case 'length-metric-to-imperial':
      return (
        <DataTable
          headers={['Metric', 'Inches', 'Feet']}
          rows={LENGTH_METRIC_TO_IMPERIAL_ROWS.map((r) => [r.metric, r.inches, r.feet])}
        />
      );
    case 'area-imperial-to-metric':
      return (
        <DataTable
          headers={['Square yards', 'Square meters']}
          rows={AREA_IMPERIAL_TO_METRIC_ROWS.map((r) => [r.squareYards, r.squareMeters])}
        />
      );
    case 'area-metric-to-imperial':
      return (
        <DataTable
          headers={['Square meters', 'Square yards']}
          rows={AREA_METRIC_TO_IMPERIAL_ROWS.map((r) => [r.squareMeters, r.squareYards])}
        />
      );
    case 'general-conversion-chart':
      return (
        <div className="space-y-4">
          <WarningCard text={WEIGHT_TO_VOLUME_WARNING} />
          <DataTable
            headers={['From', 'To', 'Multiply by', 'Notes']}
            rows={GENERAL_CONVERSION_ROWS.map((r) => [
              r.from,
              r.to,
              r.multiplyBy,
              r.notes ?? '',
            ])}
          />
        </div>
      );
    case 'material-weights-density':
      return (
        <div className="space-y-6">
          {MATERIAL_WEIGHT_GROUPS.map((group) => (
            <div key={group.group}>
              <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {group.group}
              </h3>
              <DataTable
                headers={['Material', 'Approximate weight', 'Unit', 'Notes']}
                rows={group.rows.map((r) => [
                  r.material,
                  r.approximateWeight,
                  r.unit,
                  r.notes ?? '',
                ])}
              />
            </div>
          ))}
          <WarningCard text={MATERIAL_WEIGHTS_NOTE} />
        </div>
      );
    case 'rebar-diameter-weight':
      return (
        <div className="space-y-4">
          <DataTable
            headers={['Bar size', 'Nominal diameter', 'Weight per linear foot']}
            rows={REBAR_REFERENCE_ROWS.map((r) => [
              r.barSize,
              r.nominalDiameter,
              r.weightPerFoot,
            ])}
          />
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {REBAR_WEIGHT_NOTE}
          </p>
        </div>
      );
    default:
      return null;
  }
}

function ConversionSectionCard({ section }: { section: ConversionSection }) {
  return (
    <article
      id={`conversion-section-${section.id}`}
      data-testid={`conversion-section-${section.id}`}
      className={`${PREMIUM_PANEL} scroll-mt-6 break-inside-avoid p-5 sm:p-6`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SectionBadge section={section} />
        <StatusBadge section={section} />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{section.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {section.description}
      </p>
      <div className="mt-4">
        <SectionBody section={section} />
      </div>
    </article>
  );
}

export default function ConversionResourcesPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`conversion-section-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const breadcrumb = (
    <>
      <Link to="/resources" className="hover:text-cyan-700 dark:hover:text-cyan-400">
        Resources
      </Link>
      <span className="mx-1.5 text-slate-400">/</span>
      <span className="text-slate-700 dark:text-slate-300">Conversion Tables</span>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <AppPage data-testid="conversion-resources-page" className="overflow-x-hidden">
        <PageHeader
          breadcrumb={breadcrumb}
          title="Conversion Tables"
          subtitle={CONVERSION_PAGE_SUBTITLE}
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
          data-testid="conversion-rounding-note"
        >
          <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100/90">
            {CONVERSION_ROUNDING_NOTE}
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-6">
            {CONVERSION_SECTIONS.map((section) => (
              <ConversionSectionCard key={section.id} section={section} />
            ))}
          </section>

          <aside className="min-w-0 space-y-6">
            <div className={`${PREMIUM_PANEL} p-6`}>
              <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">
                Featured tables
              </h2>
              <ul className="space-y-2">
                {FEATURED_CONVERSION_IDS.map((id) => {
                  const ref = getConversionSection(id);
                  if (!ref) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(id)}
                        className="block w-full rounded-md p-2 text-left text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
                      >
                        {ref.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={`${PREMIUM_PANEL} p-6`} data-testid="conversion-field-note">
              <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Field note</h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {CONVERSION_FIELD_NOTE}
              </p>
            </div>
          </aside>
        </div>
      </AppPage>
    </motion.div>
  );
}
