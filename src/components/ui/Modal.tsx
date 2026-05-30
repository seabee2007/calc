import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';

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
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={panelTransition}
            className={`pointer-events-auto relative z-10 flex w-full max-h-[min(90dvh,100%)] flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800 ${sizeClasses[size]}`}
            onClick={(e) => e.stopPropagation()}
          >
              <div className="flex shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>

                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 text-gray-800 dark:text-gray-200
                  [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:dark:text-white
                  [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:dark:text-white
                  [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:dark:text-white
                  [&_p]:leading-relaxed [&_p]:text-gray-800 [&_p]:dark:text-gray-200
                  [&_li]:leading-relaxed [&_li]:text-gray-800 [&_li]:dark:text-gray-200
                  [&_strong]:text-gray-900 [&_strong]:dark:text-white
                  [&_a]:text-blue-600 [&_a]:underline [&_a]:dark:text-blue-400
                  [&_hr]:border-gray-200 [&_hr]:dark:border-gray-700
                  [&_td]:text-gray-800 [&_td]:dark:text-gray-200
                  [&_th]:text-gray-900 [&_th]:dark:text-gray-100"
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
