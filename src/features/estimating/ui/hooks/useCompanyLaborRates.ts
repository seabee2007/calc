import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import type { CompanyLaborRate, CompanyLaborRateInput } from '../../domain/laborRateTypes';
import {
  deleteCompanyLaborRate,
  fetchCompanyLaborRates,
  seedStarterLaborRates,
  upsertCompanyLaborRate,
} from '../../application/laborRateService';

export interface UseCompanyLaborRatesResult {
  rates: CompanyLaborRate[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => void;
  saveRate: (input: CompanyLaborRateInput) => Promise<boolean>;
  disableRate: (id: string) => Promise<void>;
  seedDefaults: () => Promise<void>;
}

export function useCompanyLaborRates(): UseCompanyLaborRatesResult {
  const { user } = useAuth();
  const [rates, setRates] = useState<CompanyLaborRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const result = await fetchCompanyLaborRates(user.id);
    if (result.error || !result.data) {
      setError(result.error ?? 'Failed to load labor rates');
      setRates([]);
    } else if (result.data.length === 0) {
      const seeded = await seedStarterLaborRates(user.id);
      if (seeded.error || !seeded.data) {
        setError(seeded.error ?? 'Failed to seed starter labor rates');
        setRates([]);
      } else {
        setRates(seeded.data);
      }
    } else {
      setRates(result.data);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRate = useCallback(
    async (input: CompanyLaborRateInput): Promise<boolean> => {
      if (!user?.id) {
        setError('Sign in to save labor rates.');
        return false;
      }
      setSaving(true);
      setError(null);
      const result = await upsertCompanyLaborRate({ ...input, userId: user.id });
      if (result.error || !result.data) {
        setError(result.error ?? 'Failed to save labor rate');
        setSaving(false);
        return false;
      }
      await load();
      setSaving(false);
      return true;
    },
    [load, user?.id],
  );

  const disableRate = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      setSaving(true);
      setError(null);
      const result = await deleteCompanyLaborRate(id, user.id);
      if (result.error) {
        setError(result.error);
      } else {
        await load();
      }
      setSaving(false);
    },
    [load, user?.id],
  );

  const seedDefaults = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    const result = await seedStarterLaborRates(user.id);
    if (result.error || !result.data) {
      setError(result.error ?? 'Failed to reset starter defaults');
    } else {
      setRates(result.data);
    }
    setSaving(false);
  }, [user?.id]);

  return {
    rates,
    loading,
    saving,
    error,
    reload: load,
    saveRate,
    disableRate,
    seedDefaults,
  };
}
