import React from 'react';
import TermsOfService from '../../components/legal/TermsOfService';
import PublicLegalContent from './PublicLegalContent';

const TermsPage: React.FC = () => {
  return (
    <PublicLegalContent>
      <TermsOfService />
    </PublicLegalContent>
  );
};

export default TermsPage;
