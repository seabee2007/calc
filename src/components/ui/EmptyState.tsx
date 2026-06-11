import React from 'react';
import { BORDER_DEFAULT, SURFACE_MUTED, TEXT_FOREGROUND, TEXT_MUTED } from '../../theme/appTheme';
import Button from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div
    className={`rounded-xl border border-dashed p-8 text-center ${BORDER_DEFAULT} ${SURFACE_MUTED} ${className}`}
  >
    {icon ? (
      <div className={`mx-auto mb-3 flex justify-center ${TEXT_MUTED}`}>{icon}</div>
    ) : null}
    <p className={`font-medium ${TEXT_FOREGROUND}`}>{title}</p>
    {description ? (
      <p className={`mt-1 text-sm ${TEXT_MUTED}`}>{description}</p>
    ) : null}
    {action ? (
      <div className="mt-4">
        <Button onClick={action.onClick}>{action.label}</Button>
      </div>
    ) : null}
  </div>
);

export default EmptyState;
