import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectDetailsSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../pages/Projects/ProjectDetails.tsx'),
  'utf8',
);

const qcReportsPanelSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../components/planner/documents/panels/QcReportsDocumentsPanel.tsx',
  ),
  'utf8',
);

const qcRecordsSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../components/projects/QCRecords.tsx',
  ),
  'utf8',
);

const calculatorHubSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../pages/CalculatorHub.tsx'),
  'utf8',
);

describe('Project Details concrete-specific cleanup', () => {
  it('no longer renders Technical details or Placement details', () => {
    expect(projectDetailsSource).not.toContain('Technical details');
    expect(projectDetailsSource).not.toContain('Placement details');
    expect(projectDetailsSource).not.toContain('Placement conditions');
    expect(projectDetailsSource).not.toContain('MixDesignSection');
    expect(projectDetailsSource).not.toContain('CalculationSection');
    expect(projectDetailsSource).not.toContain('StrengthProgress');
  });

  it('no longer renders Labor estimate or Reinforcement cards', () => {
    expect(projectDetailsSource).not.toContain('LaborSection');
    expect(projectDetailsSource).not.toContain('ReinforcementSection');
    expect(projectDetailsSource).not.toContain('QCSection');
    expect(projectDetailsSource).not.toContain('Open Rebar Calculator');
    expect(projectDetailsSource).not.toContain('Open Concrete Labor Calculator');
  });

  it('no longer renders Slump Test or Break Result on Project Details', () => {
    expect(projectDetailsSource).not.toContain('Slump Test');
    expect(projectDetailsSource).not.toContain('Break Result');
    expect(projectDetailsSource).not.toContain('project-qc-section');
  });

  it('routes QC links to Documents QC tab', () => {
    expect(projectDetailsSource).toContain("tab: 'qc-reports'");
    expect(projectDetailsSource).toContain('documentsQcHref');
  });
});

describe('Documents QC actions', () => {
  it('renders QCReports sections with consistent documents layout copy', () => {
    expect(qcReportsPanelSource).toContain('DocumentsSectionCard');
    expect(qcReportsPanelSource).toContain('title="QC Reports"');
    expect(qcReportsPanelSource).toContain('No QC reports yet.');
    expect(qcReportsPanelSource).toContain('title="QC Checklists"');
    expect(qcReportsPanelSource).toContain('No QC checklists found.');
    expect(qcReportsPanelSource).not.toContain('DocumentsPanelFootnote');
  });

  it('renders QCRecords with Slump Test and Break Result actions', () => {
    expect(qcReportsPanelSource).toContain('QCRecords');
    expect(qcReportsPanelSource).toContain('presentation="documents"');
    expect(qcReportsPanelSource).toContain('useProjectQcRecordHandlers');
    expect(qcRecordsSource).toContain("openNewForm('fresh_test')");
    expect(qcRecordsSource).toContain("openNewForm('break_test')");
    expect(qcRecordsSource).toContain('Slump Test');
    expect(qcRecordsSource).toContain('Break Result');
  });

  it('uses documents presentation copy for concrete QC records', () => {
    expect(qcRecordsSource).toContain("presentation === 'documents'");
    expect(qcRecordsSource).toContain('Search QC records...');
    expect(qcRecordsSource).toContain('No concrete QC records found.');
    expect(qcRecordsSource).toContain('Track slump tests and concrete break results for this project.');
  });

  it('opens existing slump and break workflows through QCRecords forms', () => {
    expect(qcRecordsSource).toContain('Concrete Slump Test');
    expect(qcRecordsSource).toContain('Break Test Result');
    expect(qcRecordsSource).toContain('recordType === \'fresh_test\'');
    expect(qcRecordsSource).toContain('recordType === \'break_test\'');
  });

  it('preserves calculator routes and proposal import behavior', () => {
    expect(calculatorHubSource).toContain('/calculator/concrete');
    expect(calculatorHubSource).toContain('/calculator/reinforcement');
    expect(calculatorHubSource).toContain('/calculator/labor');
    expect(calculatorHubSource).toContain('projectHasImportablePricing');
    expect(calculatorHubSource).toContain('Continue to proposal');
  });
});
