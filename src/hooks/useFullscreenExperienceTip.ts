import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import {
  FULLSCREEN_EXPERIENCE_TIP_DELAY_MS,
  isFullscreenExperienceTipPathAllowed,
  markFullscreenExperienceTipShownThisSession,
  setFullscreenExperienceTipDismissed,
  shouldShowFullscreenExperienceTip,
} from '../utils/fullscreenExperienceTip';

export function useFullscreenExperienceTip() {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const hasScheduledRef = useRef(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (!shouldShowFullscreenExperienceTip({ hasUser: true, pathname })) return;
    if (hasScheduledRef.current) return;

    hasScheduledRef.current = true;

    const timer = window.setTimeout(() => {
      const currentPath = window.location.pathname;
      if (!user) return;
      if (!isFullscreenExperienceTipPathAllowed(currentPath)) return;
      if (
        !shouldShowFullscreenExperienceTip({
          hasUser: true,
          pathname: currentPath,
        })
      ) {
        return;
      }

      markFullscreenExperienceTipShownThisSession();
      setIsOpen(true);
    }, FULLSCREEN_EXPERIENCE_TIP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [authLoading, user, pathname]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const dismissPermanently = useCallback(() => {
    setFullscreenExperienceTipDismissed();
    setIsOpen(false);
  }, []);

  const confirm = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain) {
        dismissPermanently();
        return;
      }
      close();
    },
    [close, dismissPermanently],
  );

  return {
    isOpen,
    close,
    dismissPermanently,
    confirm,
  };
}
