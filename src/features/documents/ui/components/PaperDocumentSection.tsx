import type { ReactNode } from 'react';

type SectionTone = 'default' | 'muted' | 'emphasis';

interface PaperDocumentSectionProps {
  title: string;
  subtitle?: string;
  /** Subtle visual weight variation. 'default' is a top-bordered block. */
  tone?: SectionTone;
  children: ReactNode;
}

const TONE_WRAPPER: Record<SectionTone, string> = {
  default: 'mt-6 border-t border-slate-200 pt-4',
  muted: 'mt-6 rounded-lg bg-slate-50 border border-slate-200 p-4',
  emphasis: 'mt-6 rounded-lg border border-slate-300 bg-slate-50 p-4',
};

/**
 * Section block for professional document renderers.
 *
 * Named `PaperDocumentSection` (not `DocumentSection`) to avoid a name clash
 * with the engine's `DocumentSection` clause type from `features/documents/types.ts`.
 */
export default function PaperDocumentSection({
  title,
  subtitle,
  tone = 'default',
  children,
}: PaperDocumentSectionProps) {
  return (
    <section className={TONE_WRAPPER[tone]}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      ) : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
