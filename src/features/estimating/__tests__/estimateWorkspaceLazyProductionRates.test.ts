import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('EstimateWorkspace lazy production-rate loading', () => {
  it('does not statically import generated production-rate seeds in EstimateWorkspacePage', () => {
    const source = readSource('src/features/estimating/ui/EstimateWorkspacePage.tsx');
    expect(source).not.toContain('generatedProductionRateIndex');
    expect(source).not.toContain('generatedProductionRates');
    expect(source).not.toContain('GENERATED_PRODUCTION_RATE');
  });

  it('loads production-rate library through dynamic import in the loader module', () => {
    const loaderSource = readSource(
      'src/features/estimating/data/productionRates/productionRateLibraryLoader.ts',
    );
    const librarySource = readSource(
      'src/features/estimating/data/productionRates/productionRateLibrary.ts',
    );

    expect(loaderSource).toContain('./generated/generatedCanonicalProductionRateIndex');
    expect(loaderSource).toContain('./generated/generatedProductionRateIndex');
    expect(librarySource).not.toContain('./generated/generatedProductionRateIndex');
    expect(librarySource).not.toContain('./generated/generatedProductionRates');
  });

  it('lazy-loads Production Rate Library modal from the line item form', () => {
    const formSource = readSource('src/features/estimating/ui/components/EstimateManualLineItemForm.tsx');
    expect(formSource).toContain("lazy(() => import('./ProductionRateLibraryModal'))");
    expect(formSource).not.toContain("from './ProductionRateLibraryModal'");
  });

  it('lazy-loads Assembly picker modal from the activity builder panel', () => {
    const panelSource = readSource(
      'src/features/estimating/ui/components/ConstructionActivityBuilderPanel.tsx',
    );
    expect(panelSource).toContain("lazy(() => import('./AssemblyPickerModal'))");
    expect(panelSource).not.toContain("from './AssemblyPickerModal'");
  });
});
