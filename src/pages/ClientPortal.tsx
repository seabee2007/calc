import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  AlertTriangle,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { fetchClientPortalView } from '../services/clientPortalService';
import type { ClientPortalViewData, ClientTimelineStep } from '../types/clientPortal';
import {
  OPS_BODY,
  OPS_EMPTY_STATE,
  OPS_HERO_LABEL,
  OPS_HERO_STAT_INNER,
  OPS_HERO_STAT_LABEL,
  OPS_HERO_STAT_VALUE,
  OPS_MUTED,
  OPS_PROJECT_HERO,
  OPS_SECTION,
  OPS_SECTION_EYEBROW,
  OPS_SECTION_TITLE,
  OPS_TITLE,
} from '../components/dashboard/opsTheme';
import { TEXT_ACCENT } from '../theme/appTheme';
import { useNoIndex } from '../hooks/useNoIndex';

const ClientPortal: React.FC = () => {
  useNoIndex();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ClientPortalViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Portal not found or expired.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const view = await fetchClientPortalView(token);
        if (!cancelled) setData(view);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Portal not found or expired.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className={`h-8 w-8 animate-spin ${TEXT_ACCENT}`} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className={`max-w-md w-full ${OPS_EMPTY_STATE}`}>
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <h1 className={`text-xl font-semibold ${OPS_HERO_STAT_VALUE} mb-2`}>
            Portal not found or expired
          </h1>
          <p className={`text-sm ${OPS_MUTED}`}>
            {error ?? 'This project link is invalid or has been deactivated.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:px-6">
          <p className={`text-xs uppercase tracking-widest font-semibold ${OPS_HERO_LABEL}`}>
            Arden Project OS Client Portal
          </p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {data.contractorLogoUrl ? (
                <img
                  src={data.contractorLogoUrl}
                  alt=""
                  className="h-10 w-10 rounded object-contain bg-white"
                />
              ) : (
                <Building2 className="h-10 w-10 text-slate-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-sm truncate ${OPS_MUTED}`}>
                  {data.contractorCompany ?? 'Your contractor'}
                </p>
                <h1 className={`text-xl sm:text-2xl font-bold truncate ${OPS_HERO_STAT_VALUE}`}>
                  {data.projectName}
                </h1>
              </div>
            </div>
            <StatusBadge status={data.projectStatus} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        <section className={`p-4 sm:p-5 ${OPS_PROJECT_HERO}`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <HeroStat label="Project status" value={data.currentPhase} />
            <HeroStat label="Next milestone" value={data.nextMilestone} />
            <HeroStat
              label="Scheduled placement"
              value={data.placementDate ?? 'Not scheduled yet'}
            />
          </div>
        </section>

        {data.weatherDelayNotice && (
          <Card className="p-4 border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/50">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Weather / schedule notice
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  {data.weatherDelayNotice}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`sm:p-6 ${OPS_SECTION}`}>
            <h2 className={`text-lg ${OPS_SECTION_TITLE} mb-4`}>
              Project overview
            </h2>
            <dl className="space-y-3 text-sm">
              <OverviewRow icon={<MapPin className="h-4 w-4" />} label="Jobsite">
                {data.jobsiteLocation ?? 'Location shared after scheduling'}
              </OverviewRow>
              <OverviewRow icon={<Calendar className="h-4 w-4" />} label="Placement">
                {data.placementDate ?? 'Not scheduled yet'}
              </OverviewRow>
              {data.proposalStatus && (
                <OverviewRow icon={<FileText className="h-4 w-4" />} label="Proposal">
                  {data.proposalStatus}
                </OverviewRow>
              )}
              {data.paymentStatus && (
                <OverviewRow icon={<CheckCircle2 className="h-4 w-4" />} label="Payment">
                  {data.paymentStatus}
                </OverviewRow>
              )}
            </dl>

            {(data.contractorEmail || data.contractorPhone) && (
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className={`text-xs uppercase tracking-wide mb-2 ${OPS_SECTION_EYEBROW}`}>
                  Contractor contact
                </p>
                <div className="space-y-2 text-sm">
                  {data.contractorPhone && (
                    <a
                      href={`tel:${data.contractorPhone}`}
                      className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {data.contractorPhone}
                    </a>
                  )}
                  {data.contractorEmail && (
                    <a
                      href={`mailto:${data.contractorEmail}`}
                      className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {data.contractorEmail}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={`sm:p-6 ${OPS_SECTION}`}>
            <h2 className={`text-lg ${OPS_SECTION_TITLE} mb-4`}>
              Progress timeline
            </h2>
            <Timeline steps={data.timeline} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`sm:p-6 ${OPS_SECTION}`}>
            <h2 className={`text-lg ${OPS_SECTION_TITLE} mb-3`}>
              QC status
            </h2>
            <p className={`text-sm ${OPS_BODY}`}>{data.qcSummary}</p>
          </div>

          <div className={`sm:p-6 ${OPS_SECTION}`}>
            <h2 className={`text-lg ${OPS_SECTION_TITLE} mb-3`}>
              Documents
            </h2>
            {data.documents.length === 0 ? (
              <p className={`text-sm ${OPS_MUTED}`}>
                Documents will appear here when your contractor shares them.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.documents.map((doc) => (
                  <li key={doc.url}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-300 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {doc.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={`sm:p-6 ${OPS_SECTION}`}>
          <h2 className={`text-lg ${OPS_SECTION_TITLE} mb-4`}>
            Project updates
          </h2>
          {data.updates.length === 0 ? (
            <p className={`text-sm ${OPS_MUTED}`}>
              Updates will appear here as your project progresses.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.updates.map((update) => (
                <li
                  key={`${update.date}-${update.message}`}
                  className="flex gap-3 text-sm border-l-2 border-cyan-500/40 pl-3"
                >
                  <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className={OPS_HERO_STAT_VALUE}>{update.message}</p>
                    <p className={`text-xs ${OPS_MUTED} mt-0.5`}>
                      {formatUpdateDate(update.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 px-3 py-1 text-sm font-semibold shrink-0">
      {status}
    </span>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${OPS_HERO_STAT_INNER} p-3`}>
      <p className={`text-xs uppercase tracking-wide ${OPS_HERO_STAT_LABEL}`}>{label}</p>
      <p className={`mt-1 text-base font-semibold ${OPS_HERO_STAT_VALUE}`}>{value}</p>
    </div>
  );
}

function OverviewRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>
      <div>
        <dt className={OPS_MUTED}>{label}</dt>
        <dd className={`font-medium mt-0.5 ${OPS_TITLE}`}>{children}</dd>
      </div>
    </div>
  );
}

function Timeline({ steps }: { steps: ClientTimelineStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-3">
          {step.status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : step.status === 'current' ? (
            <Circle className="h-5 w-5 text-cyan-500 fill-cyan-500/20 shrink-0" />
          ) : (
            <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
          )}
          <div>
            <p
              className={`text-sm font-medium ${
                step.status === 'upcoming' ? OPS_MUTED : OPS_HERO_STAT_VALUE
              }`}
            >
              {step.label}
            </p>
            {step.status === 'current' && (
              <p className={`text-xs ${TEXT_ACCENT} mt-0.5`}>Current step</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatUpdateDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default ClientPortal;
