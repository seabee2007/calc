import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Save, X, Calendar, MapPin, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  ProfessionalizeScopeEmptyError,
  ProfessionalizeScopeFailedError,
  PROFESSIONALIZE_SCOPE_EMPTY_MESSAGE,
  PROFESSIONALIZE_SCOPE_ERROR_MESSAGE,
  PROFESSIONALIZE_SCOPE_SUCCESS_MESSAGE,
  professionalizeProjectScope,
} from '../../features/projects/application/professionalizeProjectScope';
import {
  PROJECT_SCOPE_TEMPLATES,
  getProjectScopeTemplatesByCategory,
  type ProjectScopeTemplate,
} from '../../features/projects/data/projectScopeTemplates';
import EstimateWorkspaceToast, {
  type EstimateWorkspaceToastVariant,
} from '../../features/estimating/ui/components/EstimateWorkspaceToast';
import { useProjectStore } from '../../store';
import { generateProjectName } from '../../services/projectNamingService';
import { resolveStateCode } from '../../types/address';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import USAddressFields from '../address/USAddressFields';
import type { USAddress } from '../../types/address';
import type { ProjectClientInfo } from '../../types/projectClient';
import {
  EMPTY_US_ADDRESS,
  copyUSAddress,
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
import { isValidEmailAddress } from '../../../supabase/functions/_shared/emailValidation.ts';
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
  /** Total workers normally available for this project per workday. */
  projectCrewSize: number;
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
  const [nameGenerating, setNameGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedNamePreview, setGeneratedNamePreview] = useState<string | null>(null);
  const [scopeImproving, setScopeImproving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [pendingTemplate, setPendingTemplate] = useState<ProjectScopeTemplate | null>(null);
  const [scopeToast, setScopeToast] = useState<{
    message: string;
    variant: EstimateWorkspaceToastVariant;
  } | null>(null);
  const [showInviteEmailOverride, setShowInviteEmailOverride] = useState(
    Boolean(initialData?.clientPortalAccess?.overrideInviteEmail?.trim()),
  );
  const clientEmailInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const storeProjects = useProjectStore((s) => s.projects);

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
      overrideInviteEmail: initialData?.clientPortalAccess?.overrideInviteEmail ?? '',
      ...initialData?.clientPortalAccess,
    },
    projectCrewSize: initialData?.projectCrewSize ?? 7,
  });

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ProjectFormData>({
    defaultValues: buildDefaults(),
  });

  const clientSameAsJobsite = watch('clientInfo.clientAddressSameAsJobsite');
  const inviteClientPortal = watch('clientPortalAccess.enabled');
  const clientInfoName = watch('clientInfo.clientName');
  const clientInfoEmail = watch('clientInfo.clientEmail');
  const clientInfoPhone = watch('clientInfo.clientPhone');
  const overrideInviteEmail = watch('clientPortalAccess.overrideInviteEmail');
  const projectNameValue = watch('name');

  const {
    ref: clientEmailRhfRef,
    ...clientEmailField
  } = register('clientInfo.clientEmail', {
    onChange: () => {
      if (getValues('clientPortalAccess.enabled')) {
        clearErrors('clientPortalAccess.overrideInviteEmail');
      }
    },
  });

  const effectiveInviteEmail =
    overrideInviteEmail?.trim() || clientInfoEmail?.trim() || '';

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

  const handleProfessionalizeScope = useCallback(async () => {
    if (scopeImproving) return;

    const currentScope = getValues('description') ?? '';
    setScopeToast(null);

    setScopeImproving(true);
    try {
      const improvedScope = await professionalizeProjectScope({
        scopeText: currentScope,
        projectName: projectNameValue?.trim() || undefined,
      });
      setValue('description', improvedScope, { shouldDirty: true, shouldValidate: true });
      setScopeToast({
        message: PROFESSIONALIZE_SCOPE_SUCCESS_MESSAGE,
        variant: 'success',
      });
    } catch (error) {
      if (error instanceof ProfessionalizeScopeEmptyError) {
        setScopeToast({
          message: PROFESSIONALIZE_SCOPE_EMPTY_MESSAGE,
          variant: 'error',
        });
        return;
      }

      if (error instanceof ProfessionalizeScopeFailedError) {
        console.error('[ProjectForm] Professionalize scope failed', error);
        setScopeToast({
          message: PROFESSIONALIZE_SCOPE_ERROR_MESSAGE,
          variant: 'error',
        });
        return;
      }

      console.error('[ProjectForm] Professionalize scope failed', error);
      setScopeToast({
        message: PROFESSIONALIZE_SCOPE_ERROR_MESSAGE,
        variant: 'error',
      });
    } finally {
      setScopeImproving(false);
    }
  }, [getValues, projectNameValue, scopeImproving, setValue]);

  const applyTemplate = (template: ProjectScopeTemplate) => {
    setValue('description', template.scopeText, { shouldDirty: true, shouldValidate: true });
    setPendingTemplate(null);
  };

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    if (!id) return;
    const template = PROJECT_SCOPE_TEMPLATES.find(t => t.id === id);
    if (!template) return;
    const current = getValues('description') ?? '';
    if (current.trim()) {
      setPendingTemplate(template);
    } else {
      applyTemplate(template);
    }
  };

  const cancelTemplate = () => {
    setPendingTemplate(null);
    setSelectedTemplateId('');
  };

  const onFormSubmit = async (data: ProjectFormData) => {
    setGenerateError(null);
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

    let projectName = data.name.trim();

    if (!isEditing) {
      if (!user?.id) {
        setGenerateError('Sign in to create a project.');
        return;
      }
      setNameGenerating(true);
      setGeneratedNamePreview(null);
      try {
        const generated = await generateProjectName({
          scopeDescription: data.description,
          jobsiteAddress: sanitizeUSAddress(jobsite),
          userId: user.id,
          additionalNames: storeProjects.map((p) => p.name),
        });
        projectName = generated.name;
        setGeneratedNamePreview(generated.name);
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : 'Could not generate project name.');
        return;
      } finally {
        setNameGenerating(false);
      }
    } else if (!projectName) {
      setGenerateError('Project name is required.');
      return;
    }

    const payload: ProjectFormData = {
      ...data,
      name: projectName,
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
      const portalName = payload.clientInfo.clientName.trim();
      const mainClientEmail = payload.clientInfo.clientEmail?.trim() || '';
      const inviteOverride = payload.clientPortalAccess.overrideInviteEmail?.trim() || '';
      const portalEmail = inviteOverride || mainClientEmail;

      if (!portalName) {
        setError('clientInfo.clientName', {
          type: 'manual',
          message: 'Client name is required for portal invite',
        });
        return;
      }
      if (!portalEmail) {
        setError('clientPortalAccess.overrideInviteEmail', {
          type: 'manual',
          message: 'Client email is required to send a portal invite.',
        });
        return;
      }
      if (!isValidEmailAddress(portalEmail)) {
        setError('clientPortalAccess.overrideInviteEmail', {
          type: 'manual',
          message: 'Enter a valid invite email address.',
        });
        return;
      }

      payload.clientPortalAccess = {
        enabled: true,
        clientName: portalName,
        clientEmail: portalEmail,
        clientPhone: formatUSPhoneNumber(payload.clientInfo.clientPhone?.trim()) || undefined,
        overrideInviteEmail: inviteOverride || undefined,
      };
    } else if (payload.clientPortalAccess) {
      payload.clientPortalAccess.enabled = false;
      payload.clientPortalAccess.overrideInviteEmail = undefined;
    }

    await onSubmit(payload);
  };

  const jobsiteState = watch('jobsiteAddress.state');
  const stateCodePreview = resolveStateCode(jobsiteState ?? '');
  const yearSuffix = String(new Date().getFullYear()).slice(-2);

  const formBody = (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {isEditing ? (
        <Input
          label="Project Name"
          fullWidth
          error={errors.name?.message?.toString()}
          {...register('name', { required: 'Project name is required' })}
        />
      ) : (
        <div className="rounded-lg border border-cyan-200/60 bg-cyan-50/40 p-4 dark:border-cyan-800/50 dark:bg-cyan-950/20">
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Auto project number & name
              </p>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                When you click Create Project, we assign the next number for the year with your
                jobsite state prefix
                {stateCodePreview ? (
                  <>
                    {' '}
                    (<span className="font-mono text-cyan-700 dark:text-cyan-300">
                      {stateCodePreview}
                      {yearSuffix}-###
                    </span>
                    )
                  </>
                ) : (
                  <> (e.g. GA26-201)</>
                )}{' '}
                and summarize your job scope into the title.
              </p>
              {generatedNamePreview && (
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  {generatedNamePreview}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {generateError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {generateError}
        </p>
      )}

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
            data-testid="client-info-email-input"
            {...clientEmailField}
            ref={(element) => {
              clientEmailRhfRef(element);
              clientEmailInputRef.current = element;
            }}
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
            {inviteClientPortal
              ? 'Client portal access uses the client information above. You can override the invite email if needed.'
              : 'Invite your client to a read-only project dashboard — no account required.'}
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
                      } else {
                        setShowInviteEmailOverride(false);
                        setValue('clientPortalAccess.overrideInviteEmail', '');
                        clearErrors('clientPortalAccess.overrideInviteEmail');
                      }
                    }}
                  />
                  Invite client to view project dashboard
                </label>
              )}
            />
            {inviteClientPortal && (
              <div
                className="rounded-md bg-white/70 dark:bg-slate-900/50 p-3 text-sm space-y-3"
                data-testid="client-portal-invite-preview"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Invite will be sent to
                </p>
                <div className="space-y-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {clientInfoName?.trim() || '—'}
                  </p>
                  {effectiveInviteEmail ? (
                    <p className="text-gray-700 dark:text-gray-300 break-all">{effectiveInviteEmail}</p>
                  ) : (
                    <p className="text-amber-700 dark:text-amber-300" role="alert">
                      Client email is required to send a portal invite.
                    </p>
                  )}
                  {clientInfoPhone?.trim() && (
                    <p className="text-gray-600 dark:text-gray-400">
                      Phone: {clientInfoPhone.trim()}
                    </p>
                  )}
                </div>

                {!clientInfoEmail?.trim() && !overrideInviteEmail?.trim() && (
                  <button
                    type="button"
                    className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                    onClick={() => clientEmailInputRef.current?.focus()}
                  >
                    Add client email
                  </button>
                )}

                {!showInviteEmailOverride ? (
                  <button
                    type="button"
                    className="text-sm text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                    onClick={() => setShowInviteEmailOverride(true)}
                  >
                    Use different invite email
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Input
                      label="Invite email"
                      type="email"
                      fullWidth
                      placeholder="portal-invite@example.com"
                      data-testid="invite-email-override-input"
                      error={errors.clientPortalAccess?.overrideInviteEmail?.message?.toString()}
                      {...register('clientPortalAccess.overrideInviteEmail', {
                        onChange: () => clearErrors('clientPortalAccess.overrideInviteEmail'),
                      })}
                    />
                    <button
                      type="button"
                      className="text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                      onClick={() => {
                        setShowInviteEmailOverride(false);
                        setValue('clientPortalAccess.overrideInviteEmail', '');
                        clearErrors('clientPortalAccess.overrideInviteEmail');
                      }}
                    >
                      Use client email instead
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Project planning
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Schedule resource limits used by the Level III Gantt histogram and resource leveling.
          </p>
        </div>
        <Input
          label="Project Crew Size"
          type="number"
          min={1}
          max={999}
          step={1}
          fullWidth
          error={errors.projectCrewSize?.message?.toString()}
          {...register('projectCrewSize', {
            required: 'Project crew size is required',
            min: { value: 1, message: 'Must be at least 1 worker' },
            max: { value: 999, message: 'Must be 999 or fewer workers' },
            valueAsNumber: true,
          })}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Total workers normally available for this project per workday. Used for the Level III
          Gantt resource histogram and resource leveling.
        </p>
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Project scope
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={scopeImproving}
            icon={
              scopeImproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )
            }
            onClick={() => void handleProfessionalizeScope()}
          >
            {scopeImproving ? 'Cleaning up…' : 'Clean up scope'}
          </Button>
        </div>

        <div className="mb-2">
          <label
            htmlFor="scope-template-select"
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
          >
            Start from a scope template:
          </label>
          <select
            id="scope-template-select"
            data-testid="scope-template-select"
            value={selectedTemplateId}
            onChange={e => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white text-sm"
          >
            <option value="">Select a scope template…</option>
            {Object.entries(getProjectScopeTemplatesByCategory()).map(([category, templates]) => (
              <optgroup key={category} label={category}>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Choose a template to prefill the scope, then edit it for this project.
            A detailed scope helps Arden suggest estimate divisions, activities,
            quantities, and pricing gaps later.
          </p>
        </div>

        {pendingTemplate !== null && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-sm">
            <span className="flex-1 text-yellow-800 dark:text-yellow-200">
              Replace current scope with this template?
            </span>
            <button
              type="button"
              onClick={() => applyTemplate(pendingTemplate)}
              className="rounded px-2 py-1 text-xs font-medium bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              Replace
            </button>
            <button
              type="button"
              data-testid="scope-template-cancel"
              onClick={cancelTemplate}
              className="rounded px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}

        <textarea
          id="description"
          rows={5}
          placeholder="Describe the work — or choose a template above to get started."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white"
          {...register('description', {
            required: isEditing ? false : 'Job scope is required to name the project',
          })}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.description.message?.toString()}
          </p>
        )}
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
        <Button
          type="submit"
          disabled={nameGenerating}
          icon={
            nameGenerating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )
          }
        >
          {nameGenerating
            ? 'Generating name…'
            : submitLabel ?? (isEditing ? 'Update Project' : 'Create Project')}
        </Button>
      </div>
    </form>
  );

  const scopeToastElement = (
    <EstimateWorkspaceToast
      message={scopeToast?.message ?? null}
      variant={scopeToast?.variant ?? 'success'}
      zIndexClass="z-[10060]"
      onDismiss={() => setScopeToast(null)}
    />
  );

  if (isModal) {
    return (
      <>
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
      {scopeToastElement}
      </>
    );
  }

  return (
    <>
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing ? 'Edit Project' : 'Create New Project'}
        </h2>
        {formBody}
      </Card>
      {scopeToastElement}
    </>
  );
};

export default ProjectForm;
