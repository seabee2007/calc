import React from 'react';
import { motion } from 'framer-motion';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  shadow?: 'sm' | 'md' | 'lg';
  border?: boolean;
  hoverable?: boolean;
  clickable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  shadow = 'md',
  border = false,
  hoverable = false,
  clickable = false,
  className = '',
  ...props
}) => {
  // Base styles
  const baseStyles = 'bg-white rounded-lg overflow-hidden';
  
  // Shadow styles
  const shadowStyles = {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg'
  };
  
  // Border style
  const borderStyle = border ? 'border border-slate-200' : '';
  
  // Hover style
  const hoverStyle = hoverable ? 'transition-all duration-200 hover:shadow-lg' : '';
  
  // Clickable style
  const clickableStyle = clickable ? 'cursor-pointer' : '';
  
  // Combine all styles
  const cardStyles = `${baseStyles} ${shadowStyles[shadow]} ${borderStyle} ${hoverStyle} ${clickableStyle} ${className}`;

  const cardVariants = {
    hover: { 
      y: -5,
      transition: { duration: 0.2 }
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