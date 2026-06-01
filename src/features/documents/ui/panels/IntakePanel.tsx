import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import {
  APP_SECTION_CARD,
  BORDER_DEFAULT,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../../../theme/appTheme';
import type { DocumentQuestion, IntakeGroup, QuestionnaireMode } from '../../types';
import { GROUP_LABELS, MODES } from '../contractBuilderConstants';

export interface IntakePanelProps {
  packOptions: { value: string; label: string }[];
  packKey: string;
  mode: QuestionnaireMode;
  groupedQuestions: { group: IntakeGroup; questions: DocumentQuestion[] }[];
  answers: Record<string, unknown>;
  onPackChange: (packKey: string) => void;
  onModeChange: (mode: QuestionnaireMode) => void;
  onAnswerChange: (key: string, value: unknown) => void;
}

export default function IntakePanel({
  packOptions,
  packKey,
  mode,
  groupedQuestions,
  answers,
  onPackChange,
  onModeChange,
  onAnswerChange,
}: IntakePanelProps) {
  const renderControl = (q: DocumentQuestion) => {
    const value = answers[q.questionKey];
    if (q.type === 'boolean') {
      const on = value === true;
      return (
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
    return (
      <Input
        label={q.label}
        type={q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onAnswerChange(q.questionKey, e.target.value)}
        fullWidth
      />
    );
  };

  return (
    <>
      <div className={APP_SECTION_CARD}>
        <Select
          label="Jurisdiction / pack"
          options={packOptions}
          value={packKey}
          onChange={onPackChange}
          fullWidth
        />
        <p className={`mt-2 text-xs ${TEXT_MUTED}`}>
          State packs append locked statutory notices. All packs are draft-only until attorney
          reviewed.
        </p>
      </div>

      <div className={APP_SECTION_CARD}>
        <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${TEXT_MUTED}`}>
          Contract mode
        </p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onModeChange(m.value)}
              title={m.hint}
              className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                mode === m.value
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                  : `${BORDER_DEFAULT} ${TEXT_BODY} hover:bg-slate-100 dark:hover:bg-slate-700/60`
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {groupedQuestions.map(({ group, questions }) => (
        <div key={group} className={APP_SECTION_CARD}>
          <h2 className={`mb-3 text-sm font-semibold ${TEXT_FOREGROUND}`}>{GROUP_LABELS[group]}</h2>
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
