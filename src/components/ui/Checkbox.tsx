import React from 'react';
import {
  FORM_ERROR,
  FOCUS_RING,
  TEXT_BODY,
} from '../../theme/appTheme';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500/60 dark:border-slate-600 dark:bg-slate-800 ${FOCUS_RING} ${className}`}
        {...props}
      />
      {label && (
        <label className={`ml-2 block text-sm ${TEXT_BODY}`}>
          {label}
        </label>
      )}
      {error && (
        <p className={`mt-1 text-xs ${FORM_ERROR}`}>{error}</p>
      )}
    </div>
  );
};

export default Checkbox;