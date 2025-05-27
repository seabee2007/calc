import React from 'react';
import { AlertTriangle, Info, Clock } from 'lucide-react';

interface ActionChecklistProps {
  items: {
    text: string;
    type: 'critical' | 'warning' | 'info';
  }[];
}

const ActionChecklist: React.FC<ActionChecklistProps> = ({ items }) => {
  const getIcon = (type: 'critical' | 'warning' | 'info') => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStyle = (type: 'critical' | 'warning' | 'info') => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 text-red-700';
      case 'warning':
        return 'bg-yellow-50 text-yellow-700';
      default:
        return 'bg-blue-50 text-blue-700';
    }
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex items-start gap-2 p-3 rounded-lg ${getStyle(item.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(item.type)}
          </div>
          <span className="text-sm">{item.text}</span>
        </div>
      ))}
    </div>
  );
};

export default ActionChecklist;