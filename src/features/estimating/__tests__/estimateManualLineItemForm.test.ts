import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const formSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/components/EstimateManualLineItemForm.tsx',
  ),
  'utf8',
);

describe('EstimateManualLineItemForm wiring', () => {
  it('uses a searchable construction unit combobox', () => {
    expect(formSource).toContain('ConstructionUnitCombobox');
    expect(formSource).toContain('label="Unit"');
    expect(formSource).not.toContain('onChange({ ...draft, unit: event.target.value })');
  });

  it('preserves direct unit updates on the draft line', () => {
    expect(formSource).toContain('onChange={(unit) => onChange({ ...draft, unit })}');
  });

  it('renders labor help icon and definitions modal', () => {
    expect(formSource).toContain('<Info className="h-4 w-4" />');
    expect(formSource).toContain('LaborFieldDefinitionsModal');
    expect(formSource).toContain('Open labor field definitions');
  });

  it('uses tooltips for labor field labels', () => {
    expect(formSource).toContain('FieldLabelWithTooltip');
    expect(formSource).toContain("label=\"Production rate\"");
    expect(formSource).toContain("label=\"Crew size\"");
    expect(formSource).toContain("label=\"Production rate type\"");
    expect(formSource).toContain("label=\"Hours per day\"");
    expect(formSource).toContain("label=\"Labor rate\"");
    expect(formSource).toContain("label=\"Burden %\"");
    expect(formSource).toContain("label=\"Difficulty factor\"");
    expect(formSource).toContain("label=\"Location factor\"");
  });
});
