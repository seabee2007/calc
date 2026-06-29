import {
  TRUSS_DESIGN_PRELIMINARY_WARNING,
  formatFeet,
  formatInches,
  formatLbs,
  formatMeters,
  formatOptionalNumber,
  formatPitchLabel,
  formatPlf,
  formatPsf,
  type TrussDesignSummary,
} from '../domain/trussDesignCalculations';

export type TrussReferenceSheetPanel = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TrussReferenceSheetNotesPanelProps = {
  summary: TrussDesignSummary;
  panel: TrussReferenceSheetPanel;
};

type NotesRow = {
  label: string;
  value: string;
};

type NotesSection = {
  title: string;
  rows: NotesRow[];
};

const HEADING_FONT_METERS = 0.11;
const BODY_FONT_METERS = 0.085;
const BORDER_STROKE_METERS = 0.008;

export function TrussReferenceSheetNotesPanel({
  summary,
  panel,
}: TrussReferenceSheetNotesPanelProps) {
  const supported = summary.supported && summary.geometry && summary.loads && summary.reactions && summary.memberLengths;
  const sections = supported ? buildSections(summary) : buildUnsupportedSections(summary);
  const padding = Math.max(0.16, panel.width * 0.035);
  const sectionGap = 0.08;
  const columnGap = 0.12;
  const twoColumns = panel.width >= 5.2;
  const columnWidth = twoColumns ? (panel.width - padding * 2 - columnGap) / 2 : panel.width - padding * 2;
  const leftSections = twoColumns ? sections.filter((_, index) => index % 2 === 0) : sections;
  const rightSections = twoColumns ? sections.filter((_, index) => index % 2 === 1) : [];

  return (
    <g data-testid="truss-reference-sheet-notes-panel">
      <rect
        x={panel.x}
        y={panel.y}
        width={panel.width}
        height={panel.height}
        fill="#ffffff"
        stroke="#94a3b8"
        strokeWidth={BORDER_STROKE_METERS}
      />
      {renderColumn(leftSections, panel.x + padding, panel.y + padding, columnWidth, panel.height - padding * 2, sectionGap)}
      {twoColumns
        ? renderColumn(
            rightSections,
            panel.x + padding + columnWidth + columnGap,
            panel.y + padding,
            columnWidth,
            panel.height - padding * 2,
            sectionGap,
          )
        : null}
    </g>
  );
}

function buildSections(
  summary: TrussDesignSummary & Required<Pick<TrussDesignSummary, 'geometry' | 'loads' | 'reactions' | 'memberLengths'>>,
): NotesSection[] {
  const gravity = summary.criteria.gravity;
  const wind = summary.criteria.wind;
  const snow = summary.criteria.snow;
  const windLoads = summary.loads.wind;
  const deflectionRows = summary.loads.deflection.limitsInches.map((limit) => ({
    label: `L/${limit.ratio}`,
    value: formatInches(limit.limitInches, 3),
  }));
  const warningRows = summary.warnings
    .filter((warning) => warning.message !== TRUSS_DESIGN_PRELIMINARY_WARNING)
    .slice(0, 4)
    .map((warning) => ({
      label: warning.severity === 'info' ? 'Note' : 'Warning',
      value: warning.message,
    }));

  return [
    {
      title: 'Header',
      rows: [
        { label: 'SEQN', value: summary.projectMeta.sequenceNumber },
        { label: 'Job Number', value: summary.projectMeta.jobNumber },
        { label: 'Truss Label', value: summary.projectMeta.trussLabel },
        { label: 'Date', value: summary.projectMeta.date },
        { label: 'Customer', value: summary.projectMeta.customer },
      ],
    },
    {
      title: 'Loading Criteria',
      rows: [
        { label: 'TCLL', value: formatPsf(gravity.tcllPsf, 2) },
        { label: 'TCDL', value: formatPsf(gravity.tcdlPsf, 2) },
        { label: 'BCLL', value: formatPsf(gravity.bcllPsf, 2) },
        { label: 'BCDL', value: formatPsf(gravity.bcdlPsf, 2) },
        { label: 'Des Ld', value: formatPsf(summary.loads.gravity.totalGravityLoadPsf, 2) },
        { label: 'Duration', value: gravity.loadDurationFactor.toFixed(2) },
        { label: 'Spacing', value: `${formatFeet(summary.geometry.trussSpacingFeet, 2)} (${formatInches(summary.geometry.trussSpacingInches, 1)})` },
      ],
    },
    {
      title: 'Span / Geometry',
      rows: [
        { label: 'Span', value: `${formatMeters(summary.geometry.spanMeters)} / ${formatFeet(summary.geometry.spanFeet)}` },
        { label: 'Rise', value: `${formatMeters(summary.geometry.riseMeters)} / ${formatFeet(summary.geometry.riseFeet)}` },
        { label: 'Run', value: `${formatMeters(summary.geometry.runMeters)} / ${formatFeet(summary.geometry.runFeet)}` },
        { label: 'Pitch', value: formatPitchLabel(summary.geometry.pitchRisePer12) },
        { label: 'Top chord', value: formatMeters(summary.geometry.topChordLengthMeters) },
        { label: 'Truss count', value: summary.geometry.trussCount.toString() },
        { label: 'Roof area', value: `${summary.geometry.roofSurfaceAreaSquareMeters.toFixed(2)} m2` },
        { label: 'Total steel', value: formatMeters(summary.memberLengths.totalMeters) },
      ],
    },
    {
      title: 'Wind Criteria',
      rows: [
        { label: 'Wind Std', value: wind.standard },
        { label: 'Speed', value: `${wind.speedMph.toFixed(0)} mph` },
        { label: 'Exposure', value: wind.exposure },
        { label: 'Enclosure', value: wind.enclosure },
        { label: 'Risk Cat', value: wind.riskCategory },
        { label: 'Mean Ht', value: formatFeet(wind.meanRoofHeightFt, 1) },
        { label: 'qz', value: windLoads ? formatPsf(windLoads.qzPsf, 2) : 'NA' },
        { label: 'Pressure', value: windLoads ? formatPsf(windLoads.pressurePsf, 2) : 'NA' },
      ],
    },
    {
      title: 'Snow Criteria',
      rows: [
        { label: 'Pg', value: formatSnowPsf(snow.pgPsf) },
        { label: 'Pf', value: formatSnowPsf(snow.pfPsf) },
        { label: 'Ce', value: formatOptionalNumber(snow.ce, 2) },
        { label: 'Ct', value: formatOptionalNumber(snow.ct, 2) },
        { label: 'Cs', value: formatOptionalNumber(snow.cs, 2) },
        { label: 'Duration', value: snow.snowDuration },
      ],
    },
    {
      title: 'Deflection Criteria',
      rows: [
        ...deflectionRows,
        { label: 'Actual', value: 'Requires engineered stiffness' },
      ],
    },
    {
      title: 'Maximum Reactions',
      rows: [
        { label: 'Left R+', value: formatLbs(summary.reactions.gravityLeftReactionLbs) },
        { label: 'Right R+', value: formatLbs(summary.reactions.gravityRightReactionLbs) },
        { label: 'Uplift L', value: summary.reactions.nonGravityLeftUpliftLbs == null ? 'NA' : formatLbs(summary.reactions.nonGravityLeftUpliftLbs) },
        { label: 'Uplift R', value: summary.reactions.nonGravityRightUpliftLbs == null ? 'NA' : formatLbs(summary.reactions.nonGravityRightUpliftLbs) },
        { label: 'Wind line', value: windLoads ? formatPlf(windLoads.windLineLoadPlf, 1) : 'NA' },
        { label: 'Bearing', value: `${formatInches(summary.reactions.bearingWidthInches, 1)} / min ${formatInches(summary.reactions.minimumRequiredBearingInches, 1)}` },
      ],
    },
    {
      title: 'Building Code / Criteria',
      rows: [
        { label: 'Building Code', value: summary.criteria.buildingCode.buildingCode },
        { label: 'TPI Std', value: summary.criteria.buildingCode.tpiStandard },
        { label: 'Rep Factor', value: summary.criteria.buildingCode.repetitionFactor },
      ],
    },
    {
      title: 'Notes / Warnings',
      rows: [
        { label: 'Notice', value: TRUSS_DESIGN_PRELIMINARY_WARNING },
        ...warningRows,
      ],
    },
  ];
}

function buildUnsupportedSections(summary: TrussDesignSummary): NotesSection[] {
  return [
    {
      title: 'Truss Design Notes',
      rows: [
        { label: 'Status', value: summary.unsupportedReason ?? 'No supported truss design summary is available.' },
        { label: 'Notice', value: TRUSS_DESIGN_PRELIMINARY_WARNING },
      ],
    },
  ];
}

function renderColumn(
  sections: readonly NotesSection[],
  x: number,
  y: number,
  width: number,
  maxHeight: number,
  gap: number,
) {
  const totalRows = Math.max(1, sections.reduce((count, section) => count + section.rows.length, 0));
  const availableSectionChrome = Math.max(0, maxHeight - gap * Math.max(0, sections.length - 1));
  const baseHeaderHeight = 0.22;
  const rowHeight = Math.max(0.115, Math.min(0.16, (availableSectionChrome - sections.length * baseHeaderHeight) / totalRows));
  let cursorY = y;

  return (
    <g>
      {sections.map((section) => {
        const sectionHeight = Math.min(
          availableSectionChrome,
          baseHeaderHeight + rowHeight * section.rows.length + 0.08,
        );
        const node = renderSection(section, x, cursorY, width, sectionHeight, rowHeight);
        cursorY += sectionHeight + gap;
        return node;
      })}
    </g>
  );
}

function renderSection(section: NotesSection, x: number, y: number, width: number, height: number, rowHeight: number) {
  const labelX = x + 0.12;
  const valueX = x + Math.min(width * 0.43, 1.45);
  const rowTop = y + 0.36;
  const visibleRows = section.rows.slice(0, Math.max(1, Math.floor((height - 0.34) / rowHeight)));

  return (
    <g key={`${section.title}-${x}-${y}`}>
      <rect x={x} y={y} width={width} height={height} fill="none" stroke="#cbd5e1" strokeWidth={BORDER_STROKE_METERS} />
      <text x={x + 0.12} y={y + 0.17} fill="#111827" fontSize={HEADING_FONT_METERS} fontWeight={700}>
        {section.title}
      </text>
      <line x1={x} y1={y + 0.24} x2={x + width} y2={y + 0.24} stroke="#cbd5e1" strokeWidth={BORDER_STROKE_METERS} />
      {visibleRows.map((row, index) => (
        <g key={`${section.title}-${row.label}-${index}`}>
          <text x={labelX} y={rowTop + index * rowHeight} fill="#334155" fontSize={BODY_FONT_METERS}>
            {fitText(row.label, 18)}
          </text>
          <text x={valueX} y={rowTop + index * rowHeight} fill="#111827" fontSize={BODY_FONT_METERS}>
            {fitText(row.value, width > 2.8 ? 34 : 22)}
          </text>
        </g>
      ))}
    </g>
  );
}

function formatSnowPsf(value: number | null): string {
  return value == null || !Number.isFinite(value) ? 'NA' : formatPsf(value, 1);
}

function fitText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
