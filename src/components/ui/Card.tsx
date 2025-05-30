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
  const baseStyles = 'bg-white dark:bg-gray-800 rounded-lg overflow-hidden backdrop-blur-sm transform-gpu';
  
  // Shadow styles with more pronounced 3D effect
  const shadowStyles = {
    sm: 'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2),0_2px_4px_-2px_rgba(0,0,0,0.15)]',
    md: 'shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.2),0_4px_6px_-4px_rgba(0,0,0,0.15)]',
    lg: 'shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.2),0_8px_10px_-6px_rgba(0,0,0,0.15)]'
  };
  
  // Border style
  const borderStyle = border ? 'border border-slate-200 dark:border-gray-700' : '';
  
  // Enhanced hover style with 3D transform
  const hoverStyle = hoverable ? 'transition-all duration-300 ease-out hover:shadow-[0_25px_30px_-12px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_25px_30px_-12px_rgba(0,0,0,0.25)] hover:-translate-y-2 hover:scale-[1.02]' : '';
  
  // Clickable style
  const clickableStyle = clickable ? 'cursor-pointer' : '';
  
  // Combine all styles
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