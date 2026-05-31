import React from 'react';
import { motion } from 'framer-motion';
import {
  BORDER_DEFAULT,
  SHADOW_CARD,
  SURFACE,
  SURFACE_ELEVATED,
  SURFACE_GLASS,
  SURFACE_GLASS_PANEL,
} from '../../theme/appTheme';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  shadow?: 'sm' | 'md' | 'lg' | 'none';
  border?: boolean;
  hoverable?: boolean;
  clickable?: boolean;
  variant?: 'default' | 'elevated' | 'glass' | 'panel' | 'flat';
}

const Card: React.FC<CardProps> = ({
  children,
  shadow = 'md',
  border = false,
  hoverable = false,
  clickable = false,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variantStyles: Record<NonNullable<CardProps['variant']>, string> = {
    default: SURFACE,
    elevated: SURFACE_ELEVATED,
    glass: SURFACE_GLASS,
    panel: `${SURFACE_GLASS_PANEL} ${BORDER_DEFAULT}`,
    flat: 'bg-transparent',
  };

  const baseStyles = `${variantStyles[variant]} rounded-lg overflow-hidden backdrop-blur-sm transform-gpu`;

  const shadowStyles = {
    none: '',
    sm: SHADOW_CARD,
    md: SHADOW_CARD,
    lg: 'shadow-lg dark:shadow-xl',
  };

  const borderStyle = border || variant === 'panel' ? `border ${BORDER_DEFAULT}` : '';

  const hoverStyle = hoverable
    ? 'transition-all duration-300 ease-out hover:shadow-lg dark:hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01]'
    : '';

  const clickableStyle = clickable ? 'cursor-pointer' : '';

  const cardStyles = `${baseStyles} ${shadowStyles[shadow]} ${borderStyle} ${hoverStyle} ${clickableStyle} ${className}`;

  const cardVariants = {
    hover: { 
      y: -8,
      scale: 1.02,
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    tap: { 
      scale: 0.98,
      transition: { duration: 0.1 }
    }
  };

  return clickable ? (
    <motion.div
      className={cardStyles}
      whileHover={hoverable ? "hover" : undefined}
      whileTap={clickable ? "tap" : undefined}
      variants={cardVariants}
      {...props}
    >
      {children}
    </motion.div>
  ) : (
    <div className={cardStyles} {...props}>
      {children}
    </div>
  );
};

export default Card;