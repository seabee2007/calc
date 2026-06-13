import React from 'react';
import ContactUs from '../../components/legal/ContactUs';
import PublicLegalContent from './PublicLegalContent';

const ContactPage: React.FC = () => {
  return (
    <PublicLegalContent>
      <ContactUs />
    </PublicLegalContent>
  );
};

export default ContactPage;
