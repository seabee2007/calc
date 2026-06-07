import React from 'react';
import Modal from '../../../../components/ui/Modal';
import { LABOR_FIELD_DEFINITIONS } from '../../data/laborFieldDefinitions';

interface LaborFieldDefinitionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LaborFieldDefinitionsModal({
  isOpen,
  onClose,
}: LaborFieldDefinitionsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Labor Field Definitions"
      size="lg"
      stackAboveDrawer
    >
      <div className="max-h-[70dvh] space-y-5 overflow-y-auto overscroll-contain pr-1 text-sm text-slate-200">
        {LABOR_FIELD_DEFINITIONS.map((entry) => (
          <section key={entry.id} className="space-y-1">
            <h3 className="text-base font-semibold text-white">{entry.title}</h3>
            <p className="text-slate-300">{entry.plain}</p>
            {entry.options && entry.options.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-slate-300">
                {entry.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </Modal>
  );
}
