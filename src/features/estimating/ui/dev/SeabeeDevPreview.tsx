/**
 * /dev/seabee-preview — Assembly picker and rollup preview.
 *
 * DEV-ONLY route. Not behind auth, not linked from nav, no database save.
 * Purpose: prove that the assembly library and instantiation layer work
 * end-to-end before wiring into the live estimator.
 *
 * M1/M2 Gate check:
 *   1. Select Division 31 — Clear and Grub Site → enter acres → preview MH/duration
 *   2. Select Division 31 — Excavate Footings → enter CYD → preview
 *   3. Select Division 03 — Place Continuous Footing → enter SF/Ton/CYD → preview
 *   4. Select Division 03 — Place Slab on Grade → enter 2,000 SF → preview
 */
import React, { useState, useCallback, useMemo } from 'react';
import { SEABEE_ASSEMBLY_GROUPS, SEABEE_ASSEMBLY_BY_ID } from '../../data/seabeeAssemblyRegistry';
import {
  SEABEE_DIVISION_03_ALL_PRODUCTION_RATES,
  SEABEE_DIVISION_03_CONCRETE,
  SEABEE_CONTINUOUS_FOOTING_LINE_ITEMS,
  SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../../data/seabeeConcreteSeeds';
import {
  SEABEE_DIVISION_31_EARTHWORK,
  SEABEE_DIVISION_31_PRODUCTION_RATES,
  SEABEE_CLEAR_AND_GRUB_LINE_ITEMS,
  SEABEE_EXCAVATE_FOOTINGS_LINE_ITEMS,
  SEABEE_BACKFILL_AND_COMPACT_LINE_ITEMS,
} from '../../data/seabeeEarthworkSeeds';
import { instantiateFromAssemblySpec, type AssemblyInstantiationResult } from '../../domain/seabeeAssemblyInstantiation';
import type { ActivityLineItemTemplate, EstimateDivision, ProductionRate } from '../../domain/seabeeActivityTypes';
import type { ActivityAssemblySpec } from '../../domain/seabeeAssemblyTypes';

// ── Data maps ─────────────────────────────────────────────────────────────────

const DIVISION_MAP = new Map<string, EstimateDivision>([
  ['03', SEABEE_DIVISION_03_CONCRETE],
  ['31', SEABEE_DIVISION_31_EARTHWORK],
]);

const RATE_MAP = new Map<string, ProductionRate>([
  ...SEABEE_DIVISION_03_ALL_PRODUCTION_RATES.map((r): [string, ProductionRate] => [r.id, r]),
  ...SEABEE_DIVISION_31_PRODUCTION_RATES.map((r): [string, ProductionRate] => [r.id, r]),
]);

// Map assembly ID → its line item templates
const LINE_ITEM_MAP = new Map<string, readonly ActivityLineItemTemplate[]>([
  ['asm-03-place-slab-on-grade', SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS],
  ['asm-03-place-continuous-footing', SEABEE_CONTINUOUS_FOOTING_LINE_ITEMS],
  ['asm-31-clear-and-grub', SEABEE_CLEAR_AND_GRUB_LINE_ITEMS],
  ['asm-31-excavate-footings', SEABEE_EXCAVATE_FOOTINGS_LINE_ITEMS],
  ['asm-31-backfill-compact', SEABEE_BACKFILL_AND_COMPACT_LINE_ITEMS],
]);

// ── Sub-components ────────────────────────────────────────────────────────────

interface InputFieldProps {
  spec: ActivityAssemblySpec['quantityInputs'][number];
  value: string;
  onChange: (id: string, value: string) => void;
}

function InputField({ spec, value, onChange }: InputFieldProps) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {spec.label}
        <span className="ml-1 text-xs text-gray-500">({spec.unit})</span>
      </label>
      {spec.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{spec.description}</p>
      )}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(spec.id, e.target.value)}
          placeholder={spec.defaultValue?.toString() ?? '0'}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400 shrink-0">{spec.unit}</span>
      </div>
      {spec.formulaHint && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">{spec.formulaHint}</p>
      )}
    </div>
  );
}

interface RollupPanelProps {
  result: AssemblyInstantiationResult;
  assembly: ActivityAssemblySpec;
}

function RollupPanel({ result, assembly }: RollupPanelProps) {
  const r = result.rollup;
  const warn = result.rollup.warnings.filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Activity header */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <div className="text-xs font-mono text-blue-600 dark:text-blue-400">
          {assembly.divisionCode} — {assembly.displayName}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
          {assembly.description}
        </div>
      </div>

      {/* Rollup numbers */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Man-Hours" value={r.totalManHours.toFixed(2)} unit="MH" />
        <StatCard label="Total Man-Days" value={r.totalManDays.toFixed(2)} unit="MD" />
        <StatCard label="Calculated Duration" value={`${r.calculatedDurationDays}`} unit="days" />
        <StatCard label="Effective Duration" value={`${r.effectiveDurationDays}`} unit="days" />
      </div>

      {/* Line items */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Line Items ({result.projectLineItems.length})
        </h3>
        <div className="space-y-1">
          {result.projectLineItems.map((li) => (
            <div
              key={li.id}
              className="flex justify-between items-center text-xs bg-gray-50 dark:bg-gray-800 rounded px-3 py-2"
            >
              <span className="text-gray-700 dark:text-gray-300 font-medium flex-1 mr-2">
                {li.name}
              </span>
              <span className="text-gray-500 shrink-0">
                {li.quantity.toLocaleString()} {li.unit}
              </span>
              <span className="text-blue-600 dark:text-blue-400 ml-3 shrink-0 font-mono">
                {li.calculatedManHours.toFixed(2)} MH
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {warn.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
            Warnings ({warn.length})
          </p>
          <ul className="space-y-0.5">
            {warn.map((w, i) => (
              <li key={i} className="text-xs text-amber-700 dark:text-amber-300">
                • {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{unit}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SeabeeDevPreview() {
  const [selectedDivision, setSelectedDivision] = useState<string>('31');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>('asm-31-clear-and-grub');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const assembliesForDivision = useMemo(
    () => SEABEE_ASSEMBLY_GROUPS.find((g) => g.divisionCode === selectedDivision)?.assemblies ?? [],
    [selectedDivision],
  );

  const assembly = useMemo(
    () => SEABEE_ASSEMBLY_BY_ID.get(selectedAssemblyId),
    [selectedAssemblyId],
  );

  const result = useMemo<AssemblyInstantiationResult | null>(() => {
    if (!assembly) return null;

    const division = DIVISION_MAP.get(assembly.divisionCode);
    const lineItemTemplates = LINE_ITEM_MAP.get(assembly.id);
    if (!division || !lineItemTemplates) return null;

    const userInputs: Record<string, number> = {};
    for (const spec of assembly.quantityInputs) {
      const raw = inputValues[spec.id];
      const parsed = raw !== undefined && raw !== '' ? parseFloat(raw) : (spec.defaultValue ?? 0);
      userInputs[spec.id] = isNaN(parsed) ? 0 : parsed;
    }

    return instantiateFromAssemblySpec({
      assembly,
      userInputs,
      division,
      lineItemTemplates,
      productionRates: RATE_MAP,
      projectId: 'dev-preview',
    });
  }, [assembly, inputValues]);

  const handleDivisionChange = useCallback((div: string) => {
    setSelectedDivision(div);
    const firstAssembly = SEABEE_ASSEMBLY_GROUPS.find((g) => g.divisionCode === div)?.assemblies[0];
    if (firstAssembly) {
      setSelectedAssemblyId(firstAssembly.id);
      setInputValues({});
    }
  }, []);

  const handleAssemblyChange = useCallback((id: string) => {
    setSelectedAssemblyId(id);
    setInputValues({});
  }, []);

  const handleInputChange = useCallback((id: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-semibold px-2 py-0.5 rounded">
            DEV ONLY
          </span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Seabee Assembly Preview
          </h1>
          <span className="text-sm text-gray-500">/ dev / seabee-preview</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Assembly picker + instantiation preview. No save. No database. M1/M2 gate check.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: selectors + inputs */}
        <div className="md:col-span-1 space-y-4">
          {/* Division selector */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Division
            </h2>
            <div className="space-y-1">
              {SEABEE_ASSEMBLY_GROUPS.map((g) => (
                <button
                  key={g.divisionCode}
                  onClick={() => handleDivisionChange(g.divisionCode)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedDivision === g.divisionCode
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="font-mono text-xs mr-2">{g.divisionCode}</span>
                  {g.divisionName}
                </button>
              ))}
            </div>
          </div>

          {/* Assembly selector */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Activity Assembly
            </h2>
            <div className="space-y-1">
              {assembliesForDivision.map((asm) => (
                <button
                  key={asm.id}
                  onClick={() => handleAssemblyChange(asm.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedAssemblyId === asm.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {asm.displayName}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity inputs */}
          {assembly && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Quantities
              </h2>
              {assembly.quantityInputs.map((spec) => (
                <InputField
                  key={spec.id}
                  spec={spec}
                  value={inputValues[spec.id] ?? ''}
                  onChange={handleInputChange}
                />
              ))}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                <p>Crew: {assembly.defaultCrewSize} personnel</p>
                <p>Hours/day: {assembly.defaultHoursPerDay}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: rollup */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm h-full">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Rollup Preview
            </h2>
            {result && assembly ? (
              <RollupPanel result={result} assembly={assembly} />
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Select an assembly to see the rollup.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* M1/M2 Gate checklist */}
      <div className="max-w-6xl mx-auto mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            M1/M2 Gate Checklist — 2,000 SF House Foundation Package
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { div: '31', asm: 'asm-31-clear-and-grub', label: 'Clear & Grub', inputs: { siteAcres: 0.1 } },
              { div: '31', asm: 'asm-31-excavate-footings', label: 'Excavate Footings', inputs: { excavationCyd: 7.4, backfillCyd: 2.0 } },
              { div: '03', asm: 'asm-03-place-continuous-footing', label: 'Place Footing', inputs: { footingContactSf: 600, footingRebarTon: 0.31, footingConcreteCyd: 7.4 } },
              { div: '03', asm: 'asm-03-place-slab-on-grade', label: 'Place Slab', inputs: { slabAreaSf: 2000, slabConcreteCyd: 24.7, slabPerimeterLf: 180, controlJointLf: 250 } },
            ].map((item) => {
              const asm = SEABEE_ASSEMBLY_BY_ID.get(item.asm);
              const division = DIVISION_MAP.get(item.div);
              const lineItems = LINE_ITEM_MAP.get(item.asm);
              if (!asm || !division || !lineItems) return null;

              const r = instantiateFromAssemblySpec({
                assembly: asm,
                userInputs: item.inputs,
                division,
                lineItemTemplates: lineItems,
                productionRates: RATE_MAP,
                projectId: 'gate-check',
              });

              const pass = r.rollup.totalManHours > 0 && r.rollup.warnings.length === 0;
              return (
                <div
                  key={item.asm}
                  className={`rounded-lg p-3 border text-center ${
                    pass
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  }`}
                >
                  <div className={`text-lg font-bold mb-1 ${pass ? 'text-green-600' : 'text-red-600'}`}>
                    {pass ? '✓' : '✗'}
                  </div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{item.label}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {r.rollup.totalManHours.toFixed(1)} MH / {r.rollup.calculatedDurationDays}d
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
