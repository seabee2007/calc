import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import BottomNav from './BottomNav';
import ToolsModal from '../workflow/ToolsModal';
import MoreMenuModal from '../workflow/MoreMenuModal';
import { useAuth } from '../../hooks/useAuth';
import { isPlannerWorkspacePath } from '../../utils/plannerRoutes';
import SiteBackground from './SiteBackground';
import PageErrorBoundary from './PageErrorBoundary';
import { COLOR_CANVAS_DARK, COLOR_CANVAS_LIGHT } from '../../theme/appTheme';
import { usesPremiumCanvas } from '../../utils/premiumCanvasRoutes';
import { isPublicLegalPath, usesPublicMarketingShell } from '../../utils/publicMarketingRoutes';

const Layout: React.FC = () => {
  const location = useLocation();
  const { user, isEmployee } = useAuth();

  const isPlannerWorkspace = isPlannerWorkspacePath(location.pathname);
  const isEmployeeRoute =
    location.pathname.startsWith('/employee') &&
    !location.pathname.startsWith('/employee/tasks');

  const isPublicProposal = location.pathname.startsWith('/proposal/');
  const isPublicClientPortal = location.pathname.startsWith('/client/project/');

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/auth/callback' ||
    location.pathname === '/reset-password' ||
    location.pathname.startsWith('/invite/') ||
    isPublicProposal ||
    isPublicClientPortal;

  const isLoggedOutLanding = location.pathname === '/' && !user;
  const isPublicLegalPage = isPublicLegalPath(location.pathname);
  const useMarketingShell = usesPublicMarketingShell(location.pathname, isLoggedOutLanding);
  const premiumCanvas = usesPremiumCanvas(location.pathname);

  const showBottomNav =
    Boolean(user) &&
    !isAuthPage &&
    !isEmployeeRoute &&
    !isEmployee &&
    !isPlannerWorkspace;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const resizeHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    const setThemeColors = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const bgColor = isDark ? COLOR_CANVAS_DARK : COLOR_CANVAS_LIGHT;
      const metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');

      document.documentElement.style.backgroundColor = bgColor;
      document.body.style.backgroundColor = bgColor;

      if (isDark) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }

      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', bgColor);
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('resize', resizeHeight);
    window.addEventListener('orientationchange', resizeHeight);

    resizeHeight();
    setThemeColors();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setThemeColors();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', resizeHeight);
      window.removeEventListener('orientationchange', resizeHeight);
      observer.disconnect();
    };
  }, []);

  if (isAuthPage || isPlannerWorkspace) {
    return <Outlet />;
  }

  return (
    <div
      className={
        useMarketingShell
          ? 'auth-page-bg relative min-h-screen w-screen overflow-x-hidden text-white'
          : 'min-h-screen w-screen overflow-x-hidden bg-slate-50 dark:bg-slate-950'
      }
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {!useMarketingShell && (
        <SiteBackground forceDark={isLoggedOutLanding} solidCanvas={premiumCanvas} />
      )}

      {useMarketingShell ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(27,166,181,0.18),transparent_34%)]"
          aria-hidden="true"
        />
      ) : null}

      {/* App content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar
          showThemeToggle={!useMarketingShell}
          softHeader={isLoggedOutLanding || (isPublicLegalPage && !user)}
        />

        <main
          className={`relative mx-auto w-full flex-grow px-4 py-8 sm:px-6 lg:px-8 ${
            premiumCanvas ? 'max-w-[88rem]' : 'max-w-7xl'
          }${useMarketingShell ? ' text-white' : ''}`}
          style={{
            paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
            paddingRight: 'max(env(safe-area-inset-right), 1rem)',
            marginTop: 'calc(3rem + env(safe-area-inset-top))',
            minHeight: 'auto',
          }}
        >
          <PageErrorBoundary title="This page failed to load">
            <Outlet />
          </PageErrorBoundary>
        </main>

        <Footer />

        {showBottomNav && <BottomNav />}

        {user && !isEmployee && !isEmployeeRoute && (
          <>
            <ToolsModal />
            <MoreMenuModal />
          </>
        )}
      </div>
    </div>
  );
};

export default Layout;