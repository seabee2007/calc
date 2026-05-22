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
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  const prevIsOpen = useRef(isOpen);
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      soundService.play('modal');
      hapticService.modal();
    }

    prevIsOpen.current = isOpen;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundService.play('click');
        hapticService.button();
        onClose();
      }
    };

    if (isOpen) {
      scrollYRef.current = window.scrollY;
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollYRef.current);
      });
    };
  }, [isOpen, onClose]);

  const handleClose = () => {
    soundService.play('click');
    hapticService.button();
    onClose();
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/50"
            onClick={handleClose}
          />

          <div className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain">
            <div
              className="flex min-h-[100dvh] items-center justify-center p-4"
              style={{
                paddingTop: 'max(env(safe-area-inset-top), 1rem)',
                paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
                paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
                paddingRight: 'max(env(safe-area-inset-right), 1rem)'
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ type: 'spring', damping: 20 }}
                className={`relative w-full ${sizeClasses[size]}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-lg bg-white shadow-xl dark:bg-gray-800">
                  <div className="flex items-center justify-between border-b p-4 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {title}
                    </h2>

                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-400"
                      aria-label="Close modal"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="max-h-[75dvh] overflow-y-auto overscroll-contain">
  <div
    className="
      p-6
      text-gray-800
      dark:text-gray-200

      [&_h1]:text-gray-900
      [&_h1]:dark:text-white
      [&_h1]:font-bold

      [&_h2]:text-gray-900
      [&_h2]:dark:text-white
      [&_h2]:font-semibold

      [&_h3]:text-gray-900
      [&_h3]:dark:text-white
      [&_h3]:font-semibold

      [&_p]:text-gray-700
      [&_p]:dark:text-gray-300
      [&_p]:leading-relaxed

      [&_li]:text-gray-700
      [&_li]:dark:text-gray-300
      [&_li]:leading-relaxed

      [&_strong]:text-gray-900
      [&_strong]:dark:text-white

      [&_a]:text-blue-600
      [&_a]:dark:text-blue-400
      [&_a]:underline

      [&_hr]:border-gray-200
      [&_hr]:dark:border-gray-700
    "
  >
    {children}
  </div>
</div>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;