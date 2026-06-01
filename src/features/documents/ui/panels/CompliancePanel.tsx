import { CheckCircle2, ShieldAlert } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import {
  APP_SECTION_CARD,
  BORDER_DEFAULT,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../../../theme/appTheme';
import type {
  DocumentComplianceIssue,
  DocumentRecommendation,
  DocumentRiskScore,
} from '../../types';
import { getPackCatalog } from '../../packs/registry';
import { RISK_STYLES, SEVERITY_TEXT } from '../contractBuilderConstants';

const BASE_RECOMMENDED_CLAUSES = ['Change Order', 'Unknown Conditions', 'Force Majeure'];

export interface CompliancePanelProps {
  packKey: string;
  risk: DocumentRiskScore;
  recommendations: DocumentRecommendation[];
  complianceIssues: DocumentComplianceIssue[];
  accepted: Set<string>;
  showValidation: boolean;
  onRunValidation: () => void;
  onToggleRecommendation: (clauseKey: string) => void;
}

export default function CompliancePanel({
  packKey,
  risk,
  recommendations,
  complianceIssues,
  accepted,
  showValidation,
  onRunValidation,
  onToggleRecommendation,
}: CompliancePanelProps) {
  const catalog = getPackCatalog(packKey);
  const titleForRecommendation = (clauseKey: string): string => {
    const clause = catalog?.clauses.find((item) => item.key === clauseKey);
    if (clause) {
      return /\bclause\b/i.test(clause.title) ? clause.title : `${clause.title} Clause`;
    }

    const addendum = catalog?.addenda.find((item) => item.key === clauseKey);
    if (addendum) {
      return /\baddendum\b/i.test(addendum.title) ? addendum.title : `${addendum.title} Addendum`;
    }

    const isAddendum = clauseKey.startsWith('addendum.');
    const rawName = clauseKey.replace(/^addendum\./, '').replace(/^[^.]+\./, '');
    const readableName = rawName
      .split('_')
      .filter(Boolean)
      .map((part) => {
        if (part.toLowerCase() === 'hoa') return 'HOA';
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ')
      .replace(/^Owner Supplied\b/, 'Owner-Supplied');
    return `${readableName} ${isAddendum ? 'Addendum' : 'Clause'}`;
  };

  return (
    <>
      <div className={APP_SECTION_CARD}>
        <div className="flex items-center justify-between">
          <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Risk Score</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold capitalize ${RISK_STYLES[risk.level]}`}
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            {risk.level} ({risk.score}/100)
          </span>
        </div>
        <p className={`mt-4 text-xs font-semibold uppercase tracking-wider ${TEXT_MUTED}`}>
          Potential Risks
        </p>
        {risk.factors.length > 0 ? (
          <ul className={`mt-3 space-y-1 text-sm ${TEXT_BODY}`}>
            {risk.factors.map((f) => (
              <li key={f.key} className="flex justify-between gap-3">
                <span>{f.label}</span>
                <span className={TEXT_MUTED}>+{f.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`mt-2 text-sm ${TEXT_MUTED}`}>None detected</p>
        )}

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wider ${TEXT_MUTED}`}>
            Recommended Clauses
          </h3>
          {recommendations.length === 0 && (
            <ul className={`space-y-1.5 text-sm ${TEXT_BODY}`}>
              {BASE_RECOMMENDED_CLAUSES.map((clause) => (
                <li key={clause} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {clause}
                </li>
              ))}
            </ul>
          )}
          {recommendations.length > 0 && (
          <ul className="space-y-2">
            {recommendations.map((rec) => {
              const isAccepted = accepted.has(rec.clauseKey);
              const title = titleForRecommendation(rec.clauseKey);
              return (
                <li
                  key={rec.clauseKey}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${BORDER_DEFAULT}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{title}</p>
                      <span
                        className={`rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_TEXT[rec.severity] ?? TEXT_MUTED}`}
                      >
                        Recommended
                      </span>
                    </div>
                    <p className={`mt-1 text-sm ${TEXT_BODY}`}>{rec.reason}</p>
                  </div>
                  <Button
                    variant={isAccepted ? 'accent' : 'outline'}
                    size="sm"
                    onClick={() => onToggleRecommendation(rec.clauseKey)}
                  >
                    {isAccepted ? 'Accepted' : 'Accept'}
                  </Button>
                </li>
              );
            })}
          </ul>
          )}
        </div>
      </div>

      <div className={APP_SECTION_CARD}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Compliance</h2>
          <Button variant="outline" size="sm" onClick={onRunValidation}>
            Run Compliance Check
          </Button>
        </div>
        {showValidation ? (
          <ul className="space-y-1.5">
            {complianceIssues.map((issue, idx) => (
              <li key={`${issue.code}-${idx}`} className={`text-sm ${TEXT_BODY}`}>
                <span className={SEVERITY_TEXT[issue.severity] ?? TEXT_MUTED}>
                  [{issue.severity}]
                </span>{' '}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className={`text-sm ${TEXT_MUTED}`}>
            Complete the contract details to run compliance checks.
          </p>
        )}
      </div>
    </>
  );
}
