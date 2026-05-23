import React from 'react';
import { Info } from 'lucide-react';

interface PlacementScoringLinkProps {
  onClick: () => void;
  className?: string;
  variant?: 'onDark' | 'onLight';
}

const variantClass = {
  onDark:
    'text-cyan-200 hover:text-white decoration-cyan-300/60 hover:decoration-white',
  onLight:
    'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 decoration-blue-400/50',
};

/** Opens the placement scoring / ACI guide modal */
const PlacementScoringLink: React.FC<PlacementScoringLinkProps> = ({
  onClick,
  className = '',
  variant = 'onDark',
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 transition-colors ${variantClass[variant]} ${className}`}
  >
    <Info className="h-4 w-4 shrink-0" aria-hidden />
    How placement scoring works (ACI 305R / 306R)
  </button>
);

export default PlacementScoringLink;
