import React from 'react';
import { useLegalAcceptance } from '../../hooks/useLegalAcceptance';
import LegalAcceptanceModal from './LegalAcceptanceModal';

interface LegalAcceptanceGateProps {
  children?: React.ReactNode;
}

/**
 * Blocks authenticated app access until current Terms and Privacy are accepted.
 * Rendered from App.tsx before protected routes mount.
 */
const LegalAcceptanceGate: React.FC<LegalAcceptanceGateProps> = ({ children }) => {
  const { isLoading, hasAcceptedCurrentLegal, acceptLegalDocuments } = useLegalAcceptance();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center dark:bg-slate-950">
        <div
          className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
          data-testid="legal-acceptance-loading"
        />
      </div>
    );
  }

  if (hasAcceptedCurrentLegal) {
    return <>{children ?? null}</>;
  }

  return <LegalAcceptanceModal onAccept={acceptLegalDocuments} />;
};

export default LegalAcceptanceGate;
