import React, { type ReactNode } from 'react';
import { AUTH_ACCENT } from '../../components/auth/authBrandTheme';

interface PublicLegalContentProps {
  children: ReactNode;
}

/** Wraps legal document content in the same card shell used on marketing/auth pages. */
const PublicLegalContent: React.FC<PublicLegalContentProps> = ({ children }) => {
  return (
    <div className="mx-auto w-full max-w-3xl pb-4">
      <div className={`dark relative ${AUTH_ACCENT.authCard}`}>
        <div className={AUTH_ACCENT.authCardGlow} aria-hidden="true" />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
};

export default PublicLegalContent;
