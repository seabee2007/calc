import type { LogicReviewWarning, SuggestedLogicLink } from './logicTypes';

const SEVERITY_STYLES = {
  critical: 'border-rose-500/60 bg-rose-950/30 text-rose-100',
  warning: 'border-amber-500/50 bg-amber-950/20 text-amber-50',
  info: 'border-slate-600 bg-slate-900/60 text-slate-200',
} as const;

interface Props {
  warning: LogicReviewWarning;
  onAddSuggestedLink: (link: SuggestedLogicLink) => void;
  onAddAllSuggestedLinks: (links: SuggestedLogicLink[]) => void;
  onIgnore: (warningId: string) => void;
  busy?: boolean;
}

function formatLinkLabel(link: SuggestedLogicLink): string {
  const lag = link.lagDays > 0 ? ` + ${link.lagDays}d` : ' + 0';
  return `${link.predecessorActivityCode} → ${link.successorActivityCode} ${link.relationshipType}${lag}`;
}

export default function LogicReviewWarningCard({
  warning,
  onAddSuggestedLink,
  onAddAllSuggestedLinks,
  onIgnore,
  busy = false,
}: Props) {
  const suggestedLinks = warning.suggestedLinks ?? [];
  const buttonClass =
    'rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <article className={`rounded-lg border p-4 ${SEVERITY_STYLES[warning.severity]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {warning.severity}
        </span>
        {warning.source === 'ai' ? (
          <span className="rounded-full bg-cyan-950 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
            AI suggested{warning.aiConfidence ? ` · ${warning.aiConfidence}` : ''}
          </span>
        ) : null}
        {warning.activityCode ? (
          <span className="font-mono text-xs text-slate-300">{warning.activityCode}</span>
        ) : null}
      </div>

      {warning.activityTitle ? (
        <h4 className="mt-2 text-sm font-semibold text-white">{warning.activityTitle}</h4>
      ) : null}

      <p className="mt-2 text-sm leading-relaxed">{warning.issue}</p>
      {warning.reason ? <p className="mt-2 text-xs text-slate-300">{warning.reason}</p> : null}

      {suggestedLinks.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-200">
          {suggestedLinks.map((link) => (
            <li key={`${link.predecessorActivityCode}-${link.successorActivityCode}`} className="font-mono">
              {formatLinkLabel(link)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {warning.canAutoFix && suggestedLinks.length === 1 ? (
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => onAddSuggestedLink(suggestedLinks[0]!)}
          >
            Add suggested link
          </button>
        ) : null}
        {warning.canAutoFix && suggestedLinks.length > 1 ? (
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => onAddAllSuggestedLinks(suggestedLinks)}
          >
            Add suggested links
          </button>
        ) : null}
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => onIgnore(warning.id)}
        >
          Ignore
        </button>
      </div>
    </article>
  );
}
