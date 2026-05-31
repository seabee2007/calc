import { useEffect, useRef } from 'react';

/** Shared scroll lock + Escape handler for modal layers. */
export function useModalLayer(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const savedScrollY = window.scrollY;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      window.scrollTo(0, savedScrollY);
    };
  }, [isOpen]);
}
