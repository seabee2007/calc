import React, { useState } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { BRAND_NAME, SUPPORT_EMAIL } from '../../config/brand';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_MAILING_ADDRESS_LINES,
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  PRODUCT_OPERATOR_PHRASE,
} from '../../lib/companyInfo';
import SupportRequestModal from '../support/SupportRequestModal';
import {
  CONTACT_MODAL_BODY,
  CONTACT_MODAL_FOOTER,
  CONTACT_MODAL_HEADING,
  CONTACT_MODAL_ICON,
  CONTACT_MODAL_LINK,
  CONTACT_MODAL_SECTION,
} from './legalModalStyles';

const ContactUs: React.FC = () => {
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  return (
    <>
      <div className="text-center">
        <div className="space-y-5">
          <div className={CONTACT_MODAL_SECTION}>
            <p className={`${CONTACT_MODAL_BODY} font-medium text-slate-900 dark:text-slate-100`}>
              {BRAND_NAME}
            </p>
            <p className={`${CONTACT_MODAL_BODY} mt-2 text-slate-600 dark:text-slate-400`}>
              {PRODUCT_OPERATOR_PHRASE}
            </p>
          </div>

          <div className={CONTACT_MODAL_SECTION}>
            <div className="mb-3 flex items-center justify-center gap-2">
              <Mail className={CONTACT_MODAL_ICON} />
              <h3 className={CONTACT_MODAL_HEADING}>Email</h3>
            </div>
            <button
              type="button"
              onClick={() => setSupportModalOpen(true)}
              className={CONTACT_MODAL_LINK}
            >
              {SUPPORT_EMAIL}
            </button>
          </div>

          <div className={CONTACT_MODAL_SECTION}>
            <div className="mb-3 flex items-center justify-center gap-2">
              <Phone className={CONTACT_MODAL_ICON} />
              <h3 className={CONTACT_MODAL_HEADING}>Phone</h3>
            </div>
            <a href={COMPANY_PHONE_HREF} className={CONTACT_MODAL_LINK}>
              {COMPANY_PHONE}
            </a>
          </div>

          <div className={CONTACT_MODAL_SECTION}>
            <div className="mb-3 flex items-center justify-center gap-2">
              <MapPin className={CONTACT_MODAL_ICON} />
              <h3 className={CONTACT_MODAL_HEADING}>Mailing Address</h3>
            </div>
            <p className={`${CONTACT_MODAL_BODY} leading-relaxed`}>
              {COMPANY_LEGAL_NAME}
              <br />
              {COMPANY_MAILING_ADDRESS_LINES.map((line) => (
                <React.Fragment key={line}>
                  {line}
                  <br />
                </React.Fragment>
              ))}
            </p>
          </div>

          <div className={CONTACT_MODAL_FOOTER}>
            <p className={`${CONTACT_MODAL_BODY} leading-relaxed`}>
              Our support team is available Monday through Friday,
              <br />
              9:00 AM to 5:00 PM Pacific Time.
            </p>
          </div>
        </div>
      </div>

      <SupportRequestModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} />
    </>
  );
};

export default ContactUs;
