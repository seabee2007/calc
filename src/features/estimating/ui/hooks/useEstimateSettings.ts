import { useCallback, useEffect, useRef, useState } from 'react';
import type { CurrentEstimate } from '../../application/currentEstimateService';
import {
  DEFAULT_ESTIMATE_SETTINGS,
  estimateSettingsAreEqual,
  loadUserSettingsForEstimateImport,
  mergeEstimateSettingsFromUserSources,
  normalizeEstimateSettings,
  parseEstimateSettingsFromAssumptions,
  type EstimateSettings,
} from '../../application/estimateSettings';

export interface UseEstimateSettingsResult {
  settings: EstimateSettings;
  savedSettings: EstimateSettings;
  dirty: boolean;
  importing: boolean;
  importError: string | null;
  updateSettings: (patch: Partial<EstimateSettings>) => void;
  replaceSettings: (next: EstimateSettings) => void;
  resetSettings: () => void;
  importFromUserSettings: () => Promise<void>;
  rehydrateFromEstimate: (estimate: CurrentEstimate | null) => void;
}

export function useEstimateSettings(): UseEstimateSettingsResult {
  const [settings, setSettings] = useState<EstimateSettings>(DEFAULT_ESTIMATE_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<EstimateSettings>(DEFAULT_ESTIMATE_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const hydratedEstimateIdRef = useRef<string | null>(null);

  const rehydrateFromEstimate = useCallback((estimate: CurrentEstimate | null) => {
    if (!estimate) {
      setSettings(DEFAULT_ESTIMATE_SETTINGS);
      setSavedSettings(DEFAULT_ESTIMATE_SETTINGS);
      setDirty(false);
      hydratedEstimateIdRef.current = null;
      return;
    }

    const loaded = parseEstimateSettingsFromAssumptions(estimate.assumptions);
    setSettings(loaded);
    setSavedSettings(loaded);
    setDirty(false);
    hydratedEstimateIdRef.current = estimate.id;
  }, []);

  useEffect(() => {
    setDirty(!estimateSettingsAreEqual(settings, savedSettings));
  }, [settings, savedSettings]);

  const updateSettings = useCallback((patch: Partial<EstimateSettings>) => {
    setSettings((current) => normalizeEstimateSettings({ ...current, ...patch }));
    setImportError(null);
  }, []);

  const replaceSettings = useCallback((next: EstimateSettings) => {
    setSettings(normalizeEstimateSettings(next));
    setImportError(null);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(savedSettings);
    setImportError(null);
  }, [savedSettings]);

  const importFromUserSettings = useCallback(async () => {
    setImporting(true);
    setImportError(null);
    try {
      const sources = await loadUserSettingsForEstimateImport();
      setSettings((current) => mergeEstimateSettingsFromUserSources(current, sources));
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Could not import user settings.',
      );
    } finally {
      setImporting(false);
    }
  }, []);

  return {
    settings,
    savedSettings,
    dirty,
    importing,
    importError,
    updateSettings,
    replaceSettings,
    resetSettings,
    importFromUserSettings,
    rehydrateFromEstimate,
  };
}
