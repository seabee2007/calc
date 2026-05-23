import React from 'react';
import { format } from 'date-fns';
import { Droplets, Thermometer, Wind, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '../ui/Card';
import {
  ScoredPourDay,
  ratingColor,
  ratingLabel,
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

  return (
    <Card
      className={`p-4 border-l-4 ${ratingBorderClass[color]} ${selected ? 'ring-2' : ''} transition-all`}
      hoverable={!!onSelect}
      clickable={!!onSelect}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formattedDate}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
            {day.conditions}
          </p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${ratingBgClass[color]} text-gray-800 dark:text-gray-100`}>
          {ratingLabel(day.rating)} · {day.score}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          <Thermometer className="h-3.5 w-3.5" />
          <span>{Math.round(day.minTemp)}–{Math.round(day.maxTemp)}°F</span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          <Droplets className="h-3.5 w-3.5" />
          <span>{day.chanceOfRain}%</span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          <Wind className="h-3.5 w-3.5" />
          <span>{Math.round(day.maxWindSpeed)} mph</span>
        </div>
      </div>

      {day.reasons.length > 0 && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
          {day.reasons[0]}
        </p>
      )}

      {onToggle && (day.precautions.length > 0 || day.reasons.length > 1) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Less detail' : 'Pour guidance'}
        </button>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
          {day.reasons.map((r, i) => (
            <p key={`r-${i}`} className="text-xs text-gray-700 dark:text-gray-300">• {r}</p>
          ))}
          {day.precautions.map((p, i) => (
            <p key={`p-${i}`} className="text-xs text-amber-800 dark:text-amber-200">→ {p}</p>
          ))}
        </div>
      )}
    </Card>
  );
};

export default PourDayCard;
