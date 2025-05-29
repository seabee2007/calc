import React from 'react';

interface StrengthProgressBarProps {
  /** Progress from 0 to 100 */
  percentage: number;
  /** Optional label (e.g. "Day 3 of 7", "75% Strength") */
  label?: string;
}

const StrengthProgressBar: React.FC<StrengthProgressBarProps> = ({
  percentage,
  label
}) => {
  // clamp 0–100
  const pct = Math.max(0, Math.min(100, percentage));

  return (
    <div className="w-full">
      <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
        {/* Animated fill */}
        <div
          className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* Centered label */}
        {label && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-medium text-white drop-shadow">
              {label}
            </span>
          </div>
        )}
      </div>
      {/* Percentage text below bar */}
      <div className="mt-1 text-right text-xs font-medium text-gray-600">
        {pct}% complete
      </div>
    </div>
  );
};

export default StrengthProgressBar;