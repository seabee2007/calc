import React from 'react';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_MAILING_ADDRESS_LINES,
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  LEGAL_NOTICES_INTRO,
  SUPPORT_EMAIL,
} from '../../lib/companyInfo';
import { LEGAL_MODAL_LINK } from './legalModalStyles';

type LegalContactBlockProps = {
  className?: string;
  linkClassName?: string;
  showLegalNoticesIntro?: boolean;
  showPhone?: boolean;
};

const LegalContactBlock: React.FC<LegalContactBlockProps> = ({
  className = 'not-italic mt-2 space-y-1',
  linkClassName = LEGAL_MODAL_LINK,
  showLegalNoticesIntro = false,
  showPhone = true,
}) => {
  return (
    <address className={className}>
      {showLegalNoticesIntro ? <p>{LEGAL_NOTICES_INTRO}</p> : null}
      <p>
        <strong>{COMPANY_LEGAL_NAME}</strong>
      </p>
      {COMPANY_MAILING_ADDRESS_LINES.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p>
        Email:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClassName}>
          {SUPPORT_EMAIL}
        </a>
      </p>
      {showPhone ? (
        <p>
          Phone:{' '}
          <a href={COMPANY_PHONE_HREF} className={linkClassName}>
            {COMPANY_PHONE}
          </a>
        </p>
      ) : null}
    </address>
  );
};

export default LegalContactBlock;
