import React, { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  helperText,
  error,
  fullWidth = false,
  className = '',
  icon,
  onFocus,
  onBlur,
  type,
  value,
  onChange,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setHasInteracted(true);
    if (onFocus) onFocus(e);
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasInteracted(true);
    if (onChange) onChange(e);
  };
  
  // Base styles
  const baseInputStyles = "block px-4 py-2 bg-white dark:bg-gray-900 border rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0";
  
  // Conditional styles
  const conditionalStyles = error
    ? "border-red-300 focus:border-red-500 focus:ring-red-500 text-red-900 dark:text-red-100 placeholder-red-300"
    : "border-slate-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 dark:text-white dark:placeholder-gray-500";
  
  // Width style
  const widthStyle = fullWidth ? 'w-full' : '';
  
  // Combine all styles
  const inputStyles = `${baseInputStyles} ${conditionalStyles} ${widthStyle} ${className}`;
  
  // Label and container styles
  const containerStyles = `${fullWidth ? 'w-full' : ''} ${error ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-white'}`;

  // Determine input mode and pattern based on type
  const inputMode = type === 'number' ? 'decimal' : undefined;
  const pattern = type === 'number' ? '[0-9]*\\.?[0-9]*' : undefined;

  // For iOS, use a larger font size to prevent zoom, then scale it back down
  const isIOSInput = type === 'number' || type === 'password';
  const fontSize = isIOSInput ? '16px' : undefined;

  // Handle the display value
  const displayValue = hasInteracted || !props.placeholder ? value : '';
  
  return (
    <div className={containerStyles}>
      {label && (
        <label 
          className={`block text-sm font-medium mb-1 ${
            error ? 'text-red-500 dark:text-red-400' : isFocused ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-gray-300'
          }`}
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          className={inputStyles}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          value={value}
          inputMode={inputMode}
          pattern={pattern}
          style={{ 
            fontSize,
            paddingLeft: icon ? '2.5rem' : undefined,
            ...props.style
          }}
          {...props}
          placeholder={isFocused ? '' : props.placeholder}
        />
      </div>
      
      {(helperText || error) && (
        <p className={`mt-1 text-sm ${error ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;