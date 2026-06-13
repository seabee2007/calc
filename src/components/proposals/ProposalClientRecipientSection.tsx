import React from 'react';
import type { ProposalData } from '../../types/proposal';
import USAddressFields from '../address/USAddressFields';
import Button from '../ui/Button';
import { EMPTY_US_ADDRESS, type USAddress } from '../../types/address';
import { displayClientAddress } from '../../utils/proposalAddress';
import { formatUSPhoneInput } from '../../utils/phoneFormat';
import {
  FORM_LABEL,
  FORM_TEXTAREA,
  PREMIUM_INNER_PANEL,
  PREMIUM_PANEL,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../theme/appTheme';

interface ProposalClientRecipientSectionProps {
  data: ProposalData;
  selectedProjectId: string | null;
  onFieldChange: (field: keyof ProposalData, value: string) => void;
  onAddressChange: (parts: USAddress) => void;
  onUpdateProjectClientInfo?: () => void;
  updatingProjectClient?: boolean;
}

const SECTION_CARD = `${PREMIUM_PANEL} p-5 sm:p-6`;
const SECTION_TITLE = `text-lg font-semibold ${TEXT_FOREGROUND}`;
const INPUT_CLASS = FORM_TEXTAREA;

const ProposalClientRecipientSection: React.FC<ProposalClientRecipientSectionProps> = ({
  data,
  selectedProjectId,
  onFieldChange,
  onAddressChange,
  onUpdateProjectClientInfo,
  updatingProjectClient = false,
}) => {
  return (
    <div className={SECTION_CARD} data-testid="proposal-client-recipient-section">
      <h2 className={SECTION_TITLE}>Client / Recipient</h2>
      <p className={`mb-5 mt-1 text-sm ${TEXT_MUTED}`}>
        {selectedProjectId
          ? 'Auto-filled from the selected project. Edits here apply to this proposal only unless you update the project record.'
          : 'Enter the client contact and proposal recipient details.'}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={FORM_LABEL}>
            Client name
          </label>
          <input
            type="text"
            placeholder="Jane Client"
            value={data.clientName}
            onChange={(e) => onFieldChange('clientName', e.target.value)}
            className={INPUT_CLASS}
            data-testid="proposal-client-name-input"
          />
        </div>
        <div>
          <label className={FORM_LABEL}>
            Company / organization
          </label>
          <input
            type="text"
            placeholder="Client Co"
            value={data.clientCompany || ''}
            onChange={(e) => onFieldChange('clientCompany', e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={FORM_LABEL}>
            Client email
          </label>
          <input
            type="email"
            placeholder="client@example.com"
            value={data.clientEmail || ''}
            onChange={(e) => onFieldChange('clientEmail', e.target.value)}
            className={INPUT_CLASS}
            data-testid="proposal-recipient-email-input"
          />
          <p className="mt-1 text-xs text-slate-500">
            Used as the default To address when sending this proposal.
          </p>
        </div>
        <div>
          <label className={FORM_LABEL}>
            Phone
          </label>
          <input
            type="tel"
            placeholder="(555) 555-5555"
            value={data.clientPhone || ''}
            onChange={(e) => onFieldChange('clientPhone', formatUSPhoneInput(e.target.value))}
            className={INPUT_CLASS}
            data-testid="proposal-client-phone-input"
          />
        </div>
        <div className="md:col-span-2">
          <label className={FORM_LABEL}>
            Address <span className={`font-normal ${TEXT_MUTED}`}>(optional)</span>
          </label>
          <div className={`${PREMIUM_INNER_PANEL} p-4`}>
            <USAddressFields
              value={data.clientAddressParts ?? { ...EMPTY_US_ADDRESS }}
              onChange={onAddressChange}
              showStreet2
              idPrefix="proposal-client"
            />
          </div>
          {displayClientAddress(data) && (
            <p className="mt-2 text-xs text-slate-500">
              Formatted: {displayClientAddress(data)}
            </p>
          )}
        </div>
      </div>

      {selectedProjectId && onUpdateProjectClientInfo && (
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUpdateProjectClientInfo}
            disabled={updatingProjectClient}
            isLoading={updatingProjectClient}
            data-testid="proposal-update-project-client-button"
          >
            Update project client info
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProposalClientRecipientSection;
