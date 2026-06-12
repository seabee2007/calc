import React from 'react';
import {
  PAGE_GUTTER,
  PAGE_MAX_WIDTH,
  SECTION_SPACING,
} from '../../theme/appTheme';

export interface AppPageProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  /** When false, content is not wrapped in max-width container. */
  constrained?: boolean;
  'data-testid'?: string;
}

const AppPage: React.FC<AppPageProps> = ({
  children,
  header,
  className = '',
  constrained = true,
  'data-testid': dataTestId,
}) => {
  const shell = constrained ? PAGE_MAX_WIDTH : '';
  return (
    <div className={`${shell} pb-24 md:pb-8 ${className}`} data-testid={dataTestId}>
      <div className={`${PAGE_GUTTER} ${SECTION_SPACING}`}>
        {header}
        {children}
      </div>
    </div>
  );
};

export default AppPage;
