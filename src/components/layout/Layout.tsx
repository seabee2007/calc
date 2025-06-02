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
    // Reset viewport zoom and scroll position on route changes
    window.scrollTo(0, 0);
    
    // Force layout recalculation
    const timeout = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);

    return () => clearTimeout(timeout);
  }, [location.pathname]);

  if (isAuthPage) {
    return <Outlet />;
  }

  return (
    <div 
      className="flex flex-col min-h-screen w-screen bg-slate-50 dark:bg-gray-900 relative overflow-x-hidden"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        minHeight: '100dvh',
        minWidth: '100dvw',
        height: '100dvh',
        width: '100dvw'
      }}
    >
      {/* Semi-transparent overlay for better readability */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen w-full">
        <Navbar />
        <motion.main 
          className="flex-grow py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
            paddingRight: 'max(env(safe-area-inset-right), 1rem)',
            paddingTop: 'max(env(safe-area-inset-top), 2rem)',
            paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)',
            minHeight: '100%'
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