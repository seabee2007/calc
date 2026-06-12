import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';
import {
  MODAL_BODY,
  MODAL_CLOSE_BTN,
  MODAL_HEADER,
  MODAL_PANEL,
  MODAL_TITLE,
} from '../../theme/appTheme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Stack above planner task drawer (z 10050). */
  stackAboveDrawer?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  stackAboveDrawer = false,
}) => {
  const prevIsOpen = useRef(isOpen);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const overlayTransition = { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };
  const panelTransition = { type: 'spring' as const, damping: 28, stiffness: 300 };

  const modalContent = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="modal-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayTransition}
          className={
            stackAboveDrawer
              ? 'fixed inset-0 z-[10101] flex items-center justify-center overflow-hidden p-4'
              : 'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4'
          }
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] dark:bg-black/60"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={panelTransition}
            className={`pointer-events-auto relative z-10 flex w-full max-h-[min(90dvh,100%)] flex-col ${MODAL_PANEL} ${sizeClasses[size]}`}
            onClick={(e) => e.stopPropagation()}
          >
              <div className={MODAL_HEADER}>
                <h2 className={MODAL_TITLE}>
                  {title}
                </h2>

                <button
                  type="button"
                  onClick={handleClose}
                  className={MODAL_CLOSE_BTN}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                className={`${MODAL_BODY}
                  [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:dark:text-slate-50
                  [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:dark:text-slate-50
                  [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:dark:text-slate-50
                  [&_h4]:font-medium [&_h4]:text-slate-800 [&_h4]:dark:text-slate-100
                  [&_p]:leading-relaxed [&_p]:text-slate-700 [&_p]:dark:text-slate-300
                  [&_li]:leading-relaxed [&_li]:text-slate-700 [&_li]:dark:text-slate-300
                  [&_strong]:font-semibold [&_strong]:text-slate-900 [&_strong]:dark:text-slate-50
                  [&_a]:text-cyan-700 [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors
                  [&_a]:hover:text-cyan-600 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2
                  [&_a]:focus-visible:ring-cyan-500/60 [&_a]:rounded-sm
                  [&_a]:dark:text-cyan-400 [&_a]:dark:hover:text-cyan-300
                  [&_address]:not-italic [&_address]:text-slate-700 [&_address]:dark:text-slate-300
                  [&_hr]:border-slate-200 [&_hr]:dark:border-slate-700/70
                  [&_td]:text-slate-800 [&_td]:dark:text-slate-200
                  [&_th]:text-slate-900 [&_th]:dark:text-slate-100`}
              >
                {children}
              </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
