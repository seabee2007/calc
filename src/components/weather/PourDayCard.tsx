import React from 'react';
import { format } from 'date-fns';
import {
  Droplets,
  Thermometer,
  Wind,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
} from 'lucide-react';
import Card from '../ui/Card';
import EvapGauge from '../calculations/EvapGauge';
import {
  ScoredPourDay,
  ratingColor,
  ratingLabel,
  confidenceLabel,
  evaporationRiskLabel,
  finishabilityLabel,
  formatTimeWindow,
  findBestTimeOfDayWindow,
} from '../../utils/pourScoring';

interface PourDayCardProps {
  day: ScoredPourDay;
  expanded?: boolean;
  onToggle?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}

const ratingBorderClass: Record<string, string> = {
  green: 'border-green-500 ring-green-500/30',
  emerald: 'border-emerald-500 ring-emerald-500/30',
  yellow: 'border-yellow-500 ring-yellow-500/30',
  orange: 'border-orange-500 ring-orange-500/30',
  red: 'border-red-500 ring-red-500/30',
};

const ratingBgClass: Record<string, string> = {
  green: 'bg-green-50 dark:bg-green-900/20',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
  orange: 'bg-orange-50 dark:bg-orange-900/20',
  red: 'bg-red-50 dark:bg-red-900/20',
};

const PourDayCard: React.FC<PourDayCardProps> = ({
  day,
  expanded = false,
  onToggle,
  selected = false,
  onSelect,
}) => {
  const color = ratingColor(day.rating);
  const formattedDate = format(new Date(day.date + 'T12:00:00'), 'EEE, MMM d');
  const bestTime = findBestTimeOfDayWindow(day);
  const showMitigationBoost =
    day.mitigationCredit > 0 && day.score !== day.baseScore;

  return (
    <Card
      className={`p-4 border-l-4 ${ratingBorderClass[color]} ${selected ? 'ring-2' : ''} transition-all`}
      hoverable={!!onSelect}
      clickable={!!onSelect}
      onClick={onSelect}
    >
      {day.criticalFail && (
        <div className="mb-3 p-2 rounded-md bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700">
          <div className="flex items-start gap-2">
            <AlertOctagon className="h-4 w-4 text-red-700 dark:text-red-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-900 dark:text-red-100">
                Critical Placement Warning
              </p>
              <p className="text-xs text-red-800 dark:text-red-200 mt-0.5">
                {day.criticalMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formattedDate}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
            {day.conditions}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Forecast confidence: {confidenceLabel(day.forecastConfidence)}
          </p>
        </div>
        <div className="text-right">
          <div
            className={`px-2 py-1 rounded-full text-xs font-medium ${ratingBgClass[color]} text-gray-800 dark:text-gray-100`}
          >
            {ratingLabel(day.rating)} · {day.score}
          </div>
          {showMitigationBoost && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              Base {day.baseScore} +{day.mitigationCredit}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          <Thermometer className="h-3.5 w-3.5" />
          <span>
            {Math.round(day.minTemp)}–{Math.round(day.maxTemp)}°F
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          <Droplets className="h-3.5 w-3.5" />
          <span>{day.chanceOfRain}% rain</span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          <Wind className="h-3.5 w-3.5" />
          <span>{Math.round(day.maxWindSpeed)} mph</span>
        </div>
        {day.avgHumidity != null && (
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
            <span className="text-gray-400">RH</span>
            <span>{Math.round(day.avgHumidity)}%</span>
          </div>
        )}
      </div>

      {bestTime && !day.criticalFail && (
        <p className="mt-2 text-xs text-cyan-800 dark:text-cyan-200">
          Best window: {formatTimeWindow(bestTime)} · est. {bestTime.estimatedScore} (
          {ratingLabel(bestTime.estimatedRating)})
        </p>
      )}

      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
        Finishability: <span className="font-medium">{finishabilityLabel(day.finishability)}</span>
      </p>

      {day.primaryRisks.length > 0 && (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
          {day.primaryRisks[0]}
        </p>
      )}

      {onToggle &&
        (day.recommendedActions.length > 0 ||
          day.primaryRisks.length > 1 ||
          day.evaporationRateKgM2H != null) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Less detail' : 'Placement guidance'}
          </button>
        )}

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
          {day.evaporationRateKgM2H != null && (
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
                ACI evaporation risk ({evaporationRiskLabel(day.evaporationRisk)})
              </p>
              <EvapGauge
                value={day.evaporationRateKgM2H}
                thresholds={[0.5, 1.0]}
              />
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                &lt;0.5 low · 0.5–1.0 moderate · &gt;1.0 severe (kg/m²/h)
              </p>
            </div>
          )}

          {day.primaryRisks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
                Primary risks
              </p>
              {day.primaryRisks.map((r, i) => (
                <p key={`r-${i}`} className="text-xs text-gray-700 dark:text-gray-300">
                  • {r}
                </p>
              ))}
            </div>
          )}

          {day.recommendedActions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
                Recommended actions
              </p>
              {day.recommendedActions.map((p, i) => (
                <p key={`p-${i}`} className="text-xs text-amber-800 dark:text-amber-200">
                  → {p}
                </p>
              ))}
            </div>
          )}

          {day.finishabilityIssues.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
                Expected finishing issues
              </p>
              {day.finishabilityIssues.map((issue, i) => (
                <p key={`f-${i}`} className="text-xs text-gray-700 dark:text-gray-300">
                  • {issue}
                </p>
              ))}
            </div>
          )}

          {day.severeWeatherCapApplied && (
            <p className="text-xs text-orange-700 dark:text-orange-300">
              Score capped at {25} due to severe weather in forecast.
            </p>
          )}
        </div>
      )}
    </Card>
  );
};

export default PourDayCard;
