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
}

const AppPage: React.FC<AppPageProps> = ({
  children,
  header,
  className = '',
  constrained = true,
}) => {
  const shell = constrained ? PAGE_MAX_WIDTH : '';
  return (
    <div className={`${shell} ${SECTION_SPACING} pb-24 md:pb-8 ${className}`}>
      {header}
      <div className={PAGE_GUTTER}>{children}</div>
    </div>
  );
};

export default AppPage;
