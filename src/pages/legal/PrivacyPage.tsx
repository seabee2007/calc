import React from 'react';
import PrivacyPolicy from '../../components/legal/PrivacyPolicy';

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <PrivacyPolicy />
      </div>
    </div>
  );
};

export default PrivacyPage;
