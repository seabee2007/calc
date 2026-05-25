import React from 'react';
import Card from '../ui/Card';
import { OPS_PANEL } from './opsTheme';

interface OpsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: boolean;
}

/** Dashboard card — overrides default Card white background for dark-console UI. */
const OpsCard: React.FC<OpsCardProps> = ({
  children,
  className = '',
  padding = true,
  ...props
}) => (
  <Card
    className={`${padding ? 'p-5 ' : ''}${OPS_PANEL} ${className}`.trim()}
    shadow="md"
    {...props}
  >
    {children}
  </Card>
);

export default OpsCard;
