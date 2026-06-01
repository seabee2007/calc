import { ShieldAlert } from 'lucide-react';
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
import { RISK_STYLES, SEVERITY_TEXT } from '../contractBuilderConstants';

export interface CompliancePanelProps {
  risk: DocumentRiskScore;
  recommendations: DocumentRecommendation[];
  complianceIssues: DocumentComplianceIssue[];
  accepted: Set<string>;
  onToggleRecommendation: (clauseKey: string) => void;
}

export default function CompliancePanel({
  risk,
  recommendations,
  complianceIssues,
  accepted,
  onToggleRecommendation,
}: CompliancePanelProps) {
  return (
    <>
      <div className={APP_SECTION_CARD}>
        <div className="flex items-center justify-between">
          <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Contract risk</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold capitalize ${RISK_STYLES[risk.level]}`}
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            {risk.level} · {risk.score}/100
          </span>
        </div>
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
          <p className={`mt-2 text-sm ${TEXT_MUTED}`}>No elevated risk factors detected yet.</p>
        )}
      </div>

      {recommendations.length > 0 && (
        <div className={APP_SECTION_CARD}>
          <h2 className={`mb-3 text-sm font-semibold ${TEXT_FOREGROUND}`}>
            Recommended clauses & addenda
          </h2>
          <ul className="space-y-2">
            {recommendations.map((rec) => {
              const isAccepted = accepted.has(rec.clauseKey);
              return (
                <li
                  key={rec.clauseKey}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${BORDER_DEFAULT}`}
                >
                  <div className="min-w-0">
                    <p
                      className={`font-mono text-xs ${SEVERITY_TEXT[rec.severity] ?? TEXT_MUTED}`}
                    >
                      {rec.clauseKey} · {rec.severity}
                    </p>
                    <p className={`mt-0.5 text-sm ${TEXT_BODY}`}>{rec.reason}</p>
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
        </div>
      )}

      <div className={APP_SECTION_CARD}>
        <h2 className={`mb-3 text-sm font-semibold ${TEXT_FOREGROUND}`}>Compliance</h2>
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
      </div>
    </>
  );
}
