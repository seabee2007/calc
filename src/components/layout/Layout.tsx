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
    isPublicProposal ||
    isPublicClientPortal;

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
      className="min-h-screen w-screen overflow-x-hidden bg-slate-50 dark:bg-slate-950"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <SiteBackground />

      {/* App content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />

        <main
          className="relative mx-auto w-full max-w-7xl flex-grow px-4 py-8 sm:px-6 lg:px-8"
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