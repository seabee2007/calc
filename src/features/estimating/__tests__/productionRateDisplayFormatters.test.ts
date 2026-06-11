import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import type { ProjectActivityLineItem } from '../domain/constructionActivityTypes';
import {
  formatActivityLineItemReference,
  formatProductionRateDisplayTitle,
  formatProductionRateSubtitle,
  formatProductionRateWorkElementLabel,
  parseWorkElementFromProductionRateKey,
  stripSourceMetadataFromDisplayText,
} from '../data/productionRates/productionRateDisplayFormatters';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function sampleRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: '08-08-91-19.10-0030',
    divisionCode: '08',
    divisionName: 'Openings',
    figure: 'Figure 5-H-7',
    figureTitle: 'Louvers',
    sourcePage: '5-H-7',
    sourcePdfPage: 120,
    workElementNumber: '08 91 19.10',
    workElementLineNumber: '0030',
    activityName: 'Aluminum louver, 24 by 30 inches, maximum (Figure 5-H-7)',
    unitOfMeasure: 'Each',
    manHoursPerUnit: 0.709,
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['louver'],
    canonicalTitle: 'Aluminum Louver, 24 by 30 Inches, Maximum (Figure 5-H-7)',
    ...overrides,
  };
}

describe('productionRateDisplayFormatters', () => {
  it('strips figure and page fragments from display titles', () => {
    expect(stripSourceMetadataFromDisplayText('Threshold weatherstrip (Figure 5-H-1)')).toBe(
      'Threshold weatherstrip',
    );
    expect(stripSourceMetadataFromDisplayText('Edge forms p.5-C-7 crew — 5 laborers')).toBe(
      'Edge forms',
    );
  });

  it('formats clean contractor-facing title and subtitle', () => {
    const rate = sampleRate();
    expect(formatProductionRateDisplayTitle(rate)).toBe(
      'Aluminum Louver, 24 by 30 Inches, Maximum',
    );
    expect(formatProductionRateWorkElementLabel(rate)).toBe('08 91 19.10');
    expect(formatProductionRateSubtitle(rate)).toBe(
      'Work Element 08 91 19.10 · Line 0030 · 0.709 MH/Each',
    );
  });

  it('parses work element number from production rate key when field missing', () => {
    expect(parseWorkElementFromProductionRateKey('03-11-13.65-0040')).toEqual({
      workElementNumber: '03 11 13.65',
      workElementLineNumber: '0040',
    });
    expect(parseWorkElementFromProductionRateKey('08-08-71-25.10-0030')).toEqual({
      workElementNumber: '08 71 25.10',
      workElementLineNumber: '0030',
    });
  });

  it('formats activity line item reference from preserved key without figure/page', () => {
    const item = {
      pricingSource: 'project_rate',
      sourceProductionRateKey: '08-08-91-19.10-0030',
      sourceFigure: 'Figure 5-H-7',
      sourcePage: '5-H-7',
      sourcePdfPage: 120,
    } as ProjectActivityLineItem;

    expect(formatActivityLineItemReference(item)).toBe('Work Element 08 91 19.10 · Line 0030');
    expect(formatActivityLineItemReference(item)).not.toContain('Figure');
    expect(formatActivityLineItemReference(item)).not.toContain('p.5');
  });
});

describe('customer-facing production rate UI sources', () => {
  it('library modal uses work-element subtitle formatter instead of figure/page summary', () => {
    const source = readSource('src/features/estimating/ui/components/ProductionRateLibraryModal.tsx');
    expect(source).toContain('formatProductionRateSubtitle');
    expect(source).not.toMatch(/entry\.figure.*Page \$\{entry\.sourcePage\}/);
  });

  it('assembly picker row uses subtitle formatter and hides source details by default', () => {
    const source = readSource('src/features/estimating/ui/components/AssemblyPickerModal.tsx');
    expect(source).toContain('formatProductionRateSubtitle');
    expect(source).not.toMatch(/item\.rate\.figure.*sourcePage/);
    expect(source).toMatch(/showDevSourceDetails/);
  });

  it('activity line item row focuses on work element and labor role without source details', () => {
    const source = readSource('src/features/estimating/ui/components/ActivityLineItemRow.tsx');
    expect(source).toContain('laborRoleLabel');
    expect(source).toContain('Missing labor rate');
    expect(source).not.toContain('formatActivityLineItemReference');
    expect(source).not.toMatch(/sourceFigure.*sourcePage/);
  });

  it('manual line item form shows work element reference only', () => {
    const source = readSource('src/features/estimating/ui/components/EstimateManualLineItemForm.tsx');
    expect(source).toContain('parseWorkElementFromProductionRateKey');
    expect(source).not.toMatch(/productionRateSourceFigure.*productionRateSourcePage/);
  });

  it('source details dropdown is dev-gated and disabled by default', () => {
    const source = readSource('src/features/estimating/ui/components/ProductionRateCanonicalControls.tsx');
    expect(source).toContain('import.meta.env.DEV');
    expect(source).toContain('enabled = false');
  });
});
