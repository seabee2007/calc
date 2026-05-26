import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Save, X, Calendar, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import USAddressFields from '../address/USAddressFields';
import { Project, USAddress } from '../../types';
import {
  EMPTY_US_ADDRESS,
  formatUSAddress,
  isUSAddressGeocodable,
  copyUSAddress,
  mergeVerifiedJobsiteAddress,
  repairJobsiteAddress,
  sanitizeUSAddress,
  validateUSAddress,
} from '../../types/address';
import { verifyJobsiteAddress } from '../../services/geocodeService';

export interface ProjectFormData {
  name: string;
  description: string;
  pourDate?: string;
  jobsiteAddress: USAddress;
}

interface ProjectFormProps {
  onSubmit: (data: ProjectFormData) => void | Promise<void>;
  onCancel: () => void;
  initialData?: Partial<ProjectFormData>;
  isEditing?: boolean;
  isModal?: boolean;
  submitLabel?: string;
  hidePourDate?: boolean;
  /** Require Mapbox-verified jobsite before create/update (workflow step 1). */
  requireVerifiedAddress?: boolean;
}

const defaultJobsite = (): USAddress => ({ ...EMPTY_US_ADDRESS });

const ProjectForm: React.FC<ProjectFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
  isModal = false,
  submitLabel,
  hidePourDate = false,
  requireVerifiedAddress = false,
}) => {
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedLine, setVerifiedLine] = useState<string | null>(null);
  const [verifiedAddress, setVerifiedAddress] = useState<USAddress | null>(null);

  const buildDefaults = (): ProjectFormData => ({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    pourDate: hidePourDate
      ? initialData?.pourDate
      : initialData?.pourDate ?? new Date().toISOString().split('T')[0],
    jobsiteAddress: initialData?.jobsiteAddress
      ? repairJobsiteAddress(initialData.jobsiteAddress)
      : defaultJobsite(),
  });

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    defaultValues: buildDefaults(),
  });

  useEffect(() => {
    reset(buildDefaults());
  }, [
    initialData?.name,
    initialData?.description,
    initialData?.pourDate,
    initialData?.jobsiteAddress?.street,
    initialData?.jobsiteAddress?.street2,
    initialData?.jobsiteAddress?.city,
    initialData?.jobsiteAddress?.state,
    initialData?.jobsiteAddress?.zip,
    hidePourDate,
    reset,
  ]);

  const runVerify = async (addr: USAddress): Promise<USAddress | null> => {
    const validation = validateUSAddress(addr, {
      requireStreet: true,
      requireZip: false,
    });
    if (!validation.ok) {
      setVerifyError(validation.errors.join(' '));
      setVerifiedLine(null);
      setVerifiedAddress(null);
      return null;
    }

    setVerifyLoading(true);
    setVerifyError(null);

    try {
      const result = await verifyJobsiteAddress(addr);
      setVerifiedLine(result.formattedAddress);
      const normalized = mergeVerifiedJobsiteAddress(copyUSAddress(addr), result.formattedAddress);
      setVerifiedAddress(normalized);
      reset({ ...getValues(), jobsiteAddress: normalized });
      return normalized;
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Could not verify address.');
      setVerifiedLine(null);
      setVerifiedAddress(null);
      return null;
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyClick = () => {
    void runVerify(getValues('jobsiteAddress'));
  };

  const onFormSubmit = async (data: ProjectFormData) => {
    let jobsite = data.jobsiteAddress;

    if (requireVerifiedAddress && isUSAddressGeocodable(jobsite)) {
      if (verifiedAddress && verifiedLine) {
        jobsite = verifiedAddress;
      } else {
        const normalized = await runVerify(jobsite);
        if (!normalized) return;
        jobsite = normalized;
      }
    }

    const payload: ProjectFormData = {
      ...data,
      jobsiteAddress: sanitizeUSAddress(jobsite),
    };
    if (hidePourDate) delete payload.pourDate;
    await onSubmit(payload);
  };

  const formBody = (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <Input
        label="Project Name"
        fullWidth
        error={errors.name?.message?.toString()}
        {...register('name', { required: 'Project name is required' })}
      />

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white"
          {...register('description')}
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
          Jobsite address
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {requireVerifiedAddress
            ? 'Verify the address before continuing — used for batch plant search, weather, and routing.'
            : 'Used for weather, routing, and batch plant lookup in Placement Planner.'}
        </p>
        <Controller
          name="jobsiteAddress"
          control={control}
          render={({ field }) => (
            <USAddressFields
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                setVerifiedLine(null);
                setVerifiedAddress(null);
                setVerifyError(null);
              }}
              showStreet2
              idPrefix="project-jobsite"
            />
          )}
        />
        {requireVerifiedAddress && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleVerifyClick}
              disabled={verifyLoading}
              icon={
                verifyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )
              }
            >
              {verifyLoading ? 'Verifying…' : 'Verify address'}
            </Button>
            {verifiedLine && (
              <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {verifiedLine}
              </span>
            )}
          </div>
        )}
        {verifyError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{verifyError}</p>
        )}
      </div>

      {!hidePourDate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pour Date
          </label>
          <div className="relative">
            <Input
              type="date"
              icon={<Calendar size={18} />}
              {...register('pourDate')}
              fullWidth
            />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set the concrete pour date to track strength development
          </p>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} icon={<X size={18} />}>
          Cancel
        </Button>
        <Button type="submit" icon={<Save size={18} />}>
          {submitLabel ?? (isEditing ? 'Update Project' : 'Create Project')}
        </Button>
      </div>
    </form>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Project' : 'Create New Project'}
              </h2>
              <button
                type="button"
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            {formBody}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {isEditing ? 'Edit Project' : 'Create New Project'}
      </h2>
      {formBody}
    </Card>
  );
};

export default ProjectForm;
