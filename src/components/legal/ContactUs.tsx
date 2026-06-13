import React from 'react';
import { Mail, MapPin } from 'lucide-react';
import { BRAND_NAME, SUPPORT_EMAIL } from '../../config/brand';
import {
  CONTACT_MODAL_BODY,
  CONTACT_MODAL_FOOTER,
  CONTACT_MODAL_HEADING,
  CONTACT_MODAL_ICON,
  CONTACT_MODAL_LINK,
  CONTACT_MODAL_SECTION,
} from './legalModalStyles';

const ContactUs: React.FC = () => {
  return (
    <div className="text-center">
      <div className="space-y-5">
        <div className={CONTACT_MODAL_SECTION}>
          <p className={`${CONTACT_MODAL_BODY} font-medium text-slate-900 dark:text-slate-100`}>
            {BRAND_NAME}
          </p>
        </div>

        <div className={CONTACT_MODAL_SECTION}>
          <div className="mb-3 flex items-center justify-center gap-2">
            <Mail className={CONTACT_MODAL_ICON} />
            <h3 className={CONTACT_MODAL_HEADING}>Email</h3>
          </div>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={CONTACT_MODAL_LINK}>
            {SUPPORT_EMAIL}
          </a>
        </div>

        <div className={CONTACT_MODAL_SECTION}>
          <div className="mb-3 flex items-center justify-center gap-2">
            <MapPin className={CONTACT_MODAL_ICON} />
            <h3 className={CONTACT_MODAL_HEADING}>Mailing Address</h3>
          </div>
          <p className={`${CONTACT_MODAL_BODY} leading-relaxed`}>
            [Insert Legal Business Mailing Address]
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
  );
};

export default ContactUs;
