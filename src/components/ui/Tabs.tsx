import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  initialTabId?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pill';
  fullWidth?: boolean;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  initialTabId,
  onChange,
  variant = 'default',
  fullWidth = false,
}) => {
  const [activeTabId, setActiveTabId] = useState(initialTabId || tabs[0].id);
  
  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
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
      container: 'border-b border-slate-200',
      tab: 'px-4 py-2 text-sm text-slate-700 hover:text-slate-900',
      activeTab: 'text-blue-600 border-b-2 border-blue-600',
      inactiveTab: 'border-b-2 border-transparent',
    },
    pill: {
      container: 'p-1 bg-slate-100 rounded-lg',
      tab: 'px-4 py-2 text-sm rounded-md text-slate-700',
      activeTab: 'bg-white text-slate-900 shadow-sm',
      inactiveTab: 'hover:bg-slate-200',
    },
  };

  return (
    <div className={`${containerStyles} ${variantStyles[variant].container}`}>
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        const tabStyles = `
          ${baseTabItem} 
          ${variantStyles[variant].tab} 
          ${isActive ? variantStyles[variant].activeTab : variantStyles[variant].inactiveTab}
          ${tabWidthStyle}
        `;
        
        return (
          <motion.button
            key={tab.id}
            className={tabStyles}
            onClick={() => handleTabClick(tab.id)}
            whileTap={{ scale: 0.97 }}
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