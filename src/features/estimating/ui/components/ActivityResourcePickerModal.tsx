/**
 * Resource Picker Modal — Materials & Equipment.
 *
 * Three tabs:
 *   1. Starter Library — static Arden seed items (editable defaults; verify local pricing)
 *   2. My Library     — user's company cost library (CompanyCostLibrarySection)
 *   3. Manual Entry   — free-form entry
 *
 * After the user selects/fills an item, they confirm quantity and unit cost before saving.
 */
import { useState, useMemo } from 'react';
import { Search, Info } from 'lucide-react';
import ModalShell from '../../../../components/ui/ModalShell';
import {
  BORDER_DEFAULT, TEXT_BODY, TEXT_MUTED, TEXT_FOREGROUND, TEXT_SUBTLE,
} from '../../../../theme/appTheme';
import type {
  ActivityResourceBase,
  ActivityResourceProvider,
  ActivityResourceSnapshot,
  CompanyCostLibraryItem,
} from '../../domain/constructionActivityTypes';
import type { StarterCostLibraryItem } from '../../data/starterCostLibrary/starterCostLibraryTypes';
import {
  searchStarterCostLibrary,
  getStarterCategories,
} from '../../data/starterCostLibrary/starterCostLibraryIndex';
import { CompanyCostLibrarySection } from './CompanyCostLibrarySection';
import type { AddResourceInput } from '../../application/activityResourceService';
import {
  DEFAULT_RESOURCE_QUANTITY,
  resolveImportedResourceDefaultQuantity,
} from './activityResourcePickerDefaults';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'starter' | 'my_library' | 'manual';

interface ConfirmState {
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  unit: string;
  quantity: string;
  unitCost: string;
  sourceProvider: ActivityResourceProvider;
  sourceSnapshot?: ActivityResourceSnapshot;
  sourceId?: string;
  saveToLibrary: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  resourceType: 'material' | 'equipment';
  activityId: string;
  projectId: string;
  existingResources?: readonly ActivityResourceBase[];
  onSave: (input: AddResourceInput) => Promise<{ error: string | null }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSnapshot(item: StarterCostLibraryItem): ActivityResourceSnapshot {
  return {
    sourceName: 'Arden Starter Library',
    originalName: item.name,
    originalUnit: item.unit,
    originalDefaultUnitCost: item.defaultUnitCost,
    category: item.category,
    subcategory: item.subcategory,
    csiDivision: item.csiDivision,
    csiSection: item.csiSection,
    notes: item.notes,
    selectedAt: new Date().toISOString(),
  };
}

function buildSnapshotFromLibrary(item: CompanyCostLibraryItem): ActivityResourceSnapshot {
  return {
    sourceName: 'My Library',
    originalName: item.name,
    originalUnit: item.unit,
    originalDefaultUnitCost: item.defaultUnitCost,
    category: item.category,
    subcategory: item.subcategory,
    notes: item.notes,
    selectedAt: new Date().toISOString(),
  };
}

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

const RESOURCE_LABEL = { material: 'Material', equipment: 'Equipment' } as const;

// ---------------------------------------------------------------------------
// Confirm form (shared between all tabs)
// ---------------------------------------------------------------------------

interface ConfirmFormProps {
  state: ConfirmState;
  onChange: (patch: Partial<ConfirmState>) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  saveError: string | null;
  isStarterItem: boolean;
}

function ConfirmForm({ state, onChange, onSave, onBack, saving, saveError, isStarterItem }: ConfirmFormProps) {
  const previewTotal = Math.max(0, parseFloat(state.quantity) || 0) * Math.max(0, parseFloat(state.unitCost) || 0);

  return (
    <div className="space-y-4">
      {isStarterItem && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-900/20 border border-amber-700/40 px-3 py-2.5 text-xs text-amber-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Starter items are editable defaults. Verify local pricing before submitting proposals.</span>
        </div>
      )}

      <div>
        <label className={`block text-xs font-medium ${TEXT_MUTED} mb-1`}>Name</label>
        <input
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={`block text-xs font-medium ${TEXT_MUTED} mb-1`}>Quantity</label>
          <input
            type="number"
            min="0"
            step="any"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            value={state.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </div>
        <div>
          <label className={`block text-xs font-medium ${TEXT_MUTED} mb-1`}>Unit</label>
          <input
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            value={state.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className={`block text-xs font-medium ${TEXT_MUTED} mb-1`}>Unit Cost ($)</label>
        <input
          type="number"
          min="0"
          step="any"
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
          value={state.unitCost}
          onChange={(e) => onChange({ unitCost: e.target.value })}
          placeholder={isStarterItem ? 'Enter your local price' : '0.00'}
        />
      </div>

      {previewTotal > 0 && (
        <div className={`flex items-center justify-between rounded-lg border ${BORDER_DEFAULT} px-3 py-2`}>
          <span className={`text-xs ${TEXT_MUTED}`}>Line total</span>
          <span className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{formatMoney(previewTotal)}</span>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={state.saveToLibrary}
          onChange={(e) => onChange({ saveToLibrary: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-700 text-cyan-500"
        />
        <span className={`text-xs ${TEXT_MUTED}`}>Save to My Library for reuse</span>
      </label>

      {saveError && (
        <p className="text-xs text-red-400">{saveError}</p>
      )}

      <div className="flex justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className={`text-sm ${TEXT_MUTED} hover:text-slate-200 transition-colors`}
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={saving || !state.name.trim()}
          onClick={onSave}
          className="rounded-md bg-cyan-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Add to activity'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function ActivityResourcePickerModal({
  isOpen,
  onClose,
  resourceType,
  activityId,
  projectId,
  existingResources = [],
  onSave,
}: Props) {
  const label = RESOURCE_LABEL[resourceType];
  const [tab, setTab] = useState<Tab>('starter');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const starterItems = useMemo(
    () => searchStarterCostLibrary(query, resourceType),
    [query, resourceType],
  );

  const starterCategories = useMemo(() => getStarterCategories(resourceType), [resourceType]);

  const filteredStarter = selectedCategory
    ? starterItems.filter((item) => item.category === selectedCategory)
    : starterItems;

  function handleClose() {
    setConfirm(null);
    setQuery('');
    setSelectedCategory('');
    setSaveError(null);
    onClose();
  }

  function selectStarterItem(item: StarterCostLibraryItem) {
    setConfirm({
      name: item.name,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
      unit: item.unit,
      quantity: resolveImportedResourceDefaultQuantity({
        itemName: item.name,
        itemUnit: item.unit,
        itemCategory: item.category,
        itemSubcategory: item.subcategory,
        existingResources,
      }),
      unitCost: item.defaultUnitCost > 0 ? String(item.defaultUnitCost) : '',
      sourceProvider: 'arden_starter',
      sourceSnapshot: buildSnapshot(item),
      sourceId: item.id,
      saveToLibrary: false,
    });
  }

  function selectLibraryItem(item: CompanyCostLibraryItem) {
    setConfirm({
      name: item.name,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
      unit: item.unit,
      quantity: resolveImportedResourceDefaultQuantity({
        itemName: item.name,
        itemUnit: item.unit,
        itemCategory: item.category,
        itemSubcategory: item.subcategory,
        existingResources,
      }),
      unitCost: item.defaultUnitCost > 0 ? String(item.defaultUnitCost) : '',
      sourceProvider: 'company_library',
      sourceSnapshot: buildSnapshotFromLibrary(item),
      companyLibraryItemId: item.id,
      saveToLibrary: false,
    });
  }

  function openManualEntry() {
    setConfirm({
      name: '',
      unit: resourceType === 'equipment' ? 'day' : 'EA',
      quantity: DEFAULT_RESOURCE_QUANTITY,
      unitCost: '',
      sourceProvider: 'manual',
      saveToLibrary: false,
    });
  }

  async function handleSave() {
    if (!confirm) return;
    const quantity = Math.max(0, parseFloat(confirm.quantity) || 0);
    const unitCost = Math.max(0, parseFloat(confirm.unitCost) || 0);
    if (!confirm.name.trim()) return;

    setSaving(true);
    setSaveError(null);

    const input: AddResourceInput = {
      activityId,
      projectId,
      name: confirm.name.trim(),
      description: confirm.description,
      category: confirm.category,
      subcategory: confirm.subcategory,
      quantity,
      unit: confirm.unit,
      unitCost,
      sourceProvider: confirm.sourceProvider,
      sourceSnapshot: confirm.sourceSnapshot,
      sourceId: confirm.sourceId,
      companyLibraryItemId: (confirm as { companyLibraryItemId?: string }).companyLibraryItemId,
      saveToCompanyLibrary: confirm.saveToLibrary,
    };

    const { error } = await onSave(input);
    setSaving(false);

    if (error) {
      setSaveError(error);
    } else {
      handleClose();
    }
  }

  const isStarterItem = confirm?.sourceProvider === 'arden_starter';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title={`Add ${label}`}
      size="lg"
    >
      {confirm ? (
        <ConfirmForm
          state={confirm}
          onChange={(patch) => setConfirm((s) => s ? { ...s, ...patch } : s)}
          onSave={() => void handleSave()}
          onBack={() => { setConfirm(null); setSaveError(null); }}
          saving={saving}
          saveError={saveError}
          isStarterItem={isStarterItem ?? false}
        />
      ) : (
        <div className="space-y-4">
          {/* Tab bar */}
          <div className={`flex gap-1 rounded-lg border ${BORDER_DEFAULT} bg-slate-900/40 p-1`}>
            {(['starter', 'my_library', 'manual'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t
                    ? 'bg-slate-700 text-slate-100'
                    : `text-slate-400 hover:text-slate-200`
                }`}
              >
                {t === 'starter' ? 'Starter Library' : t === 'my_library' ? 'My Library' : 'Manual Entry'}
              </button>
            ))}
          </div>

          {tab === 'starter' && (
            <div className="space-y-3">
              {/* Search + category filter */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />                <input
                  className="w-full rounded-md border border-slate-600 bg-slate-800 py-1.5 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  placeholder={`Search ${label.toLowerCase()} items…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {starterCategories.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                      !selectedCategory
                        ? 'bg-cyan-700 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    All
                  </button>
                  {starterCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                      className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                        selectedCategory === cat
                          ? 'bg-cyan-700 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-700/50">
                {filteredStarter.length === 0 ? (
                  <div className="py-8 text-center">
                    <Search className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                    <p className={`text-sm ${TEXT_SUBTLE}`}>No items match your search.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-700/40">
                    {filteredStarter.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-800/30">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${TEXT_FOREGROUND} truncate`}>{item.name}</p>
                          <p className={`text-xs ${TEXT_MUTED} mt-0.5`}>
                            {item.unit} · {item.subcategory}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectStarterItem(item)}
                          className="shrink-0 rounded bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
                        >
                          Select
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'my_library' && (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-700/50">
              <CompanyCostLibrarySection
                type={resourceType}
                query={query}
                onSelect={selectLibraryItem}
              />
            </div>
          )}

          {tab === 'manual' && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3">
              <p className={`text-sm ${TEXT_BODY} mb-3`}>Enter a custom {label.toLowerCase()} item.</p>
              <button
                type="button"
                onClick={openManualEntry}
                className="rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 transition-colors"
              >
                + Enter manually
              </button>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
