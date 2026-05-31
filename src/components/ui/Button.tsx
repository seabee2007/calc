import React from 'react';
import { motion } from 'framer-motion';
import { hapticService } from '../../services/hapticService';

/**
 * Variants: primary (blue CTA), accent (cyan ops/planner), secondary, outline, ghost, danger.
 * Selection tiles / icon-only menu triggers may use raw <button> — see app button audit.
 */
type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
  as?: 'button' | 'a';
  href?: string;
  target?: string;
  rel?: string;
}

const focusRingByVariant: Record<ButtonVariant, string> = {
  primary: 'focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400',
  accent: 'focus-visible:ring-cyan-500 dark:focus-visible:ring-cyan-400',
  secondary: 'focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400',
  outline: 'focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400',
  ghost: 'focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400',
  danger: 'focus-visible:ring-red-500 dark:focus-visible:ring-red-400',
};

const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  as = 'button',
  href,
  target,
  rel,
  onClick,
  ...props
}, ref) => {
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (variant === 'danger') {
      await hapticService.heavy();
    } else if (variant === 'primary' || variant === 'accent') {
      await hapticService.medium();
    } else {
      await hapticService.light();
    }

    if (onClick) {
      onClick(e as React.MouseEvent<HTMLButtonElement>);
    }
  };

  const baseStyles =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none dark:focus-visible:ring-offset-gray-800';

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 dark:active:bg-blue-800',
    accent:
      'bg-cyan-600 text-white hover:bg-cyan-500 active:bg-cyan-700 dark:bg-cyan-600 dark:text-white dark:hover:bg-cyan-500 dark:active:bg-cyan-700',
    secondary:
      'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:active:bg-gray-500',
    outline:
      'border border-slate-300 bg-transparent hover:bg-slate-100 text-slate-900 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-900 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white',
    danger:
      'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-11 px-6 text-lg',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  const classes = `${baseStyles} ${focusRingByVariant[variant]} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`;

  const content = (
    <>
      {isLoading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {icon && !isLoading && <span className="mr-2">{icon}</span>}

      {children}
    </>
  );

  if (as === 'a') {
    return (
      <motion.div whileTap={{ scale: 0.97 }} className="inline-block">
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          href={href}
          target={target}
          rel={rel}
          onClick={handleClick}
        >
          {content}
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div whileTap={{ scale: 0.97 }} className={fullWidth ? 'block w-full' : 'inline-block'}>
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        disabled={isLoading || disabled}
        onClick={handleClick}
        {...props}
      >
        {content}
      </button>
    </motion.div>
  );
});

Button.displayName = 'Button';

export default Button;
