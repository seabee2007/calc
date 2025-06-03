import React, { useState, useEffect } from 'react';
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
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
        setIsMobileMenuOpen(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);
  
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
    <motion.nav 
      className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-md fixed w-full top-0 left-0 right-0 z-50"
      initial={{ y: 0 }}
      animate={{ y: isVisible ? 0 : -100 }}
      transition={{ duration: 0.2 }}
      style={{
        paddingTop: 'env(safe-area-inset-top)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{
        paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
        paddingRight: 'max(env(safe-area-inset-right), 1rem)'
      }}>
        <div className="flex justify-between items-center h-16">
          {/* Logo - with proper responsive sizing */}
          <div className="flex-shrink-0 min-w-0">
            <Link to="/" className="flex items-center">
              <Calculator className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="ml-2 text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                ConcreteCalc
              </span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center flex-1 justify-end">
            {/* Essential links (always visible) */}
            <div className="flex items-center space-x-1 lg:space-x-2 mr-2 lg:mr-4">
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
              <div className="hidden xl:flex items-center space-x-2">
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
            <div className="xl:hidden flex items-center mr-2">
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

            {/* Right side controls - compact responsive sizing */}
            <div className="flex items-center space-x-1 lg:space-x-2 flex-shrink-0">
              <ThemeToggle />

              {user ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  icon={<LogOut size={16} />}
                  className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 hover:border-red-400 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-300 whitespace-nowrap text-xs lg:text-sm px-2 lg:px-3"
                >
                  <span className="hidden lg:inline">{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
                  <span className="lg:hidden">Out</span>
                </Button>
              ) : (
                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/login')}
                    icon={<LogIn size={16} />}
                    className="whitespace-nowrap text-xs lg:text-sm px-2 lg:px-3"
                  >
                    <span className="hidden lg:inline">Sign In</span>
                    <span className="lg:hidden">In</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate('/signup')}
                    icon={<UserPlus size={16} />}
                    className="whitespace-nowrap text-xs lg:text-sm px-2 lg:px-3"
                  >
                    <span className="hidden lg:inline">Sign Up</span>
                    <span className="lg:hidden">Up</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile Menu Button (for actual mobile devices) */}
          <div className="flex items-center md:hidden space-x-1">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 focus:outline-none dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-blue-900/50"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Dropdown Menu (for both desktop overflow and mobile) - improved positioning */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="fixed left-0 right-0 top-[calc(4rem+env(safe-area-inset-top))] md:absolute md:left-auto md:right-4 md:top-[calc(4rem+env(safe-area-inset-top))] md:w-64 bg-white dark:bg-gray-800 md:rounded-lg shadow-xl border-t md:border border-gray-200 dark:border-gray-700 z-[100] backdrop-blur-sm"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              maxHeight: 'calc(100vh - 4rem - env(safe-area-inset-top))',
              overflow: 'auto'
            }}
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
    </motion.nav>
  );
};

export default Navbar;