import type { ReactNode } from 'react';
import { normalizePlannerDocumentType } from '../../../services/documentWorkflowConfig';
import {
  answerDisplayValue,
  formatPlannerDisplayValue,
} from './plannerDocumentFormat';
import { PLANNER_SECTION_TITLE } from '../plannerTheme';

const SECTION_CARD =
  'mb-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50';

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === '—' || value === null || value === undefined) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={SECTION_CARD}>
      <h3 className={`mb-3 ${PLANNER_SECTION_TITLE}`}>{title}</h3>
      {children}
    </section>
  );
}

export function ProjectDocumentDrawerExtraSections({
  documentType,
  answers,
  title,
}: {
  documentType: string;
  answers: Record<string, unknown>;
  title: string;
}) {
  const t = normalizePlannerDocumentType(documentType);

  if (t === 'rfi') {
    const question =
      answerDisplayValue(answers, 'question') ||
      formatPlannerDisplayValue(answers.rfiTitle);
    return (
      <>
        <SectionCard title="Request / Question">
          <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
            {question || '—'}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <DetailRow
              label="Drawing reference"
              value={
                answerDisplayValue(answers, 'drawingSpecReference') !== '—'
                  ? answerDisplayValue(answers, 'drawingSpecReference')
                  : answerDisplayValue(answers, 'drawingReference')
              }
            />
            <DetailRow label="Specification" value={answerDisplayValue(answers, 'specReference')} />
            <DetailRow label="Location" value={answerDisplayValue(answers, 'location')} />
          </dl>
        </SectionCard>
        <SectionCard title="Impact / References">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Cost impact" value={answerDisplayValue(answers, 'costImpact')} />
            <DetailRow label="Schedule impact" value={answerDisplayValue(answers, 'scheduleImpact')} />
            <DetailRow label="Related RFI" value={answerDisplayValue(answers, 'relatedRfi')} />
            <DetailRow label="Related FAR" value={answerDisplayValue(answers, 'relatedFar')} />
            <DetailRow
              label="Related change order"
              value={answerDisplayValue(answers, 'relatedChangeOrder')}
            />
          </dl>
        </SectionCard>
      </>
    );
  }

  if (t === 'far') {
    return (
      <>
        <SectionCard title="Request / Field Adjustment">
          <DetailRow label="Title" value={formatPlannerDisplayValue(title)} />
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
            {answerDisplayValue(answers, 'description') || '—'}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <DetailRow
              label="Existing condition"
              value={answerDisplayValue(answers, 'existingCondition')}
            />
            <DetailRow
              label="Proposed adjustment"
              value={answerDisplayValue(answers, 'proposedAdjustment')}
            />
            <DetailRow label="Reason" value={answerDisplayValue(answers, 'reason')} />
            <DetailRow label="Location" value={answerDisplayValue(answers, 'location')} />
          </dl>
        </SectionCard>
        <SectionCard title="Impact / References">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Cost impact" value={answerDisplayValue(answers, 'costImpact')} />
            <DetailRow label="Schedule impact" value={answerDisplayValue(answers, 'scheduleImpact')} />
            <DetailRow label="Labor impact" value={answerDisplayValue(answers, 'laborImpact')} />
            <DetailRow label="Material impact" value={answerDisplayValue(answers, 'materialImpact')} />
            <DetailRow label="Equipment impact" value={answerDisplayValue(answers, 'equipmentImpact')} />
            <DetailRow label="Related RFI" value={answerDisplayValue(answers, 'relatedRfi')} />
            <DetailRow label="Related change order" value={answerDisplayValue(answers, 'relatedChangeOrder')} />
          </dl>
        </SectionCard>
      </>
    );
  }

  return null;
}
