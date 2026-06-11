import React from 'react';
import { BORDER_DEFAULT, FOCUS_RING, SURFACE_GLASS_PANEL } from '../../theme/appTheme';

export interface PageToolbarProps {
  children?: React.ReactNode;
  /** Primary CTA slot (right). */
  actions?: React.ReactNode;
  /** Search / filter controls (left). */
  filters?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

const PageToolbar: React.FC<PageToolbarProps> = ({
  children,
  actions,
  filters,
  sticky = true,
  className = '',
}) => {
  const stickyClass = sticky ? 'sticky top-0 z-10' : '';
  return (
    <div
      className={`${stickyClass} -mx-4 mb-4 border-b px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 ${BORDER_DEFAULT} ${SURFACE_GLASS_PANEL} ${className}`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 ${FOCUS_RING}`}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {filters}
          {children}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
};

export default PageToolbar;
