import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import { useThemeStore } from '../../store/themeStore';

interface ThemeSelectorProps {
  value: string;
  onChange: (theme: 'light' | 'dark') => void;
  onNext: () => void;
  onBack: () => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  value,
  onChange,
  onNext,
  onBack
}) => {
  const { toggleTheme } = useThemeStore();

  const handleThemeChange = (theme: 'light' | 'dark') => {
    onChange(theme);
    // Immediately apply the theme so user can preview
    if ((theme === 'dark' && value === 'light') || (theme === 'light' && value === 'dark')) {
      toggleTheme();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full max-w-lg space-y-10"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3"
          >
            Choose Your Theme
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed"
          >
            Select your preferred appearance for the app
          </motion.p>
        </div>

        {/* Theme Options */}
        <div className="grid grid-cols-2 gap-6">
          <button
            onClick={() => handleThemeChange('light')}
            className={`p-6 rounded-xl border-2 transition-all ${
              value === 'light'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <Sun size={48} className="text-yellow-500" />
              <span className="text-lg font-medium text-gray-900 dark:text-white">Light Mode</span>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange('dark')}
            className={`p-6 rounded-xl border-2 transition-all ${
              value === 'dark'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <Moon size={48} className="text-blue-500" />
              <span className="text-lg font-medium text-gray-900 dark:text-white">Dark Mode</span>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6">
          <div className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer" onClick={onBack}>
            <ArrowLeft size={24} />
            <span className="text-lg">Back</span>
          </div>

          <button
            onClick={onNext}
            className="h-14 text-lg font-medium text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 rounded-lg px-8 shadow-lg"
          >
            Complete Setup
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ThemeSelector; 