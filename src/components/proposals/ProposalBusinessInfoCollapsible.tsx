import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ProposalData } from '../../types/proposal';
import USAddressFields from '../address/USAddressFields';
import { EMPTY_US_ADDRESS, type USAddress } from '../../types/address';
import { displayBusinessAddress } from '../../utils/proposalAddress';
import { APP_SECTION_CARD, FORM_TEXTAREA } from '../../theme/appTheme';

interface ProposalBusinessInfoCollapsibleProps {
  data: ProposalData;
  expanded: boolean;
  onToggleExpanded: () => void;
  onFieldChange: (field: keyof ProposalData, value: string) => void;
  onAddressChange: (parts: USAddress) => void;
  onPhoneChange: (value: string) => void;
}

const SECTION_CARD = APP_SECTION_CARD;
const SECTION_TITLE = 'text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4';

const ProposalBusinessInfoCollapsible: React.FC<ProposalBusinessInfoCollapsibleProps> = ({
  data,
  expanded,
  onToggleExpanded,
  onFieldChange,
  onAddressChange,
  onPhoneChange,
}) => {
  const summaryParts = [
    data.businessName?.trim(),
    [data.businessEmail, data.businessPhone].filter(Boolean).join(' · '),
  ].filter(Boolean);

  return (
    <div className={SECTION_CARD} data-testid="proposal-business-info-section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={SECTION_TITLE}>Business Information</h2>
          {!expanded && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <span data-testid="proposal-business-info-summary">
                {summaryParts.join(' · ') || 'Business details from company settings'}
              </span>
              {data.businessLogoUrl && (
                <img
                  src={data.businessLogoUrl}
                  alt=""
                  className="h-8 w-auto max-w-[120px] object-contain rounded border border-gray-200 dark:border-gray-700"
                  data-testid="proposal-business-logo-preview"
                />
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300"
          data-testid="proposal-business-info-toggle"
        >
          {expanded ? (
            <>
              Collapse
              <ChevronUp size={16} />
            </>
          ) : (
            <>
              Edit business info
              <ChevronDown size={16} />
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Business Name
            </label>
            <input
              type="text"
              placeholder="Your Business Name"
              value={data.businessName}
              onChange={(e) => onFieldChange('businessName', e.target.value)}
              className={FORM_TEXTAREA}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Logo URL (optional)
            </label>
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={data.businessLogoUrl || ''}
              onChange={(e) => onFieldChange('businessLogoUrl', e.target.value)}
              className={FORM_TEXTAREA}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Business address
            </label>
            <USAddressFields
              value={data.businessAddressParts ?? { ...EMPTY_US_ADDRESS }}
              onChange={onAddressChange}
              showStreet2
              idPrefix="proposal-business"
            />
            {displayBusinessAddress(data) && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Formatted: {displayBusinessAddress(data)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="(555) 123-4567"
              value={data.businessPhone || ''}
              onChange={(e) => onPhoneChange(e.target.value)}
              className={FORM_TEXTAREA}
              inputMode="numeric"
              pattern="[0-9\s\(\)\-]*"
              maxLength={14}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="contact@company.com"
              value={data.businessEmail || ''}
              onChange={(e) => onFieldChange('businessEmail', e.target.value)}
              className={FORM_TEXTAREA}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              License Number
            </label>
            <input
              type="text"
              placeholder="License #12345"
              value={data.businessLicenseNumber || ''}
              onChange={(e) => onFieldChange('businessLicenseNumber', e.target.value)}
              className={FORM_TEXTAREA}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Slogan
            </label>
            <input
              type="text"
              placeholder="Building Excellence, One Project at a Time"
              value={data.businessSlogan || ''}
              onChange={(e) => onFieldChange('businessSlogan', e.target.value)}
              className={FORM_TEXTAREA}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalBusinessInfoCollapsible;
