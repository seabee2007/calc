import React from 'react';
import TermsOfService from '../../components/legal/TermsOfService';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <TermsOfService />
      </div>
    </div>
  );
};

export default TermsPage;
