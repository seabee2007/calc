import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../../domain/constructionActivityTypes';
import {
  computeEstimateReadiness,
  READINESS_NOTE,
  type EstimateReadinessSummary,
} from '../../application/estimateActivityReadiness';
import { getActivityResources } from '../../application/activityResourceService';

interface Props {
  activities: ProjectConstructionActivity[];
  lineItemsMap: Map<string, ProjectActivityLineItem[]>;
}

function scoreColorClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-slate-400';
}

function scoreTextClass(score: number): string {
  if (score >= 80) return 'text-emerald-700 dark:text-emerald-300';
  if (score >= 50) return 'text-amber-700 dark:text-amber-300';
  return 'text-slate-600 dark:text-slate-400';
}

function ProgressBar({ score, className = '' }: { score: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${scoreColorClass(score)}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export default function ActivitiesReadinessSummary({ activities, lineItemsMap }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [materialsMap, setMaterialsMap] = useState<Map<string, ActivityMaterialResource[]>>(new Map());
  const [equipmentMap, setEquipmentMap] = useState<Map<string, ActivityEquipmentResource[]>>(new Map());
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (activities.length === 0) {
      setMaterialsMap(new Map());
      setEquipmentMap(new Map());
      return;
    }

    let cancelled = false;
    setLoadingResources(true);

    void (async () => {
      const nextMaterials = new Map<string, ActivityMaterialResource[]>();
      const nextEquipment = new Map<string, ActivityEquipmentResource[]>();

      await Promise.all(
        activities.map(async (activity) => {
          const result = await getActivityResources(activity.id);
          if (cancelled) return;
          nextMaterials.set(activity.id, result.materials);
          nextEquipment.set(activity.id, result.equipment);
        }),
      );

      if (!cancelled) {
        setMaterialsMap(nextMaterials);
        setEquipmentMap(nextEquipment);
        setLoadingResources(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activities]);

  const summary: EstimateReadinessSummary = useMemo(
    () => computeEstimateReadiness(activities, lineItemsMap, materialsMap, equipmentMap),
    [activities, equipmentMap, lineItemsMap, materialsMap],
  );

  if (activities.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
      >
        <span className="text-slate-400">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Estimate Readiness
        </span>
        <span className={`ml-auto text-lg font-bold tabular-nums ${scoreTextClass(summary.overallScore)}`}>
          {summary.overallScore}%
        </span>
        {loadingResources && (
          <span className="text-[10px] text-slate-400">Updating…</span>
        )}
      </button>

      {!collapsed && (
        <div className="space-y-4 border-t border-slate-200 px-4 py-4 dark:border-slate-700">
          <ProgressBar score={summary.overallScore} />

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current scope: {summary.totalActivities} activit
            {summary.totalActivities === 1 ? 'y' : 'ies'}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Ready for review" value={summary.readyForReview} />
            <SummaryStat label="Needs quantity" value={summary.needsQuantity} />
            <SummaryStat label="Needs pricing" value={summary.needsPricing} />
            <SummaryStat label="Open flags" value={summary.openFlags} />
          </div>

          {summary.divisions.length > 0 && (
            <div className="space-y-2">
              {summary.divisions.map((division) => (
                <div key={division.divisionCode} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      Division {division.divisionCode} — {division.divisionName}
                    </span>
                    <span className={`font-semibold tabular-nums ${scoreTextClass(division.score)}`}>
                      {division.score}%
                    </span>
                  </div>
                  <ProgressBar score={division.score} />
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {READINESS_NOTE}
          </p>
        </div>
      )}
    </div>
  );
}
