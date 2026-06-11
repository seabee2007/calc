import React from 'react';
import { TEXT_FOREGROUND, TEXT_MUTED } from '../../theme/appTheme';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  action,
  className = '',
}) => (
  <div className={`flex flex-wrap items-start justify-between gap-2 ${className}`}>
    <div className="min-w-0">
      <h2
        className={`text-sm font-semibold uppercase tracking-widest ${TEXT_FOREGROUND}`}
      >
        {title}
      </h2>
      {description ? (
        <p className={`mt-1 text-sm ${TEXT_MUTED}`}>{description}</p>
      ) : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export default SectionHeader;
