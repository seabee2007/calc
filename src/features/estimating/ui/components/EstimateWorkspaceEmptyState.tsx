import { TEXT_BODY, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  title?: string;
  body?: string;
}

export default function EstimateWorkspaceEmptyState({
  title = 'No estimate saved for this project yet',
  body = 'The estimating engine foundation is ready. The next phase will add estimate creation, scopes, line items, and version snapshots.',
}: Props) {
  return (
    <div
      className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 dark:border-slate-600 dark:bg-slate-800/40 sm:px-6"
    >
      <p className={`text-base font-semibold ${TEXT_FOREGROUND}`}>{title}</p>
      <p className={`mt-2 text-sm ${TEXT_BODY}`}>{body}</p>
    </div>
  );
}
