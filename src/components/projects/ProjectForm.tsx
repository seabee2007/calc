import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Save, X, Calendar, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import USAddressFields from '../address/USAddressFields';
import type { USAddress } from '../../types/address';
import type { ProjectClientInfo } from '../../types/projectClient';
import {
  EMPTY_US_ADDRESS,
  copyUSAddress,
  formatUSAddress,
  isUSAddressGeocodable,
  mergeVerifiedJobsiteAddress,
  repairJobsiteAddress,
  sanitizeUSAddress,
  validateUSAddress,
} from '../../types/address';
import { verifyJobsiteAddress } from '../../services/geocodeService';
import { EMPTY_PROJECT_CLIENT } from '../../types/projectClient';
import type { ClientPortalAccessInput } from '../../types/clientPortal';
import { formatUSPhoneInput, formatUSPhoneNumber } from '../../utils/phoneFormat';
import {
  fetchClientPortalByProjectId,
  getClientPortalUrl,
} from '../../services/clientPortalService';
import type { ClientPortalRecord } from '../../types/clientPortal';

export interface ProjectFormData {
  name: string;
  description: string;
  pourDate?: string;
  jobsiteAddress: USAddress;
  clientInfo: ProjectClientInfo;
  clientPortalAccess?: ClientPortalAccessInput;
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
  /** When editing, used to detect an existing client portal. */
  projectId?: string;
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
  projectId,
}) => {
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedLine, setVerifiedLine] = useState<string | null>(null);
  const [verifiedAddress, setVerifiedAddress] = useState<USAddress | null>(null);
  const [existingPortal, setExistingPortal] = useState<ClientPortalRecord | null>(null);
  const [portalLoading, setPortalLoading] = useState(Boolean(projectId));

  const buildDefaults = (): ProjectFormData => ({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    pourDate: hidePourDate
      ? initialData?.pourDate
      : initialData?.pourDate ?? new Date().toISOString().split('T')[0],
    jobsiteAddress: initialData?.jobsiteAddress
      ? repairJobsiteAddress(initialData.jobsiteAddress)
      : defaultJobsite(),
    clientInfo: {
      ...EMPTY_PROJECT_CLIENT,
      ...initialData?.clientInfo,
      clientPhone: formatUSPhoneNumber(initialData?.clientInfo?.clientPhone),
      clientAddress: initialData?.clientInfo?.clientAddress
        ? repairJobsiteAddress(initialData.clientInfo.clientAddress)
        : { ...EMPTY_US_ADDRESS },
    },
    clientPortalAccess: {
      enabled: false,
      clientName: initialData?.clientInfo?.clientName ?? '',
      clientEmail: initialData?.clientInfo?.clientEmail ?? '',
      clientPhone: formatUSPhoneNumber(initialData?.clientInfo?.clientPhone),
      ...initialData?.clientPortalAccess,
    },
  });

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProjectFormData>({
    defaultValues: buildDefaults(),
  });

  const clientSameAsJobsite = watch('clientInfo.clientAddressSameAsJobsite');
  const inviteClientPortal = watch('clientPortalAccess.enabled');
  const clientInfoName = watch('clientInfo.clientName');
  const clientInfoEmail = watch('clientInfo.clientEmail');
  const clientInfoPhone = watch('clientInfo.clientPhone');

  const syncPortalAccessFromClientInfo = () => {
    const values = getValues();
    setValue('clientPortalAccess.clientName', values.clientInfo.clientName ?? '');
    setValue('clientPortalAccess.clientEmail', values.clientInfo.clientEmail ?? '');
    setValue(
      'clientPortalAccess.clientPhone',
      formatUSPhoneNumber(values.clientInfo.clientPhone ?? ''),
    );
  };

  useEffect(() => {
    if (!inviteClientPortal) return;
    syncPortalAccessFromClientInfo();
  }, [inviteClientPortal, clientInfoName, clientInfoEmail, clientInfoPhone]);

  useEffect(() => {
    if (!projectId) {
      setExistingPortal(null);
      setPortalLoading(false);
      return;
    }

    let cancelled = false;
    setPortalLoading(true);
    void fetchClientPortalByProjectId(projectId)
      .then((row) => {
        if (!cancelled) setExistingPortal(row);
      })
      .finally(() => {
        if (!cancelled) setPortalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

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
    initialData?.clientInfo?.clientName,
    initialData?.clientInfo?.clientCompany,
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
      clientInfo: {
        ...data.clientInfo,
        clientName: data.clientInfo.clientName.trim(),
        clientCompany: data.clientInfo.clientCompany?.trim(),
        clientPhone: formatUSPhoneNumber(data.clientInfo.clientPhone?.trim()) || undefined,
        clientEmail: data.clientInfo.clientEmail?.trim(),
        clientAddressSameAsJobsite: data.clientInfo.clientAddressSameAsJobsite !== false,
        clientAddress:
          data.clientInfo.clientAddressSameAsJobsite === false
            ? sanitizeUSAddress(data.clientInfo.clientAddress ?? EMPTY_US_ADDRESS)
            : undefined,
      },
    };
    if (hidePourDate) delete payload.pourDate;

    if (payload.clientPortalAccess?.enabled) {
      const portalName =
        payload.clientPortalAccess.clientName.trim() || payload.clientInfo.clientName.trim();
      const portalEmail =
        payload.clientPortalAccess.clientEmail.trim() ||
        payload.clientInfo.clientEmail?.trim() ||
        '';
      if (!portalName || !portalEmail) {
        return;
      }
      payload.clientPortalAccess = {
        enabled: true,
        clientName: portalName,
        clientEmail: portalEmail,
        clientPhone:
          formatUSPhoneNumber(payload.clientPortalAccess.clientPhone?.trim()) ||
          formatUSPhoneNumber(payload.clientInfo.clientPhone?.trim()) ||
          undefined,
      };
    } else if (payload.clientPortalAccess) {
      payload.clientPortalAccess.enabled = false;
    }

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

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Client information
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Pre-fills the proposal client section when you generate a quote.
          </p>
        </div>
        <Input
          label="Client name"
          fullWidth
          error={errors.clientInfo?.clientName?.message?.toString()}
          {...register('clientInfo.clientName', {
            required: isEditing ? false : 'Client name is required',
          })}
        />
        <Input
          label="Client company"
          fullWidth
          {...register('clientInfo.clientCompany')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller
            name="clientInfo.clientPhone"
            control={control}
            render={({ field }) => (
              <Input
                label="Client phone"
                type="tel"
                fullWidth
                placeholder="(555) 555-5555"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatUSPhoneInput(e.target.value))}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
          <Input
            label="Client email"
            type="email"
            fullWidth
            {...register('clientInfo.clientEmail')}
          />
        </div>
        <Controller
          name="clientInfo.clientAddressSameAsJobsite"
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600"
                checked={field.value !== false}
                onChange={(e) => field.onChange(e.target.checked)}
              />
              Client address same as jobsite
            </label>
          )}
        />
        {clientSameAsJobsite === false && (
          <Controller
            name="clientInfo.clientAddress"
            control={control}
            render={({ field }) => (
              <USAddressFields
                value={field.value ?? EMPTY_US_ADDRESS}
                onChange={field.onChange}
                showStreet2
                idPrefix="project-client"
              />
            )}
          />
        )}
      </div>

      <div className="rounded-lg border border-cyan-200/60 dark:border-cyan-800/50 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Client access
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Invite your client to a read-only project dashboard — no account required.
          </p>
        </div>

        {portalLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Checking client portal…</p>
        ) : existingPortal ? (
          <div className="rounded-md bg-white/70 dark:bg-slate-900/50 p-3 text-sm space-y-2">
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Client portal is active
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              Client: {existingPortal.clientName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
              {getClientPortalUrl(existingPortal.token)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Copy the link from project details after saving.
            </p>
          </div>
        ) : (
          <>
            <Controller
              name="clientPortalAccess.enabled"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-gray-600"
                    checked={Boolean(field.value)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      field.onChange(checked);
                      if (checked) {
                        syncPortalAccessFromClientInfo();
                      }
                    }}
                  />
                  Invite client to view project dashboard
                </label>
              )}
            />
            {inviteClientPortal && (
              <>
                <p className="text-xs text-cyan-700 dark:text-cyan-300">
                  Pulled from client information above — updates as you edit those fields.
                </p>
                <Input
                  label="Client name"
                  fullWidth
                  readOnly
                  className="bg-slate-50 dark:bg-slate-800/50"
                  error={errors.clientPortalAccess?.clientName?.message?.toString()}
                  {...register('clientPortalAccess.clientName', {
                    required: inviteClientPortal
                      ? 'Client name is required for portal invite'
                      : false,
                  })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Client email"
                    type="email"
                    fullWidth
                    readOnly
                    className="bg-slate-50 dark:bg-slate-800/50"
                    error={errors.clientPortalAccess?.clientEmail?.message?.toString()}
                    {...register('clientPortalAccess.clientEmail', {
                      required: inviteClientPortal
                        ? 'Client email is required for portal invite'
                        : false,
                    })}
                  />
                  <Input
                    label="Client phone (optional)"
                    type="tel"
                    fullWidth
                    readOnly
                    className="bg-slate-50 dark:bg-slate-800/50"
                    {...register('clientPortalAccess.clientPhone')}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Scope / description
        </label>
        <textarea
          id="description"
          rows={3}
          placeholder="Brief scope of work — carries into the proposal scope section."
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
            Placement Date
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
            Set the concrete placement date to track strength development
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
