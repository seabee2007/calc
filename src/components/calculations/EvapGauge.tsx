import React from 'react';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface EvapGaugeProps {
  value: number;           // e in kg/m²·h
  thresholds: [number, number]; // [warn, danger]
}

const EvapGauge: React.FC<EvapGaugeProps> = ({ value, thresholds: [warn, danger] }) => {
  const getColor = () => {
    if (value > danger) return 'bg-red-500';
    if (value > warn) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getIcon = () => {
    if (value > danger) return <AlertCircle className="h-5 w-5 text-red-500" />;
    if (value > warn) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const percent = Math.min(100, (value / (danger * 1.5)) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {value > danger ? 'Critical' : value > warn ? 'Warning' : 'Normal'}
          </span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {value.toFixed(2)} kg/m²·h
        </span>
      </div>
      
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>0.0</span>
        <span>{warn}</span>
        <span>{danger}</span>
        <span>{(danger * 1.5).toFixed(1)}</span>
      </div>
    </div>
  );
};

export default EvapGauge;