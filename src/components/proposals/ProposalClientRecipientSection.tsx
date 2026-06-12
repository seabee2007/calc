import React from 'react';
import type { ProposalData } from '../../types/proposal';
import USAddressFields from '../address/USAddressFields';
import Button from '../ui/Button';
import { EMPTY_US_ADDRESS, type USAddress } from '../../types/address';
import { displayClientAddress } from '../../utils/proposalAddress';
import { formatUSPhoneInput } from '../../utils/phoneFormat';
import { APP_SECTION_CARD, FORM_TEXTAREA } from '../../theme/appTheme';

interface ProposalClientRecipientSectionProps {
  data: ProposalData;
  selectedProjectId: string | null;
  onFieldChange: (field: keyof ProposalData, value: string) => void;
  onAddressChange: (parts: USAddress) => void;
  onUpdateProjectClientInfo?: () => void;
  updatingProjectClient?: boolean;
}

const SECTION_CARD = APP_SECTION_CARD;
const SECTION_TITLE = 'text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4';

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
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {selectedProjectId
          ? 'Auto-filled from the selected project. Edits here apply to this proposal only unless you update the project record.'
          : 'Enter the client contact and proposal recipient details.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client Name
          </label>
          <input
            type="text"
            placeholder="Client Name"
            value={data.clientName}
            onChange={(e) => onFieldChange('clientName', e.target.value)}
            className={FORM_TEXTAREA}
            data-testid="proposal-client-name-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client Company (optional)
          </label>
          <input
            type="text"
            placeholder="Client Company"
            value={data.clientCompany || ''}
            onChange={(e) => onFieldChange('clientCompany', e.target.value)}
            className={FORM_TEXTAREA}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Recipient Email
          </label>
          <input
            type="email"
            placeholder="client@example.com"
            value={data.clientEmail || ''}
            onChange={(e) => onFieldChange('clientEmail', e.target.value)}
            className={FORM_TEXTAREA}
            data-testid="proposal-recipient-email-input"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Used as the default To address when sending this proposal.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client Phone (optional)
          </label>
          <input
            type="tel"
            placeholder="(555) 555-5555"
            value={data.clientPhone || ''}
            onChange={(e) => onFieldChange('clientPhone', formatUSPhoneInput(e.target.value))}
            className={FORM_TEXTAREA}
            data-testid="proposal-client-phone-input"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client address <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <USAddressFields
            value={data.clientAddressParts ?? { ...EMPTY_US_ADDRESS }}
            onChange={onAddressChange}
            showStreet2
            idPrefix="proposal-client"
          />
          {displayClientAddress(data) && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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
