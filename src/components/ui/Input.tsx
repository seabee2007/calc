import React, { useState } from 'react';
import {
  FORM_ERROR,
  FORM_HELPER,
  FORM_INPUT,
  FORM_LABEL,
  FORM_LABEL_ERROR,
  FORM_LABEL_FOCUS,
  TEXT_FOREGROUND,
} from '../../theme/appTheme';

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
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e);
  };
  
  // Base styles
  const baseInputStyles = FORM_INPUT;
  
  const conditionalStyles = error
    ? "border-red-300 focus:border-red-500 focus:ring-red-500 text-red-900 dark:text-red-100 placeholder-red-300"
    : "";
  
  // Width style
  const widthStyle = fullWidth ? 'w-full' : '';
  
  // Combine all styles
  const spinnerStyles = type === 'number' ? 'no-number-spinner' : '';
  const inputStyles = `${baseInputStyles} ${conditionalStyles} ${widthStyle} ${spinnerStyles} ${className}`;
  
  // Label and container styles
  const containerStyles = `${fullWidth ? 'w-full' : ''} ${error ? 'text-red-900 dark:text-red-100' : TEXT_FOREGROUND}`;

  // Determine input mode and pattern based on type
  const inputMode = type === 'number' ? 'decimal' : undefined;
  const pattern = type === 'number' ? '[0-9]*\\.?[0-9]*' : undefined;

  // For iOS, use a larger font size to prevent zoom, then scale it back down
  const isIOSInput = type === 'number' || type === 'password';
  const fontSize = isIOSInput ? '16px' : undefined;
  
  return (
    <div className={containerStyles}>
      {label && (
        <label 
          className={`${FORM_LABEL} ${
            error ? FORM_LABEL_ERROR : isFocused ? FORM_LABEL_FOCUS : ''
          }`}
        >
          {label}
        </label>
      )}
      
      <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
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
        <p className={`${error ? FORM_ERROR : FORM_HELPER}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;