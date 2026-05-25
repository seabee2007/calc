import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Loader, MapPin, PenLine } from 'lucide-react';
import USAddressFields from './USAddressFields';
import Button from '../ui/Button';
import {
  formatUSAddress,
  hasProjectJobsite,
  copyUSAddress,
  isUSAddressGeocodable,
  validateUSAddress,
  type USAddress,
} from '../../types/address';
import { geocodeAddress, type GeocodedLocation } from '../../utils/location';

export type JobsiteLocationMode = 'project' | 'manual';

interface JobsiteLocationSectionProps {
  projectName?: string;
  projectJobsite?: USAddress;
  value: USAddress;
  onChange: (addr: USAddress) => void;
  onLocationApplied: (loc: GeocodedLocation) => void;
  idPrefix?: string;
  applyButtonLabel?: string;
  helperText?: string;
}

const JobsiteLocationSection: React.FC<JobsiteLocationSectionProps> = ({
  projectName,
  projectJobsite,
  value,
  onChange,
  onLocationApplied,
  idPrefix = 'jobsite-loc',
  applyButtonLabel = 'Apply for pricing',
  helperText,
}) => {
  const projectUsable = hasProjectJobsite(projectJobsite);
  const projectLine = projectUsable ? formatUSAddress(projectJobsite!) : '';

  const [mode, setMode] = useState<JobsiteLocationMode>(
    projectUsable ? 'project' : 'manual',
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [appliedLine, setAppliedLine] = useState<string | null>(null);
  const lastAutoProjectRef = useRef<string>('');

  const runGeocode = useCallback(
    async (addr: USAddress) => {
      const validation = validateUSAddress(addr, {
        requireStreet: false,
        requireZip: false,
      });
      if (!validation.ok) {
        setLocationError(validation.errors[0]);
        return false;
      }

      setSearchLoading(true);
      setLocationError(null);

      try {
        const loc = await geocodeAddress(addr);
        if (loc) {
          onLocationApplied(loc);
          setAppliedLine(loc.address);
          return true;
        }
        setLocationError(
          'Location not found. Check city, state, and ZIP (street optional for pricing region).',
        );
        return false;
      } catch {
        setLocationError('Error searching location. Please try again.');
        return false;
      } finally {
        setSearchLoading(false);
      }
    },
    [onLocationApplied],
  );

  useEffect(() => {
    if (!projectUsable || !projectJobsite) return;
    const key = formatUSAddress(projectJobsite);
    if (mode !== 'project') return;
    if (key === lastAutoProjectRef.current) return;
    lastAutoProjectRef.current = key;

    const copied = copyUSAddress(projectJobsite);
    onChange(copied);
    void runGeocode(copied);
  }, [mode, projectUsable, projectJobsite, onChange, runGeocode]);

  useEffect(() => {
    if (!projectUsable) {
      setMode('manual');
      lastAutoProjectRef.current = '';
      return;
    }
    setMode('project');
    lastAutoProjectRef.current = '';
  }, [projectUsable, projectLine, projectName]);

  const switchToProject = () => {
    if (!projectJobsite) return;
    setMode('project');
    setLocationError(null);
    const copied = copyUSAddress(projectJobsite);
    onChange(copied);
    lastAutoProjectRef.current = '';
  };

  const switchToManual = () => {
    setMode('manual');
    setLocationError(null);
    lastAutoProjectRef.current = 'manual';
    if (projectUsable && projectJobsite) {
      onChange(copyUSAddress(projectJobsite));
    }
  };

  const handleManualApply = () => {
    void runGeocode(value);
  };

  return (
    <div className="space-y-3">
      {helperText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
      )}

      {projectUsable && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={switchToProject}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              mode === 'project'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Use project jobsite
          </button>
          <button
            type="button"
            onClick={switchToManual}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              mode === 'manual'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <PenLine className="h-4 w-4" />
            Enter different address
          </button>
        </div>
      )}

      {mode === 'project' && projectUsable && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 p-3">
          {projectName && (
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
              From project: {projectName}
            </p>
          )}
          <p className="text-sm text-gray-800 dark:text-gray-200">{projectLine}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void runGeocode(copyUSAddress(projectJobsite))}
              disabled={searchLoading}
              icon={
                searchLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )
              }
            >
              {searchLoading ? 'Applying…' : 'Re-apply location'}
            </Button>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <>
          {!projectUsable && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {projectName
                ? 'This project has no jobsite on file — enter an address below (you can add one on the Projects page).'
                : 'Select a project above to auto-fill the jobsite, or enter an address below.'}
            </p>
          )}
          <USAddressFields
            value={value}
            onChange={onChange}
            showStreet2
            idPrefix={idPrefix}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualApply}
              disabled={searchLoading || !isUSAddressGeocodable(value)}
              icon={
                searchLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )
              }
            >
              {searchLoading ? 'Applying…' : applyButtonLabel}
            </Button>
          </div>
        </>
      )}

      {locationError && (
        <p className="text-sm text-red-600 dark:text-red-400">{locationError}</p>
      )}

      {appliedLine && !locationError && (
        <p className="text-xs text-green-700 dark:text-green-400 flex items-start gap-1">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Pricing region: {appliedLine}</span>
        </p>
      )}
    </div>
  );
};

export default JobsiteLocationSection;
