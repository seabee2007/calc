import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BORDER_DEFAULT,
  FOCUS_RING,
  SURFACE,
  SURFACE_MUTED,
  TEXT_ACCENT,
  TEXT_BODY,
} from '../../theme/appTheme';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  testId?: string;
}

interface TabsProps {
  tabs: Tab[];
  initialTabId?: string;
  /** Controlled active tab (optional). */
  activeTabId?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pill';
  fullWidth?: boolean;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  initialTabId,
  activeTabId: controlledActiveTabId,
  onChange,
  variant = 'default',
  fullWidth = false,
}) => {
  const [internalActiveTabId, setInternalActiveTabId] = useState(initialTabId || tabs[0].id);
  const activeTabId = controlledActiveTabId ?? internalActiveTabId;
  const prefersReducedMotion = useReducedMotion();
  
  const handleTabClick = (tabId: string) => {
    if (controlledActiveTabId === undefined) {
      setInternalActiveTabId(tabId);
    }
    if (onChange) {
      onChange(tabId);
    }
  };
  
  // Base styles
  const baseContainer = 'flex relative';
  const containerWidthStyle = fullWidth ? 'w-full' : '';
  const containerStyles = `${baseContainer} ${containerWidthStyle}`;
  
  // Tab item styles
  const baseTabItem = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none cursor-pointer';
  
  // Width styles for tab items
  const tabWidthStyle = fullWidth ? 'flex-1' : '';
  
  // Variant-specific styles
  const variantStyles = {
    default: {
      container: `border-b ${BORDER_DEFAULT}`,
      tab: `px-4 py-2 text-sm ${TEXT_BODY} hover:text-slate-900 dark:hover:text-slate-100`,
      activeTab: `${TEXT_ACCENT} border-b-2 border-cyan-600 dark:border-cyan-400`,
      inactiveTab: 'border-b-2 border-transparent',
    },
    pill: {
      container: `rounded-lg p-1 ${SURFACE_MUTED}`,
      tab: `rounded-md px-4 py-2 text-sm ${TEXT_BODY}`,
      activeTab: `${SURFACE} text-slate-900 shadow-sm dark:text-slate-100`,
      inactiveTab: 'hover:bg-slate-200 dark:hover:bg-slate-700',
    },
  };

  return (
    <div className={`${containerStyles} ${variantStyles[variant].container}`}>
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;

        return (
          <motion.button
            key={tab.id}
            type="button"
            data-testid={tab.testId}
            className={`${baseTabItem} ${variantStyles[variant].tab} ${isActive ? variantStyles[variant].activeTab : variantStyles[variant].inactiveTab} ${tabWidthStyle} ${FOCUS_RING}`}
            onClick={() => handleTabClick(tab.id)}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
};

export default Tabs;