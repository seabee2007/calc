import React, { useState } from 'react';
import {
  FORM_ERROR,
  FORM_HELPER,
  FORM_INPUT,
  FORM_LABEL,
  FORM_LABEL_ERROR,
  FORM_LABEL_FOCUS,
  FORM_SELECT_CHEVRON_DARK,
  FORM_SELECT_CHEVRON_LIGHT,
} from '../../theme/appTheme';

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
  const baseSelectStyles = `${FORM_INPUT} appearance-none bg-no-repeat`;
  
  const conditionalStyles = error
    ? "border-red-300 focus:border-red-500 focus:ring-red-500 text-red-900 dark:text-red-100"
    : "";
  
  // Width style
  const widthStyle = fullWidth ? 'w-full' : '';
  
  // Combine all styles
  const selectStyles = `${baseSelectStyles} ${conditionalStyles} ${widthStyle} ${className}`;
  
  // Add background arrow indicator
  const backgroundStyle = `${FORM_SELECT_CHEVRON_LIGHT} ${FORM_SELECT_CHEVRON_DARK} bg-[center_right_1rem] bg-[length:1.5em_1.5em]`;
  
  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label 
          className={`${FORM_LABEL} ${
            error ? FORM_LABEL_ERROR : isFocused ? FORM_LABEL_FOCUS : ''
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
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {(helperText || error) && (
        <p className={`text-xs ${error ? FORM_ERROR : FORM_HELPER}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;