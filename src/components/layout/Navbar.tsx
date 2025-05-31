import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Calculator, Folder, Book, Menu, X, LogIn, UserPlus, LogOut, Beaker, Settings, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';
import ThemeToggle from './ThemeToggle';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Essential links that always show on desktop
  const essentialLinks = [
    { name: 'Home', path: '/', icon: <Home size={20} /> },
    ...(user ? [
      { name: 'Calculator', path: '/calculator', icon: <Calculator size={20} />, shortName: 'Calc' },
    ] : []),
  ];

  // Additional links that go in hamburger menu on medium screens
  const additionalLinks = user ? [
    { name: 'Projects', path: '/projects', icon: <Folder size={20} /> },
    { name: 'Proposals', path: '/proposals', icon: <FileText size={20} /> },
    { name: 'Mix-Design Advisor', path: '/mix-design-advisor', icon: <Beaker size={20} />, shortName: 'Mix' },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ] : [];

  // Resources always available
  const resourcesLink = { name: 'Resources', path: '/resources', icon: <Book size={20} /> };

  // All links for mobile menu
  const allNavLinks = [
    ...essentialLinks,
    ...additionalLinks,
    resourcesLink,
  ];
  
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      setIsMobileMenuOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };
  
  return (
    <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <Calculator className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">ConcreteCalc</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center">
            {/* Essential links (always visible) */}
            <div className="flex items-center space-x-2 lg:space-x-4 mr-4">
              {essentialLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-2 lg:px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors whitespace-nowrap ${
                    isActive(link.path)
                      ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-blue-900/50'
                  }`}
                >
                  <span className="mr-1 lg:mr-2">{link.icon}</span>
                  <span className="hidden lg:inline">{link.name}</span>
                  <span className="lg:hidden">{link.shortName || link.name}</span>
                </Link>
              ))}

              {/* Additional links on XL screens only */}
              <div className="hidden xl:flex items-center space-x-4">
                {additionalLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors whitespace-nowrap ${
                      isActive(link.path)
                        ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/50'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-blue-900/50'
                    }`}
                  >
                    <span className="mr-2">{link.icon}</span>
                    {link.name}
                  </Link>
                ))}

                <Link
                  to={resourcesLink.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors whitespace-nowrap ${
                    isActive(resourcesLink.path)
                      ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-blue-900/50'
                  }`}
                >
                  <span className="mr-2">{resourcesLink.icon}</span>
                  {resourcesLink.name}
                </Link>
              </div>
            </div>

            {/* Hamburger menu for medium to large screens (shows additional links) */}
            <div className="xl:hidden flex items-center mr-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`inline-flex items-center justify-center p-2 rounded-md transition-colors ${
                  isMobileMenuOpen 
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/50' 
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-blue-900/50'
                }`}
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

            {/* Right side controls - fixed width to prevent pushing off screen */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <ThemeToggle />

              {user ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  icon={<LogOut size={18} />}
                  className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 hover:border-red-400 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-300 whitespace-nowrap"
                >
                  <span className="hidden lg:inline">{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
                  <span className="lg:hidden">Out</span>
                </Button>
              ) : (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/login')}
                    icon={<LogIn size={18} />}
                    className="whitespace-nowrap"
                  >
                    <span className="hidden lg:inline">Sign In</span>
                    <span className="lg:hidden">In</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate('/signup')}
                    icon={<UserPlus size={18} />}
                    className="whitespace-nowrap"
                  >
                    <span className="hidden lg:inline">Sign Up</span>
                    <span className="lg:hidden">Up</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile Menu Button (for actual mobile devices) */}
          <div className="flex items-center md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 focus:outline-none dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-blue-900/50 ml-2"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Dropdown Menu (for both desktop overflow and mobile) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="md:absolute md:right-4 md:top-16 md:w-64 md:bg-white md:dark:bg-gray-800 md:rounded-lg md:shadow-lg md:border md:border-gray-200 md:dark:border-gray-700 md:z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 md:p-2">
              {/* Show all links on mobile, only additional links on desktop */}
              {(window.innerWidth < 768 ? allNavLinks : [...additionalLinks, resourcesLink]).map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block px-3 py-2 rounded-md text-base md:text-sm font-medium flex items-center transition-colors ${
                    isActive(link.path)
                      ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-blue-900/50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="mr-3">{link.icon}</span>
                  {link.name}
                </Link>
              ))}

              {/* Auth buttons only show on mobile */}
              <div className="md:hidden">
                {user ? (
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    icon={<LogOut size={18} />}
                    className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 hover:border-red-400 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-300 mt-2"
                  >
                    {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                  </Button>
                ) : (
                  <div className="space-y-2 pt-2">
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => {
                        navigate('/login');
                        setIsMobileMenuOpen(false);
                      }}
                      icon={<LogIn size={18} />}
                    >
                      Sign In
                    </Button>
                    <Button
                      fullWidth
                      onClick={() => {
                        navigate('/signup');
                        setIsMobileMenuOpen(false);
                      }}
                      icon={<UserPlus size={18} />}
                    >
                      Sign Up
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;