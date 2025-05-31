import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import Button from '../ui/Button';

const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useThemeStore();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      icon={isDark ? <Sun size={20} /> : <Moon size={20} />}
      className="text-gray-600 dark:text-gray-300"
    >
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};

export default ThemeToggle;