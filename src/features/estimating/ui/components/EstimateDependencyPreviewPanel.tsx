import { useMemo } from 'react';
import type { EstimateScheduleDependencyPreview } from '../../application/estimateScheduleDependencies';
import type { SchedulePlanForDependencyPreview } from '../../application/estimateScheduleDependencies';
import {
  buildCandidateTitleMap,
  formatDependencyPreviewLinks,
} from '../../application/estimateScheduleDependencies';
import { formatEstimateNumber } from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';

const PREVIEW_NOTE =
  'Dependencies are preview-only metadata. They are not saved or published to Planner.';

interface Props {
  dependencies: EstimateScheduleDependencyPreview[];
  plan: SchedulePlanForDependencyPreview | null;
  loading?: boolean;
  maxPreviewLinks?: number;
}

export default function EstimateDependencyPreviewPanel({
  dependencies,
  plan,
  loading = false,
  maxPreviewLinks = 3,
}: Props) {
  const titleMap = useMemo(() => buildCandidateTitleMap(plan), [plan]);
  const previewLinks = useMemo(
    () => formatDependencyPreviewLinks(dependencies, titleMap, maxPreviewLinks),
    [dependencies, titleMap, maxPreviewLinks],
  );

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
      <div>
        <p className={PLANNER_SECTION_TITLE}>Draft Dependency Preview</p>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Finish-to-start links derived from the selected dependency mode.
        </p>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60" />
      ) : (
        <>
          <p className={`text-sm font-medium ${TEXT_BODY}`}>
            {formatEstimateNumber(dependencies.length, { decimals: 0 })} dependency link
            {dependencies.length === 1 ? '' : 's'}
          </p>

          {previewLinks.length > 0 ? (
            <ul className={`space-y-1 text-sm ${TEXT_BODY}`}>
              {previewLinks.map((link) => (
                <li key={link} className="truncate">
                  {link}
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-sm ${PLANNER_MUTED}`}>No finish-to-start links for this mode.</p>
          )}

          {dependencies.length > maxPreviewLinks ? (
            <p className={`text-xs ${PLANNER_MUTED}`}>
              Showing first {maxPreviewLinks} of {dependencies.length} links.
            </p>
          ) : null}
        </>
      )}

      <p className={`text-xs ${PLANNER_MUTED}`}>{PREVIEW_NOTE}</p>
    </div>
  );
}
