import React from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import type { OpsRiskLevel } from '../../utils/operationsDashboard';

interface ReadinessIssueRow {
  message: string;
  fixPath: string;
  fixSearch?: string;
}

interface SmartPourAssistantProps {
  readinessScore: number;
  weatherRisk: OpsRiskLevel;
  issues: ReadinessIssueRow[];
  hasPlacementsToday: boolean;
}

function readinessLevel(score: number, issueCount: number): string {
  if (issueCount >= 3 || score < 50) return 'LOW';
  if (issueCount >= 1 || score < 75) return 'MODERATE';
  return 'HIGH';
}

const SmartPourAssistant: React.FC<SmartPourAssistantProps> = ({
  readinessScore,
  weatherRisk,
  issues,
  hasPlacementsToday,
}) => {
  const navigate = useNavigate();
  const level = readinessLevel(readinessScore, issues.length);
  const fixTarget = issues[0];

  return (
    <OpsCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <h3 className="font-semibold text-white">Placement readiness</h3>
        </div>
        <span
          className={`text-sm font-bold uppercase ${
            level === 'HIGH'
              ? 'text-emerald-400'
              : level === 'MODERATE'
                ? 'text-amber-400'
                : 'text-red-400'
          }`}
        >
          {level}
        </span>
      </div>

      {!hasPlacementsToday ? (
        <p className="text-sm text-slate-400">
          Schedule a placement to see readiness checks for weather, plant, and call
          sheet.
        </p>
      ) : issues.length === 0 ? (
        <p className="text-sm text-slate-300">
          No blocking issues — confirm truck spacing with the crew before first load.
          {weatherRisk !== 'low' && (
            <span className="block mt-2 text-amber-400/90">
              Weather risk is {weatherRisk}; follow mitigations above.
            </span>
          )}
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500 uppercase mb-2">Issues</p>
          <ul className="space-y-2 mb-4">
            {issues.map((issue) => (
              <li
                key={issue.message}
                className="flex gap-2 text-sm text-slate-300 bg-slate-800/50 rounded-lg p-2 border border-slate-700/80"
              >
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
          {fixTarget && (
            <Button
              size="sm"
              className="!bg-violet-700 hover:!bg-violet-600 !text-white w-full sm:w-auto"
              onClick={() =>
                navigate(`${fixTarget.fixPath}${fixTarget.fixSearch ?? ''}`)
              }
            >
              Fix Issues
            </Button>
          )}
        </>
      )}
    </OpsCard>
  );
};

export default SmartPourAssistant;
