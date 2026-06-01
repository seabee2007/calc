import Button from '../../../../components/ui/Button';
import { APP_SECTION_CARD, TEXT_BODY, TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';

export interface ProjectSummary {
  projectName: string;
  client: string;
  projectType: string;
  jobsiteAddress: string;
  proposalTotal: string;
  contractValue: string;
}

interface ProjectSummaryPanelProps {
  summary: ProjectSummary | null;
  onRefreshFromProject: () => void;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <dt className={`text-xs font-semibold uppercase tracking-wider ${TEXT_MUTED}`}>{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${TEXT_BODY}`}>{value || 'Not available'}</dd>
    </div>
  );
}

export default function ProjectSummaryPanel({
  summary,
  onRefreshFromProject,
}: ProjectSummaryPanelProps) {
  return (
    <section className={APP_SECTION_CARD}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Project Summary</h2>
          <p className={`mt-1 text-xs ${TEXT_MUTED}`}>
            Data shown here is used for project linkage, prefill, Planner Documents, and portal
            contract links.
          </p>
        </div>
        {summary && (
          <Button variant="outline" size="sm" onClick={onRefreshFromProject}>
            Refresh From Project
          </Button>
        )}
      </div>

      {summary ? (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryRow label="Project Name" value={summary.projectName} />
          <SummaryRow label="Client" value={summary.client} />
          <SummaryRow label="Project Type" value={summary.projectType} />
          <SummaryRow label="Jobsite Address" value={summary.jobsiteAddress} />
          <SummaryRow label="Proposal Total" value={summary.proposalTotal} />
          <SummaryRow label="Contract Value" value={summary.contractValue} />
        </dl>
      ) : (
        <p className={`text-sm ${TEXT_MUTED}`}>
          Select a project in the top Project selector to choose where this contract is saved and
          to import project details.
        </p>
      )}
    </section>
  );
}
