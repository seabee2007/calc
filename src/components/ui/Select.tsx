import React, { useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  options: Option[];
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  options,
  error,
  helperText,
  fullWidth = false,
  className = '',
  onChange,
  value,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(true);
    if (props.onFocus) props.onFocus(e);
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(false);
    if (props.onBlur) props.onBlur(e);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };
  
  // Base styles
  const baseSelectStyles = "block w-full px-4 py-2 bg-white border rounded-md text-sm appearance-none bg-no-repeat transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0";
  
  // Conditional styles based on error state
  const conditionalStyles = error
    ? "border-red-300 focus:border-red-500 focus:ring-red-500 text-red-900"
    : "border-slate-300 focus:border-blue-500 focus:ring-blue-500";
  
  // Width style
  const widthStyle = fullWidth ? 'w-full' : '';
  
  // Combine all styles
  const selectStyles = `${baseSelectStyles} ${conditionalStyles} ${widthStyle} ${className}`;
  
  // Add background arrow indicator
  const backgroundStyle = `bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")] bg-[center_right_1rem] bg-[length:1.5em_1.5em]`;
  
  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label 
          className={`block text-sm font-medium mb-1 ${
            error ? 'text-red-500' : isFocused ? 'text-blue-600' : 'text-slate-700'
          }`}
        >
          {label}
        </label>
      )}
      
      <select
        ref={ref}
        className={`${selectStyles} ${backgroundStyle}`}
        value={value}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {(helperText || error) && (
        <p className={`mt-1 text-xs ${error ? 'text-red-500' : 'text-slate-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;