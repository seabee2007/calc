import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import {
  BORDER_DEFAULT,
  TEXT_BODY,
  TEXT_DANGER,
  TEXT_FOREGROUND,
  TEXT_INFO,
  TEXT_SUCCESS,
  TEXT_WARNING,
} from '../../theme/appTheme';

export type InlineNoticeVariant = 'info' | 'warning' | 'danger' | 'success';

export interface InlineNoticeProps {
  variant?: InlineNoticeVariant;
  title: string;
  description?: string;
  className?: string;
}

const variantStyles: Record<
  InlineNoticeVariant,
  { container: string; icon: React.ReactNode; title: string }
> = {
  info: {
    container: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40',
    icon: <Info className={`h-5 w-5 shrink-0 ${TEXT_INFO}`} aria-hidden />,
    title: TEXT_FOREGROUND,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    icon: <AlertTriangle className={`h-5 w-5 shrink-0 ${TEXT_WARNING}`} aria-hidden />,
    title: TEXT_FOREGROUND,
  },
  danger: {
    container: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40',
    icon: <AlertCircle className={`h-5 w-5 shrink-0 ${TEXT_DANGER}`} aria-hidden />,
    title: TEXT_FOREGROUND,
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    icon: <CheckCircle className={`h-5 w-5 shrink-0 ${TEXT_SUCCESS}`} aria-hidden />,
    title: TEXT_FOREGROUND,
  },
};

const InlineNotice: React.FC<InlineNoticeProps> = ({
  variant = 'info',
  title,
  description,
  className = '',
}) => {
  const styles = variantStyles[variant];
  return (
    <div
      role="status"
      className={`rounded-lg border p-4 ${BORDER_DEFAULT} ${styles.container} ${className}`}
    >
      <div className="flex gap-3">
        {styles.icon}
        <div className="min-w-0">
          <p className={`text-sm font-medium ${styles.title}`}>{title}</p>
          {description ? (
            <p className={`mt-1 text-sm ${TEXT_BODY}`}>{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default InlineNotice;
