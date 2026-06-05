import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import type { EstimateType } from '../../domain/estimateTypes';
import {
  getBuildScopeModalDescription,
  getBuildScopeModalTitle,
} from '../../application/estimateStartFlow';
import {
  getCsiDivisionDescription,
  getCsiDivisionOptions,
} from '../../domain/csiDivisions';
import { normalizeSelectedDivisionCodes } from '../../application/estimateWorkBreakdown';
import { PLANNER_MUTED, TEXT_BODY, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  isOpen: boolean;
  estimateType: EstimateType;
  onClose: () => void;
  onCreate: (divisionCodes: string[]) => void;
}

export default function EstimateStartScopeModal({
  isOpen,
  estimateType,
  onClose,
  onCreate,
}: Props) {
  const divisionOptions = useMemo(() => getCsiDivisionOptions(), []);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const modalTitle = getBuildScopeModalTitle(estimateType);
  const modalDescription = getBuildScopeModalDescription(estimateType);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCodes([]);
    }
  }, [isOpen]);

  const toggleDivision = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((value) => value !== code) : [...prev, code],
    );
  };

  const handleCreate = () => {
    const normalized = normalizeSelectedDivisionCodes(selectedCodes);
    if (normalized.length === 0) return;
    onCreate(normalized);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <div className="space-y-4">
        <p className={`text-sm ${PLANNER_MUTED}`}>{modalDescription}</p>

        <div className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
          {divisionOptions.map((division) => {
            const checked = selectedCodes.includes(division.code);
            const description = getCsiDivisionDescription(division.code);

            return (
              <label
                key={division.code}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  checked
                    ? 'border-cyan-500/60 bg-cyan-50/70 dark:border-cyan-500/40 dark:bg-cyan-950/30'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
                  checked={checked}
                  onChange={() => toggleDivision(division.code)}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${TEXT_FOREGROUND}`}>
                    {division.label}
                  </span>
                  {description ? (
                    <span className={`mt-0.5 block text-xs ${PLANNER_MUTED}`}>{description}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        <div
          className={`rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2.5 text-xs dark:border-slate-600 dark:bg-slate-800/40 ${TEXT_BODY}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              disabled
              title="Coming next: AI will read the project scope and suggest divisions of work."
            >
              Recommend from project scope
            </Button>
            <span className={PLANNER_MUTED}>
              Coming next: AI will read the project scope and suggest divisions of work.
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={selectedCodes.length === 0}
            onClick={handleCreate}
          >
            Create work breakdown
          </Button>
        </div>
      </div>
    </Modal>
  );
}
