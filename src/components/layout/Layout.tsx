import React from 'react';
import { motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import backgroundImage from '../../assets/images/bkgrnd.jpg';

const Layout: React.FC = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  if (isAuthPage) {
    return <Outlet />;
  }

  return (
    <div 
      className="flex flex-col min-h-screen bg-slate-50 relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Semi-transparent overlay for better readability */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <motion.main 
          className="flex-grow py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;