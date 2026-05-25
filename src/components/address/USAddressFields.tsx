import React from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { US_STATE_SELECT_OPTIONS } from '../../constants/usStatesTerritories';
import {
  EMPTY_US_ADDRESS,
  US_COUNTRY_LABEL,
  type USAddress,
} from '../../types/address';

export interface USAddressFieldsProps {
  value: Partial<USAddress>;
  onChange: (next: USAddress) => void;
  /** Show optional second line (suite, unit). */
  showStreet2?: boolean;
  streetLabel?: string;
  className?: string;
  disabled?: boolean;
  idPrefix?: string;
}

const USAddressFields: React.FC<USAddressFieldsProps> = ({
  value,
  onChange,
  showStreet2 = false,
  streetLabel = 'Street address',
  className = '',
  disabled = false,
  idPrefix = 'addr',
}) => {
  const addr: USAddress = { ...EMPTY_US_ADDRESS, ...value, country: US_COUNTRY_LABEL };

  const patch = (partial: Partial<USAddress>) => {
    onChange({ ...addr, ...partial, country: US_COUNTRY_LABEL });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <Input
        id={`${idPrefix}-street`}
        label={streetLabel}
        value={addr.street}
        onChange={(e) => patch({ street: e.target.value })}
        placeholder="123 Main St"
        disabled={disabled}
        fullWidth
      />
      {showStreet2 && (
        <Input
          id={`${idPrefix}-street2`}
          label="Apt / suite (optional)"
          value={addr.street2}
          onChange={(e) => patch({ street2: e.target.value })}
          placeholder="Suite 200"
          disabled={disabled}
          fullWidth
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          id={`${idPrefix}-city`}
          label="City"
          value={addr.city}
          onChange={(e) => patch({ city: e.target.value })}
          placeholder="Mangilao"
          disabled={disabled}
          fullWidth
        />
        <Select
          label="State / territory"
          options={US_STATE_SELECT_OPTIONS}
          value={addr.state}
          onChange={(v) => patch({ state: v })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          id={`${idPrefix}-zip`}
          label="ZIP code (optional)"
          value={addr.zip}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
            patch({ zip: digits });
          }}
          placeholder="96913"
          inputMode="numeric"
          maxLength={5}
          disabled={disabled}
          fullWidth
        />
        <Input
          id={`${idPrefix}-country`}
          label="Country"
          value={US_COUNTRY_LABEL}
          disabled
          fullWidth
        />
      </div>
    </div>
  );
};

export default USAddressFields;
