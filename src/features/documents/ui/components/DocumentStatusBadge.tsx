/**
 * Print-friendly status badge for professional document renderers.
 *
 * Renders on a white paper background — uses light solid colors only.
 * Status strings are normalized (lowercase, spaces/underscores collapsed)
 * so Phase 5B+ can pass `answers.status` directly without pre-formatting.
 */

type BadgeStyle = { bg: string; text: string; border: string };

const STATUS_STYLES: Record<string, BadgeStyle> = {
  draft: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
  },
  submitted: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  underreview: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  approved: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  approvedasnoted: {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
  },
  reviseandresubmit: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  rejected: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  closed: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
  },
  accepted: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  declined: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  underreview: 'Under Review',
  approved: 'Approved',
  approvedasnoted: 'Approved as Noted',
  reviseandresubmit: 'Revise and Resubmit',
  rejected: 'Rejected',
  closed: 'Closed',
  accepted: 'Accepted',
  declined: 'Declined',
};

function normalizeKey(status: string): string {
  return status.toLowerCase().replace(/[\s_-]+/g, '');
}

interface DocumentStatusBadgeProps {
  status: string;
}

export default function DocumentStatusBadge({ status }: DocumentStatusBadgeProps) {
  const key = normalizeKey(status);
  const style = STATUS_STYLES[key] ?? {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
  };
  const label = STATUS_LABELS[key] ?? status;

  return (
    <span
      className={[
        'inline-block rounded-full border px-2 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wide',
        style.bg,
        style.text,
        style.border,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
