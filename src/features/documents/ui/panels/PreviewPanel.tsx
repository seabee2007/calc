import { Lock } from 'lucide-react';
import { APP_SECTION_CARD, TEXT_BODY, TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';
import type { DocumentSection } from '../../types';

export interface PreviewPanelProps {
  previewHeading: string;
  previewSections: DocumentSection[];
}

export default function PreviewPanel({
  previewHeading,
  previewSections,
}: PreviewPanelProps) {
  return (
    <div className={APP_SECTION_CARD}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{previewHeading}</h2>
        <span className={`text-xs ${TEXT_MUTED}`}>{previewSections.length} sections</span>
      </div>
      <div className="space-y-5">
        {previewSections.map((section) => {
          const isLockedNotice = section.clauseKey.startsWith('notice.');
          return (
            <article
              key={section.clauseKey}
              className={
                isLockedNotice
                  ? 'rounded-lg border border-amber-500/40 bg-amber-500/5 p-3'
                  : undefined
              }
            >
              <h3 className={`mb-1 flex items-center gap-2 text-sm font-semibold ${TEXT_FOREGROUND}`}>
                {isLockedNotice && (
                  <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                )}
                {section.title}
              </h3>
              <p className={`whitespace-pre-wrap text-sm leading-relaxed ${TEXT_BODY}`}>
                {section.body}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
