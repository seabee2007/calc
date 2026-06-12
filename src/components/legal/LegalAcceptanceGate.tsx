import React from 'react';
import LegalAcceptanceModal from './LegalAcceptanceModal';

interface LegalAcceptanceGateProps {
  /** Legal acceptance loading state from App.tsx (single hook instance). */
  isLoading: boolean;
  /** Accept handler from App.tsx — updates parent legal state so routes can render. */
  onAccept: () => Promise<void>;
}

/**
 * Blocks authenticated app access until current Terms and Privacy are accepted.
 * Used with Pattern A in App.tsx: early return while not accepted.
 * Does NOT own legal state — App.tsx controls when this component mounts/unmounts.
 */
const LegalAcceptanceGate: React.FC<LegalAcceptanceGateProps> = ({ isLoading, onAccept }) => {
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

  return <LegalAcceptanceModal onAccept={onAccept} />;
};

export default LegalAcceptanceGate;
