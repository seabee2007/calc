import React from 'react';
import { DASHBOARD_CARD_INNER, DASHBOARD_CARD_SHELL } from './opsTheme';

interface OpsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: boolean;
  /** Nested panel inside another dashboard shell — avoids double border/shadow. */
  nested?: boolean;
}

/** Operations dashboard card shell — shared elevation with Schedule & Deadlines. */
const OpsCard: React.FC<OpsCardProps> = ({
  children,
  className = '',
  padding = true,
  nested = false,
  ...props
}) => (
  <div
    className={`${nested ? DASHBOARD_CARD_INNER : DASHBOARD_CARD_SHELL} ${padding ? 'p-5 ' : ''}${className}`.trim()}
    {...props}
  >
    {children}
  </div>
);

export default OpsCard;
