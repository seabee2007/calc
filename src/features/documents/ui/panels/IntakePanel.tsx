import { useState, useEffect } from 'react';
import Input from '../../../../components/ui/Input';
import DatePickerField from '../../../../components/ui/DatePickerField';
import Select from '../../../../components/ui/Select';
import USAddressFields from '../../../../components/address/USAddressFields';
import { fetchRfisForProject } from '../../../../services/rfiService';
import { fetchAdjustmentsForProject } from '../../../../services/fieldAdjustmentService';
import type { Project } from '../../../../types/index';
import {
  APP_SECTION_CARD,
  BORDER_DEFAULT,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../../../theme/appTheme';
import { EMPTY_US_ADDRESS, type USAddress } from '../../../../types/address';
import {
  formatCurrencyDisplay,
  parseCurrencyInput,
} from '../../../../utils/currencyInput';
import { formatUSPhoneInput } from '../../../../utils/phoneFormat';
import type { DocumentQuestion, IntakeGroup, QuestionnaireMode } from '../../types';
import { isDateQuestionKey } from '../../../../utils/dateInput';
import { GROUP_LABELS, MODES } from '../contractBuilderConstants';
import type { ContractPrefillSource } from '../contractPrefill';

export interface IntakePanelProps {
  packOptions: { value: string; label: string }[];
  packKey: string;
  mode: QuestionnaireMode;
  groupedQuestions: { group: IntakeGroup; questions: DocumentQuestion[] }[];
  answers: Record<string, unknown>;
  fieldSources?: Partial<Record<string, ContractPrefillSource>>;
  fieldNotes?: Partial<Record<string, string>>;
  fieldErrors?: Partial<Record<string, string>>;
  hasSelectedProject?: boolean;
  /** Full project object — used by CO-specific renderers (e.g. RFI/FAR dropdown). */
  selectedProject?: Project | null;
  onPackChange: (packKey: string) => void;
  onModeChange: (mode: QuestionnaireMode) => void;
  onAnswerChange: (key: string, value: unknown) => void;
  onRefreshFromProject?: () => void;
}

const ADDRESS_PREFIXES = [
  'contractorAddress',
  'ownerMailingAddress',
  'propertyAddress',
] as const;

const CONTRACT_CURRENCY_KEYS = new Set(['contractPrice', 'estimatedTotal', 'depositAmount']);

type AddressPrefix = (typeof ADDRESS_PREFIXES)[number];

const ADDRESS_FIRST_KEYS: Record<AddressPrefix, string> = {
  contractorAddress: 'contractorAddressStreet',
  ownerMailingAddress: 'ownerMailingAddressStreet',
  propertyAddress: 'propertyAddressStreet',
};

const ADDRESS_LABELS: Record<AddressPrefix, string> = {
  contractorAddress: 'Contractor address',
  ownerMailingAddress: 'Owner mailing address',
  propertyAddress: 'Property address',
};

function addressPrefixForKey(key: string): AddressPrefix | null {
  return ADDRESS_PREFIXES.find((prefix) => key.startsWith(prefix)) ?? null;
}

function answerString(answers: Record<string, unknown>, key: string): string {
  const value = answers[key];
  return value === undefined || value === null ? '' : String(value);
}

function sourceLabel(source: ContractPrefillSource | undefined): string | null {
  if (source === 'proposal') return 'From proposal';
  if (source === 'project') return 'From project';
  if (source === 'company') return 'From company';
  return null;
}

function numericAnswer(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    return parseCurrencyInput(value);
  }
  return undefined;
}

export default function IntakePanel({
  packOptions,
  packKey,
  mode,
  groupedQuestions,
  answers,
  fieldSources = {},
  fieldNotes = {},
  fieldErrors = {},
  hasSelectedProject = false,
  selectedProject = null,
  onPackChange,
  onModeChange,
  onAnswerChange,
  onRefreshFromProject,
}: IntakePanelProps) {
  const [focusedCurrencyKey, setFocusedCurrencyKey] = useState<string | null>(null);

  // RFI / FAR options for the rfiFarReference field (Change Order docs only)
  const [rfiFarOptions, setRfiFarOptions] = useState<{ value: string; label: string }[]>([]);
  const [rfiFarLoading, setRfiFarLoading] = useState(false);

  useEffect(() => {
    if (!selectedProject?.id) {
      setRfiFarOptions([]);
      return;
    }
    setRfiFarLoading(true);
    Promise.all([
      fetchRfisForProject(selectedProject.id),
      fetchAdjustmentsForProject(selectedProject.id),
    ])
      .then(([rfis, fars]) => {
        setRfiFarOptions([
          ...rfis.map((r) => ({
            value: `${r.displayNumber ?? 'RFI'} — ${r.title}`,
            label: `${r.displayNumber ?? 'RFI'} — ${r.title}`,
          })),
          ...fars.map((f) => ({
            value: `${f.displayNumber ?? 'FAR'} — ${f.title}`,
            label: `${f.displayNumber ?? 'FAR'} — ${f.title}`,
          })),
        ]);
      })
      .catch(() => setRfiFarOptions([]))
      .finally(() => setRfiFarLoading(false));
  }, [selectedProject?.id]);

  const fieldMeta = (key: string, fallbackHelper?: string) => {
    const label = sourceLabel(fieldSources[key]);
    const note = fieldNotes[key] ?? fallbackHelper;
    return {
      helperText: [label, note].filter(Boolean).join(label && note ? ' · ' : '') || undefined,
      error: fieldErrors[key],
    };
  };

  const getAddress = (prefix: AddressPrefix): USAddress => ({
    ...EMPTY_US_ADDRESS,
    street: answerString(answers, `${prefix}Street`),
    street2: answerString(answers, `${prefix}Street2`),
    city: answerString(answers, `${prefix}City`),
    state: answerString(answers, `${prefix}State`),
    zip: answerString(answers, `${prefix}Zip`),
  });

  const renderAddress = (prefix: AddressPrefix) => {
    const label = sourceLabel(
      fieldSources[`${prefix}Street`] ??
        fieldSources[`${prefix}City`] ??
        fieldSources[`${prefix}State`] ??
        fieldSources[`${prefix}Zip`],
    );
    return (
      <div className="space-y-2">
        <p className={`text-xs font-semibold uppercase tracking-wider ${TEXT_MUTED}`}>
          {ADDRESS_LABELS[prefix]}
        </p>
        <USAddressFields
          value={getAddress(prefix)}
          onChange={(next) => {
            onAnswerChange(`${prefix}Street`, next.street);
            onAnswerChange(`${prefix}Street2`, next.street2);
            onAnswerChange(`${prefix}City`, next.city);
            onAnswerChange(`${prefix}State`, next.state);
            onAnswerChange(`${prefix}Zip`, next.zip);
          }}
          streetLabel="Street Address"
          showStreet2
          idPrefix={`contract-${prefix}`}
        />
        {label && <p className={`text-xs ${TEXT_MUTED}`}>{label}</p>}
      </div>
    );
  };

  const renderWorkHours = () => (
      <div className="space-y-2">
        <p className={`text-sm font-medium ${TEXT_BODY}`}>Normal working hours</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Start time"
            type="time"
            value={answerString(answers, 'workStartTime')}
            onChange={(e) => onAnswerChange('workStartTime', e.target.value)}
            fullWidth
          />
          <Input
            label="End time"
            type="time"
            value={answerString(answers, 'workEndTime')}
            onChange={(e) => onAnswerChange('workEndTime', e.target.value)}
            fullWidth
          />
        </div>
        <p className={`text-xs ${TEXT_MUTED}`}>Example: 06:00 to 18:00</p>
      </div>
    );

  const currencyDisplayValue = (key: string, value: unknown): string => {
    if (focusedCurrencyKey === key) {
      const n = numericAnswer(value);
      if (n === undefined) return '';
      return String(n);
    }
    const n = numericAnswer(value);
    if (n === undefined) return '';
    return formatCurrencyDisplay(n);
  };

  const renderRfiFarReference = (q: DocumentQuestion) => {
    const currentValue = typeof answers[q.questionKey] === 'string' ? (answers[q.questionKey] as string) : '';
    if (!selectedProject) {
      return (
        <div>
          <p className={`mb-1 text-sm font-medium ${TEXT_BODY}`}>{q.label}</p>
          <p className={`text-xs ${TEXT_MUTED}`}>Select a project above to link RFIs or FARs.</p>
        </div>
      );
    }
    if (rfiFarLoading) {
      return (
        <div>
          <p className={`mb-1 text-sm font-medium ${TEXT_BODY}`}>{q.label}</p>
          <p className={`text-xs ${TEXT_MUTED}`}>Loading RFIs and FARs…</p>
        </div>
      );
    }
    if (rfiFarOptions.length === 0) {
      return (
        <div>
          <p className={`mb-1 text-sm font-medium ${TEXT_BODY}`}>{q.label}</p>
          <p className={`text-xs ${TEXT_MUTED}`}>No RFIs or FARs found for this project.</p>
        </div>
      );
    }
    return (
      <Select
        label={q.label}
        options={[{ value: '', label: 'None selected' }, ...rfiFarOptions]}
        value={currentValue}
        onChange={(v) => onAnswerChange(q.questionKey, v)}
        fullWidth
      />
    );
  };

  const renderControl = (q: DocumentQuestion) => {
    const value = answers[q.questionKey];
    const addressPrefix = addressPrefixForKey(q.questionKey);
    if (addressPrefix) {
      return q.questionKey === ADDRESS_FIRST_KEYS[addressPrefix] ? renderAddress(addressPrefix) : null;
    }
    if (q.questionKey === 'workStartTime') return renderWorkHours();
    if (q.questionKey === 'workEndTime') return null;
    if (q.questionKey === 'rfiFarReference') return renderRfiFarReference(q);

    if (q.type === 'boolean') {
      const on = value === true;
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className={`text-sm ${TEXT_BODY}`}>{q.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => onAnswerChange(q.questionKey, !on)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                on ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  on ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {q.helperText && (
            <p className={`text-xs ${TEXT_MUTED}`}>{q.helperText}</p>
          )}
        </div>
      );
    }
    if (q.type === 'select') {
      return (
        <Select
          label={q.label}
          options={[{ value: '', label: 'Select…' }, ...(q.options ?? [])]}
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => onAnswerChange(q.questionKey, v)}
          fullWidth
        />
      );
    }

    const isDateField = q.type === 'date' || isDateQuestionKey(q.questionKey);
    if (isDateField) {
      const meta = fieldMeta(q.questionKey, q.helperText);
      return (
        <DatePickerField
          id={`document-field-${q.questionKey}`}
          label={q.label}
          value={value}
          onChange={(next) => onAnswerChange(q.questionKey, next)}
          helperText={meta.helperText}
          error={meta.error}
          fullWidth
          allowClear={!q.required}
          required={q.required}
        />
      );
    }

    const isCurrency = CONTRACT_CURRENCY_KEYS.has(q.questionKey);
    const isPhone = /phone/i.test(q.questionKey);
    const isEmail = /email/i.test(q.questionKey);
    const isYearBuilt = q.questionKey === 'yearBuilt';
    const isDepositAmount = q.questionKey === 'depositAmount';
    const contractPrice = Number(answers.contractPrice);
    const depositPercent = Number(answers.depositPercent);
    const expectedDeposit =
      Number.isFinite(contractPrice) && contractPrice > 0 && Number.isFinite(depositPercent)
        ? Math.round(contractPrice * (depositPercent / 100) * 100) / 100
        : undefined;
    const depositAmount = Number(value);
    const depositWarning =
      isDepositAmount &&
      expectedDeposit !== undefined &&
      Number.isFinite(depositAmount) &&
      depositAmount > 0 &&
      Math.abs(depositAmount - expectedDeposit) > 0.01
        ? 'Manual deposit amount differs from percentage calculation.'
        : undefined;
    const depositHelper =
      isDepositAmount && (!Number.isFinite(contractPrice) || contractPrice <= 0)
        ? 'Enter a fixed contract price first to calculate deposit.'
        : depositWarning;
    const specificHelper = isYearBuilt ? 'Leave blank if unknown.' : depositHelper;
    const meta = fieldMeta(
      q.questionKey,
      specificHelper ?? q.helperText,
    );

    if (isCurrency) {
      return (
        <Input
          label={q.label}
          type="text"
          inputMode="decimal"
          value={currencyDisplayValue(q.questionKey, value)}
          onChange={(e) => {
            const parsed = parseCurrencyInput(e.target.value);
            onAnswerChange(q.questionKey, parsed === undefined ? '' : parsed);
          }}
          onFocus={() => setFocusedCurrencyKey(q.questionKey)}
          onBlur={() => setFocusedCurrencyKey(null)}
          helperText={meta.helperText}
          error={meta.error}
          fullWidth
        />
      );
    }

    return (
      <Input
        id={`document-field-${q.questionKey}`}
        label={q.label}
        type={q.type === 'number' ? 'number' : isPhone ? 'tel' : isEmail ? 'email' : 'text'}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) =>
          onAnswerChange(
            q.questionKey,
            isPhone ? formatUSPhoneInput(e.target.value) : e.target.value,
          )
        }
        min={isYearBuilt ? 1900 : undefined}
        max={isYearBuilt ? new Date().getFullYear() : undefined}
        helperText={meta.helperText}
        error={meta.error}
        fullWidth
      />
    );
  };

  return (
    <>
      <div className={APP_SECTION_CARD}>
        <Select
          label="Document Type / Template"
          options={packOptions}
          value={packKey}
          onChange={onPackChange}
          fullWidth
        />
        <p className={`mt-2 text-xs ${TEXT_MUTED}`}>
          Choose the document type or template to build. State-specific contract packs can be added
          separately when attorney-reviewed packs are available.
        </p>
      </div>

      <div className={APP_SECTION_CARD}>
        <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${TEXT_MUTED}`}>
          Contract mode
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-stretch">
          {MODES.map((m) => {
            const description = [m.hint, m.detail].filter(Boolean).join(' · ');
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => onModeChange(m.value)}
                title={description || m.label}
                className={`flex h-full min-h-[5.5rem] flex-col rounded-lg border px-3 py-3 text-left transition-colors ${
                  mode === m.value
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                    : `${BORDER_DEFAULT} ${TEXT_BODY} hover:bg-slate-100 dark:hover:bg-slate-700/60`
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold leading-snug">{m.label}</span>
                  {m.recommended && (
                    <span className="w-fit shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-cyan-700 dark:text-cyan-300">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-1 flex-col gap-1.5">
                  {m.hint ? (
                    <span className={`block text-xs leading-relaxed ${TEXT_MUTED}`}>{m.hint}</span>
                  ) : null}
                  {m.detail ? (
                    <span className={`block text-xs leading-relaxed ${TEXT_MUTED}`}>{m.detail}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {groupedQuestions.map(({ group, questions }) => (
        <div key={group} className={APP_SECTION_CARD}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{GROUP_LABELS[group]}</h2>
            {group === 'project' && hasSelectedProject && onRefreshFromProject && (
              <button
                type="button"
                onClick={onRefreshFromProject}
                className="text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300"
              >
                Refresh from project
              </button>
            )}
          </div>
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.questionKey}>{renderControl(q)}</div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
