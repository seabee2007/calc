import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import type { CompanyLaborRate, ProjectLaborRate, ProjectLaborRateInput } from '../../domain/laborRateTypes';
import {
  copyCompanyRatesToProject,
  fetchCompanyLaborRates,
  fetchProjectLaborRates,
  resetProjectLaborRateToCompany,
  upsertProjectLaborRate,
} from '../../application/laborRateService';
import { findDefaultProjectLaborRate } from '../../application/laborPricingCalculator';

export interface UseProjectLaborRatesResult {
  projectRates: ProjectLaborRate[];
  companyRates: CompanyLaborRate[];
  defaultRate: ProjectLaborRate | undefined;
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => void;
  initializeFromCompany: () => Promise<void>;
  saveProjectRate: (input: ProjectLaborRateInput) => Promise<ProjectLaborRate | null>;
  resetToCompany: (projectRate: ProjectLaborRate) => Promise<void>;
}

export function useProjectLaborRates(projectId: string | null | undefined): UseProjectLaborRatesResult {
  const { user } = useAuth();
  const [projectRates, setProjectRates] = useState<ProjectLaborRate[]>([]);
  const [companyRates, setCompanyRates] = useState<CompanyLaborRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    const [projectResult, companyResult] = await Promise.all([
      fetchProjectLaborRates(projectId),
      user?.id ? fetchCompanyLaborRates(user.id) : Promise.resolve({ data: [], error: null }),
    ]);

    if (projectResult.error) {
      setError(projectResult.error);
    }
    setProjectRates(projectResult.data ?? []);
    setCompanyRates(companyResult.data ?? []);
    setLoading(false);
  }, [projectId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const defaultRate = useMemo(
    () => findDefaultProjectLaborRate(projectRates),
    [projectRates],
  );

  const initializeFromCompany = useCallback(async () => {
    if (!projectId || companyRates.length === 0) return;
    setSaving(true);
    setError(null);
    const result = await copyCompanyRatesToProject(projectId, companyRates);
    if (result.error || !result.data) {
      setError(result.error ?? 'Failed to initialize project labor rates');
    } else {
      setProjectRates(result.data);
    }
    setSaving(false);
  }, [companyRates, projectId]);

  const saveProjectRate = useCallback(
    async (input: ProjectLaborRateInput): Promise<ProjectLaborRate | null> => {
      if (!projectId) return null;
      setSaving(true);
      setError(null);
      const result = await upsertProjectLaborRate({ ...input, projectId });
      if (result.error || !result.data) {
        setError(result.error ?? 'Failed to save project labor rate');
        setSaving(false);
        return null;
      }
      await load();
      setSaving(false);
      return result.data;
    },
    [load, projectId],
  );

  const resetToCompany = useCallback(
    async (projectRate: ProjectLaborRate) => {
      const companyRate = companyRates.find((rate) => rate.roleKey === projectRate.roleKey);
      if (!companyRate) {
        setError('Company default not found for this role.');
        return;
      }
      setSaving(true);
      setError(null);
      const result = await resetProjectLaborRateToCompany(projectRate, companyRate);
      if (result.error) {
        setError(result.error);
      } else {
        await load();
      }
      setSaving(false);
    },
    [companyRates, load],
  );

  return {
    projectRates,
    companyRates,
    defaultRate,
    loading,
    saving,
    error,
    reload: load,
    initializeFromCompany,
    saveProjectRate,
    resetToCompany,
  };
}
