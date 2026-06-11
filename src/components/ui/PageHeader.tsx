import React from 'react';
import { CC_PAGE_SUBTITLE, CC_PAGE_TITLE } from '../../theme/pageTypography';
import { PAGE_GUTTER, TEXT_MUTED } from '../../theme/appTheme';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-side actions (buttons, menus). */
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  /** Use interior styling without drop-shadow (default true for app pages). */
  interior?: boolean;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumb,
  interior = true,
  className = '',
}) => {
  const titleClass = interior
    ? 'text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl'
    : CC_PAGE_TITLE;
  const subtitleClass = interior
    ? `mt-1 text-sm ${TEXT_MUTED} sm:text-base`
    : CC_PAGE_SUBTITLE;

  return (
    <header className={`${PAGE_GUTTER} ${className}`}>
      {breadcrumb ? (
        <nav className={`mb-2 text-sm ${TEXT_MUTED}`} aria-label="Breadcrumb">
          {breadcrumb}
        </nav>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={titleClass}>{title}</h1>
          {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
};

export default PageHeader;
