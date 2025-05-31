import React, { useMemo } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Project } from '../../types';
import { CURE_PROFILES, MixProfileType } from '../../types/curing';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';

interface StrengthProgressProps {
  project?: Project;
  mixProfile?: MixProfileType;
  onMixProfileChange?: (profile: MixProfileType) => void;
  onPourDateChange?: (date: string) => void;
}

const StrengthProgress: React.FC<StrengthProgressProps> = ({ 
  project,
  mixProfile = 'standard',
  onMixProfileChange,
  onPourDateChange
}) => {
  const pourDateISO = project?.pourDate;
  if (!pourDateISO) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Strength Progress</h3>
        <p className="text-gray-600 dark:text-gray-300">
          Set a pour date to track concrete strength development over time.
        </p>
      </div>
    );
  }

  const pourDate = useMemo(() => {
    try {
      const d = parseISO(pourDateISO);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }, [pourDateISO]);

  if (!pourDate) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Strength Progress</h3>
        <p className="text-gray-600 dark:text-gray-300">Invalid pour date format.</p>
      </div>
    );
  }

  // Add fallback to standard profile if the provided mixProfile is invalid
  const profile = CURE_PROFILES[mixProfile] || CURE_PROFILES['standard'];
  const now = new Date();
  
  // Set both dates to noon UTC to avoid timezone issues
  const pourDateNoon = new Date(pourDate);
  pourDateNoon.setUTCHours(12, 0, 0, 0);
  const nowNoon = new Date(now);
  nowNoon.setUTCHours(12, 0, 0, 0);
  
  const daysPassed = Math.max(0, differenceInDays(nowNoon, pourDateNoon));

  // Calculate PSI based on mix profile and strength percentage
  const calculatePSI = (strengthPercentage: number) => {
    const basePSI = {
      standard: 3000,
      highEarly: 3000,
      highStrength: 5000,
      rapidSet: 4000
    }[mixProfile];

    return Math.round((strengthPercentage / 100) * basePSI);
  };
  
  // Find the current strength percentage
  const getCurrentStrength = () => {
    if (daysPassed >= 28) return 100;
    
    // Find the surrounding milestones
    let prevMilestone = profile[0];
    let nextMilestone = profile[profile.length - 1];
    
    for (let i = 0; i < profile.length - 1; i++) {
      if (daysPassed >= profile[i].day && daysPassed < profile[i + 1].day) {
        prevMilestone = profile[i];
        nextMilestone = profile[i + 1];
        break;
      }
    }
    
    // Linear interpolation between milestones
    const totalDays = nextMilestone.day - prevMilestone.day;
    const daysIn = daysPassed - prevMilestone.day;
    const progress = daysIn / totalDays;
    const strength = prevMilestone.pct + (nextMilestone.pct - prevMilestone.pct) * progress;
    
    return Math.min(100, Math.max(0, Math.round(strength)));
  };

  const currentStrength = getCurrentStrength();
  const currentPSI = calculatePSI(currentStrength);

  // Determine bar color based on current strength
  const getBarColor = (pct: number) => {
    if (pct <= 25) return 'bg-red-500';
    if (pct <= 50) return 'bg-orange-500';
    if (pct <= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const barColor = getBarColor(currentStrength);

  // Create milestone markers
  const milestones = profile.map(m => ({
    day: m.day,
    label: `${m.day}`,
    strength: `${m.pct}%`,
    psi: calculatePSI(m.pct),
    border: getBarColor(m.pct).replace('bg-', 'border-'),
    fill: getBarColor(m.pct)
  }));

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Strength Progress</h3>
          <div className="mt-2 space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pour Date
              </label>
              <Input
                type="date"
                value={pourDateISO.split('T')[0]}
                onChange={(e) => onPourDateChange?.(e.target.value)}
                className="w-40 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mix Profile
              </label>
              <Select
                options={[
                  { value: 'standard', label: 'Standard Mix' },
                  { value: 'highEarly', label: 'High Early' },
                  { value: 'highStrength', label: 'High Strength' },
                  { value: 'rapidSet', label: 'Rapid Set' }
                ]}
                value={mixProfile}
                onChange={(value) => onMixProfileChange?.(value as MixProfileType)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative pt-6 pb-8">
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-full" />
        <div
          className={`absolute top-6 left-0 h-4 rounded-full transition-all duration-300 ease-in-out ${barColor}`}
          style={{ width: `${(daysPassed / 28) * 100}%` }}
        />
        <div className="absolute top-0 left-0 w-full">
          {milestones.map((m, i) => {
            const pos = (m.day / 28) * 100;
            const passed = daysPassed >= m.day;
            return (
              <div
                key={i}
                className="absolute transform -translate-x-1/2"
                style={{ left: `${pos}%` }}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mb-1 ${
                    passed ? m.fill : `bg-white dark:bg-gray-800 ${m.border}`
                  }`}
                />
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap md:block hidden">
                  {m.label} Days
                </div>
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap block md:hidden">
                  {m.label}
                </div>
                <div className={`text-xs ${passed ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'} md:block hidden`}>
                  {m.strength} ({m.psi} PSI)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-blue-900 dark:text-blue-100">Current Strength</h4>
          <div className="text-right">
            <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{currentStrength}%</span>
            <span className="text-sm text-blue-600 dark:text-blue-400 ml-2">({currentPSI} PSI)</span>
          </div>
        </div>
        <p className="text-sm text-blue-600">
          {daysPassed} days since pour • {28 - daysPassed} days until full strength
        </p>
      </div>
    </div>
  );
};

export default StrengthProgress;