import React from 'react';
import PrivacyPolicy from '../../components/legal/PrivacyPolicy';
import PublicLegalContent from './PublicLegalContent';

const PrivacyPage: React.FC = () => {
  return (
    <PublicLegalContent>
      <PrivacyPolicy />
    </PublicLegalContent>
  );
};

export default PrivacyPage;
