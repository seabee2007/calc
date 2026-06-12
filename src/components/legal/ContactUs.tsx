import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
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
          <div className="mb-3 flex items-center justify-center gap-2">
            <MapPin className={CONTACT_MODAL_ICON} />
            <h3 className={CONTACT_MODAL_HEADING}>Address</h3>
          </div>
          <p className={`${CONTACT_MODAL_BODY} leading-relaxed`}>
            ConcreteCalc, LLC<br />
            1234 Builder's Way<br />
            San Francisco, CA 94107
          </p>
        </div>

        <div className={CONTACT_MODAL_SECTION}>
          <div className="mb-3 flex items-center justify-center gap-2">
            <Mail className={CONTACT_MODAL_ICON} />
            <h3 className={CONTACT_MODAL_HEADING}>Email</h3>
          </div>
          <a
            href="mailto:support@concretecalc.com"
            className={CONTACT_MODAL_LINK}
          >
            support@concretecalc.com
          </a>
        </div>

        <div className={CONTACT_MODAL_SECTION}>
          <div className="mb-3 flex items-center justify-center gap-2">
            <Phone className={CONTACT_MODAL_ICON} />
            <h3 className={CONTACT_MODAL_HEADING}>Phone</h3>
          </div>
          <a
            href="tel:+1-555-123-4567"
            className={CONTACT_MODAL_LINK}
          >
            +1 (555) 123-4567
          </a>
        </div>

        <div className={CONTACT_MODAL_FOOTER}>
          <p className={`${CONTACT_MODAL_BODY} leading-relaxed`}>
            Our support team is available Monday through Friday,<br />
            9:00 AM to 5:00 PM Pacific Time.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
