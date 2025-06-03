import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import backgroundImage from '../../assets/images/bkgrnd.jpg';

const Layout: React.FC = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    // Prevent unwanted zooming
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    // Fix iOS height issues
    const resizeHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    window.addEventListener('resize', resizeHeight);
    window.addEventListener('orientationchange', resizeHeight);
    resizeHeight();

    // Set theme colors and status bar background based on theme
    const setThemeColors = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const bgColor = isDark ? '#111827' : '#ffffff';
      const metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
      
      // Update document background
      document.documentElement.style.backgroundColor = bgColor;
      document.body.style.backgroundColor = bgColor;
      
      // Update body class for CSS targeting
      if (isDark) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
      
      // Update theme-color meta tag
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', bgColor);
      }
    };
    
    // Initial setup
    setThemeColors();
    
    // Create observer for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setThemeColors();
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', resizeHeight);
      window.removeEventListener('orientationchange', resizeHeight);
      observer.disconnect();
    };
  }, []);

  if (isAuthPage) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen w-screen overflow-x-hidden bg-white dark:bg-gray-900" 
         style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Fixed background container */}
    <div 
        className="fixed w-full h-full"
      style={{
          top: 'env(safe-area-inset-top)',
          left: 0,
          right: 0,
          bottom: 0,
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          willChange: 'transform',
          transform: 'translateZ(0)',
          zIndex: 0
      }}
    >
        {/* Semi-transparent overlay - only in dark mode */}
        <div className="absolute inset-0 bg-black/40 dark:block hidden" />
      </div>
      
      {/* Content container */}
      <div className="relative min-h-screen flex flex-col z-10">
        <Navbar />
        <motion.main 
          className="flex-grow py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
            paddingRight: 'max(env(safe-area-inset-right), 1rem)',
            marginTop: 'calc(4rem)',
            minHeight: 'auto'
          }}
        >
          <Outlet />
        </motion.main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;