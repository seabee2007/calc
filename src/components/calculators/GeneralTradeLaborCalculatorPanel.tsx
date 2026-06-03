import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Info,
  RotateCcw,
  Save,
  FolderPlus,
  Trash2,
  Pencil,
} from 'lucide-react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import {
  DEFAULT_GENERAL_TRADE_LABOR_INPUT,
  DIFFICULTY_FACTOR_PRESETS,
  LOCATION_FACTOR_PRESETS,
  type GeneralTrade,
  type GeneralTradeLaborInput,
  type ProductionRateType,
} from '../../types/generalTradeLabor';
import {
  calculateGeneralTradeLabor,
  validateGeneralTradeLaborInput,
} from '../../utils/generalTradeLabor';
import {
  findStarterTemplate,
  getActivitiesForTrade,
  getTrades,
} from '../../data/generalTradeLaborTemplates';
import {
  deleteUserTemplate,
  listUserTemplates,
  saveUserTemplate,
  updateUserTemplate,
} from '../../utils/generalTradeLaborTemplateStorage';
import { useProjectStore } from '../../store';
import { EMPTY_PROJECT_CUSTOM_ESTIMATES } from '../../types/projectEstimate';
import type { ChangeOrderLineItem } from '../../types/changeOrder';
import { GENERAL_TRADE_LABOR_ESTIMATE_SOURCE } from '../../utils/customEstimateUtils';

type TabId = 'quick' | 'detailed' | 'saved';

const RATE_TYPE_OPTIONS: { value: ProductionRateType; label: string }[] = [
  { value: 'unitsPerLaborHour', label: 'Units per labor hour' },
  { value: 'unitsPerLaborDay', label: 'Units per labor day' },
  { value: 'laborHoursPerUnit', label: 'Labor hours per unit' },
];

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function parseNum(value: string, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

interface GeneralTradeLaborCalculatorPanelProps {
  onToast?: (msg: string, type: 'success' | 'error') => void;
}

export default function GeneralTradeLaborCalculatorPanel({
  onToast,
}: GeneralTradeLaborCalculatorPanelProps) {
  const { currentProject, saveCustomEstimates } = useProjectStore();
  const [tab, setTab] = useState<TabId>('quick');
  const [input, setInput] = useState<GeneralTradeLaborInput>({
    ...DEFAULT_GENERAL_TRADE_LABOR_INPUT,
  });
  const [userTemplates, setUserTemplates] = useState(listUserTemplates());
  const [selectedSavedId, setSelectedSavedId] = useState('');
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [editSavedName, setEditSavedName] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  const trades = getTrades();
  const activities = input.trade ? getActivitiesForTrade(input.trade as GeneralTrade) : [];

  const setField = useCallback(
    <K extends keyof GeneralTradeLaborInput>(key: K, value: GeneralTradeLaborInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const validationErrors = useMemo(() => validateGeneralTradeLaborInput(input), [input]);

  const result = useMemo(() => {
    if (validationErrors.length > 0) return null;
    return calculateGeneralTradeLabor(input);
  }, [input, validationErrors]);

  const refreshUserTemplates = () => setUserTemplates(listUserTemplates());

  const handleTradeChange = (trade: string) => {
    setField('trade', trade as GeneralTrade | '');
    setField('activity', '');
  };

  const handleActivityChange = (activity: string) => {
    setField('activity', activity);
    if (!input.trade) return;
    const starter = findStarterTemplate(input.trade as GeneralTrade, activity);
    if (!starter) return;
    setInput((prev) => ({
      ...prev,
      activity,
      unit: starter.unit,
      productionRate: starter.productionRate,
      productionRateType: starter.productionRateType,
      crewSize: starter.defaultCrewSize,
      laborRate: starter.defaultLaborRate,
    }));
  };

  const handleReset = () => {
    setInput({ ...DEFAULT_GENERAL_TRADE_LABOR_INPUT });
    setSelectedSavedId('');
    setEditingSavedId(null);
  };

  const handleSaveTemplate = () => {
    const name = window.prompt('Template name');
    if (!name?.trim()) return;
    saveUserTemplate(name, input);
    refreshUserTemplates();
    onToast?.('Template saved', 'success');
  };

  const handleLoadSaved = (id: string) => {
    const t = userTemplates.find((u) => u.id === id);
    if (!t) return;
    setSelectedSavedId(id);
    setInput({ ...t.snapshot });
    setTab('quick');
  };

  const handleDeleteSaved = (id: string) => {
    if (!window.confirm('Delete this saved template?')) return;
    deleteUserTemplate(id);
    refreshUserTemplates();
    if (selectedSavedId === id) setSelectedSavedId('');
    onToast?.('Template deleted', 'success');
  };

  const handleUpdateSavedSnapshot = (id: string) => {
    updateUserTemplate(id, { snapshot: input });
    refreshUserTemplates();
    onToast?.('Template updated with current values', 'success');
  };

  const handleAddToProject = async () => {
    if (!currentProject || !result) return;
    setSavingProject(true);
    try {
      const existing = currentProject.customEstimates ?? EMPTY_PROJECT_CUSTOM_ESTIMATES;
      const line: ChangeOrderLineItem = {
        description: `${input.trade} — ${input.activity}`,
        qty: input.quantity,
        unit: input.unit || undefined,
        unitPrice: result.costPerUnit,
        amount: result.totalLaborPrice,
        source: GENERAL_TRADE_LABOR_ESTIMATE_SOURCE,
      };
      await saveCustomEstimates(currentProject.id, {
        ...existing,
        laborItems: [...existing.laborItems, line],
      });
      onToast?.(`Labor line added to ${currentProject.name}`, 'success');
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : 'Failed to add to project',
        'error',
      );
    } finally {
      setSavingProject(false);
    }
  };

  useEffect(() => {
    refreshUserTemplates();
  }, []);

  const assumptionsText = useMemo(() => {
    if (!result) return null;
    const rateLabel =
      RATE_TYPE_OPTIONS.find((o) => o.value === input.productionRateType)?.label ??
      input.productionRateType;
    return [
      `Base hours from ${input.quantity} ${input.unit} at ${input.productionRate} (${rateLabel}).`,
      `Adjusted hours = base × difficulty (${input.difficultyFactor}) × location (${input.locationFactor}).`,
      `Labor cost = adjusted hours × $${input.laborRate}/hr; burden ${input.burdenPercent}%; overhead ${input.overheadPercent}% on subtotal; profit ${input.profitPercent}% on subtotal + overhead.`,
      `Crew days = adjusted hours ÷ (crew ${input.crewSize} × ${input.hoursPerDay} hrs/day).`,
    ].join(' ');
  }, [input, result]);

  const renderFormFields = (mode: 'quick' | 'detailed') => (
    <div className="space-y-4">
      <Select
        label="Trade"
        options={[
          { value: '', label: 'Select trade…' },
          ...trades.map((t) => ({ value: t, label: t })),
        ]}
        value={input.trade}
        onChange={handleTradeChange}
      />
      <Select
        label="Activity"
        options={[
          { value: '', label: 'Select activity…' },
          ...activities.map((a) => ({ value: a, label: a })),
        ]}
        value={input.activity}
        onChange={handleActivityChange}
        disabled={!input.trade}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Quantity"
          type="number"
          min={0}
          value={input.quantity || ''}
          onChange={(e) => setField('quantity', parseNum(e.target.value))}
        />
        <Input
          label="Unit"
          value={input.unit}
          onChange={(e) => setField('unit', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Production rate"
          type="number"
          min={0}
          step="any"
          value={input.productionRate || ''}
          onChange={(e) => setField('productionRate', parseNum(e.target.value))}
        />
        <Select
          label="Production rate type"
          options={RATE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={input.productionRateType}
          onChange={(v) => setField('productionRateType', v as ProductionRateType)}
        />
      </div>
      <Input
        label="Hourly labor rate ($)"
        type="number"
        min={0}
        value={input.laborRate || ''}
        onChange={(e) => setField('laborRate', parseNum(e.target.value))}
      />
      <Select
        label="Difficulty factor"
        options={DIFFICULTY_FACTOR_PRESETS.map((p) => ({
          value: String(p.value),
          label: `${p.label} (${p.value})`,
        }))}
        value={String(input.difficultyFactor)}
        onChange={(v) => setField('difficultyFactor', parseNum(v, 1))}
      />
      {mode === 'detailed' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Crew size"
              type="number"
              min={1}
              value={input.crewSize || ''}
              onChange={(e) => setField('crewSize', parseNum(e.target.value, 2))}
            />
            <Input
              label="Hours per day"
              type="number"
              min={1}
              value={input.hoursPerDay || ''}
              onChange={(e) => setField('hoursPerDay', parseNum(e.target.value, 8))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Burden %"
              type="number"
              min={0}
              value={input.burdenPercent || ''}
              onChange={(e) => setField('burdenPercent', parseNum(e.target.value))}
            />
            <Input
              label="Overhead %"
              type="number"
              min={0}
              value={input.overheadPercent || ''}
              onChange={(e) => setField('overheadPercent', parseNum(e.target.value))}
            />
            <Input
              label="Profit %"
              type="number"
              min={0}
              value={input.profitPercent || ''}
              onChange={(e) => setField('profitPercent', parseNum(e.target.value))}
            />
          </div>
          <Select
            label="Location factor"
            options={LOCATION_FACTOR_PRESETS.map((p) => ({
              value: String(p.value),
              label: `${p.label} (${p.value})`,
            }))}
            value={String(input.locationFactor)}
            onChange={(v) => setField('locationFactor', parseNum(v, 1))}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-gray-300">
              Notes
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              rows={3}
              value={input.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Scope notes, access constraints, etc."
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
        <span className="font-medium">Concrete work?</span>{' '}
        Use the{' '}
        <Link
          to="/calculator/labor"
          className="font-semibold text-cyan-700 underline dark:text-cyan-400"
        >
          Concrete Labor Calculator
        </Link>{' '}
        for placement and finishing labor.
      </div>

      <p className="text-xs text-slate-500 dark:text-gray-400">
        Production rates are starter estimates. Verify with company history, RSMeans, local labor
        conditions, and field performance.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-slate-200/70 pb-2 dark:border-gray-700">
            {(
              [
                { id: 'quick' as const, label: 'Quick Estimate' },
                { id: 'detailed' as const, label: 'Detailed Estimate' },
                { id: 'saved' as const, label: 'Saved Templates' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          <Card className="p-5">
            {tab === 'saved' ? (
              <div className="space-y-3">
                {userTemplates.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    No saved templates yet. Configure an estimate and use Save template.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {userTemplates.map((t) => (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-slate-50/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/50"
                      >
                        {editingSavedId === t.id ? (
                          <Input
                            value={editSavedName}
                            onChange={(e) => setEditSavedName(e.target.value)}
                            className="flex-1 min-w-[120px]"
                          />
                        ) : (
                          <button
                            type="button"
                            className="text-left text-sm font-medium text-slate-800 dark:text-gray-100"
                            onClick={() => handleLoadSaved(t.id)}
                          >
                            {t.name}
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {t.snapshot.trade} — {t.snapshot.activity}
                            </span>
                          </button>
                        )}
                        <div className="flex gap-1">
                          {editingSavedId === t.id ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                updateUserTemplate(t.id, { name: editSavedName });
                                refreshUserTemplates();
                                setEditingSavedId(null);
                              }}
                            >
                              Save name
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingSavedId(t.id);
                                  setEditSavedName(t.name);
                                }}
                                aria-label="Edit name"
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateSavedSnapshot(t.id)}
                              >
                                Update values
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteSaved(t.id)}
                                aria-label="Delete"
                              >
                                <Trash2 size={14} className="text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedSavedId && (
                  <p className="text-xs text-slate-500">
                    Loaded template — switch to Quick or Detailed to edit and recalculate.
                  </p>
                )}
              </div>
            ) : (
              renderFormFields(tab)
            )}
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleReset} icon={<RotateCcw size={16} />}>
              Reset
            </Button>
            <Button variant="secondary" onClick={handleSaveTemplate} icon={<Save size={16} />}>
              Save template
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleAddToProject()}
              disabled={!currentProject || !result || savingProject}
              icon={<FolderPlus size={16} />}
            >
              Add to project
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {validationErrors.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <ul className="list-disc pl-4">
                {validationErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Labor Hours',
                value: result ? formatNum(result.adjustedLaborHours) : '—',
              },
              {
                label: 'Crew Days',
                value: result ? formatNum(result.crewDays) : '—',
              },
              {
                label: 'Labor Cost',
                value: result ? formatMoney(result.subtotalLaborCost) : '—',
              },
              {
                label: 'Total Labor Price',
                value: result ? formatMoney(result.totalLaborPrice) : '—',
                highlight: true,
              },
            ].map(({ label, value, highlight }) => (
              <Card
                key={label}
                className={[
                  'p-4',
                  highlight ? 'col-span-2 border-cyan-300/60 bg-cyan-50/30 dark:border-cyan-700/50 dark:bg-cyan-950/20' : '',
                ].join(' ')}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  {label}
                </p>
                <p
                  className={[
                    'mt-1 font-bold text-slate-900 dark:text-white',
                    highlight ? 'text-2xl' : 'text-lg',
                  ].join(' ')}
                >
                  {value}
                </p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">
              Labor breakdown
            </h3>
            {result ? (
              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ['Base labor hours', formatNum(result.baseLaborHours)],
                  ['Adjusted labor hours', formatNum(result.adjustedLaborHours)],
                  ['Base labor cost', formatMoney(result.baseLaborCost)],
                  ['Labor burden', formatMoney(result.burdenCost)],
                  ['Subtotal labor', formatMoney(result.subtotalLaborCost)],
                  ['Overhead', formatMoney(result.overhead)],
                  ['Profit', formatMoney(result.profit)],
                  ['Cost per unit', formatMoney(result.costPerUnit)],
                  ['Labor hrs / unit', formatNum(result.laborHoursPerUnit, 4)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-gray-400">{k}</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
                Enter valid inputs to see breakdown.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                  Assumptions
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                  {assumptionsText ??
                    'Complete trade, activity, quantity, and production rate to generate assumptions.'}
                </p>
              </div>
            </div>
          </Card>

          {!currentProject && (
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Select a project above to add this estimate as a custom labor line.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
