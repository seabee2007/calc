import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';
import {
  BORDER_DEFAULT,
  CARD_PADDING,
  FOCUS_RING,
  MODAL_CLOSE_BTN,
  MODAL_PANEL,
  MODAL_TITLE,
  SECTION_SPACING,
  TEXT_BODY,
  TEXT_MUTED,
} from '../../theme/appTheme';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** e.g. "Step 1 of 3" */
  progressLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  stackAboveDrawer?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-5xl',
};

const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  progressLabel,
  children,
  footer,
  size = 'lg',
  stackAboveDrawer = false,
}) => {
  const prevIsOpen = useRef(isOpen);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      soundService.play('modal');
      hapticService.modal();
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const savedScrollY = window.scrollY;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundService.play('click');
        hapticService.button();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      window.scrollTo(0, savedScrollY);
    };
  }, [isOpen]);

  const handleClose = () => {
    soundService.play('click');
    hapticService.button();
    onClose();
  };

  const overlayTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };
  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 28, stiffness: 300 };

  const modalContent = (
    <AnimatePresence mode="wait">
      {isOpen ? (
        <motion.div
          key="modal-shell-layer"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={overlayTransition}
          className={`fixed inset-0 ${stackAboveDrawer ? 'z-[10101]' : 'z-[9999]'} flex items-center justify-center overflow-hidden p-4`}
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 1rem)',
            paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
            paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
            paddingRight: 'max(env(safe-area-inset-right), 1rem)',
          }}
        >
          <motion.div
            role="presentation"
            aria-hidden
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={overlayTransition}
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-shell-title"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 20, scale: 0.96 }}
            transition={panelTransition}
            className={`pointer-events-auto relative z-10 flex max-h-[min(90dvh,100%)] w-full flex-col rounded-modal ${MODAL_PANEL} ${sizeClasses[size]}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex shrink-0 items-start justify-between border-b ${CARD_PADDING} ${BORDER_DEFAULT}`}>
              <div className="min-w-0 pr-4">
                {progressLabel ? (
                  <p className={`mb-1 text-xs font-medium uppercase tracking-widest ${TEXT_MUTED}`}>
                    {progressLabel}
                  </p>
                ) : null}
                <h2 id="modal-shell-title" className={MODAL_TITLE}>
                  {title}
                </h2>
                {subtitle ? (
                  <p className={`mt-1 text-sm ${TEXT_BODY}`}>{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className={`${MODAL_CLOSE_BTN} ${FOCUS_RING}`}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${CARD_PADDING} ${SECTION_SPACING} ${TEXT_BODY}`}>
              {children}
            </div>

            {footer ? (
              <div
                className={`sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t ${CARD_PADDING} ${BORDER_DEFAULT} bg-white dark:bg-slate-800`}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default ModalShell;
