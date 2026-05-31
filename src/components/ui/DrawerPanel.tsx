import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DRAWER_CLOSE_BTN,
  DRAWER_HEADER,
  DRAWER_PANEL,
  TEXT_FOREGROUND,
} from '../../theme/appTheme';

export interface DrawerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Right-side (default) or bottom sheet on small screens. */
  variant?: 'side' | 'bottom';
  className?: string;
  headerClassName?: string;
  zClassName?: string;
}

export default function DrawerPanel({
  isOpen,
  onClose,
  title,
  children,
  variant = 'side',
  className = '',
  headerClassName = '',
  zClassName = 'z-planner-drawer',
}: DrawerPanelProps) {
  const panelClass =
    variant === 'bottom'
      ? `fixed inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-2xl ${DRAWER_PANEL} ${className}`
      : `fixed inset-y-0 right-0 flex w-full max-w-lg flex-col ${DRAWER_PANEL} ${className}`;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 ${zClassName} flex justify-end`}>
          <motion.button
            type="button"
            aria-label="Close drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 dark:bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={variant === 'bottom' ? { y: '100%' } : { x: '100%' }}
            animate={variant === 'bottom' ? { y: 0 } : { x: 0 }}
            exit={variant === 'bottom' ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            className={panelClass}
            role="dialog"
            aria-modal="true"
          >
            {(title || onClose) && (
              <div className={`${DRAWER_HEADER} ${headerClassName}`}>
                {title ? (
                  <h2 className={`text-lg font-semibold ${TEXT_FOREGROUND}`}>{title}</h2>
                ) : (
                  <span />
                )}
                <button type="button" onClick={onClose} className={DRAWER_CLOSE_BTN} aria-label="Close">
                  ×
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
