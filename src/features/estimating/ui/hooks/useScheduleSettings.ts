import { useCallback, useState } from 'react';
import type { CurrentEstimate } from '../../application/currentEstimateService';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  type CpmLogicLink,
  type CpmResult,
  type LogicNetworkLayout,
  type LogicNetworkViewMode,
  type ScheduleSettings,
} from '../../scheduling/cpmTypes';
import {
  hasLogicLinksKey,
  parseCpmResultCacheFromAssumptions,
  parseLogicLinksFromAssumptions,
  parseLogicNetworkInitializedFromAssumptions,
  parseLogicNetworkLayoutFromAssumptions,
  parseLogicNetworkViewModeFromAssumptions,
  parseLeveledOffsetsFromAssumptions,
  parseLogicReviewIgnoredFromAssumptions,
  parseScheduleSettingsFromAssumptions,
  sanitizeScheduleAssumptionsForLineItems,
  seedLogicLinksFromLineItems,
} from '../../scheduling/scheduleAssumptions';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';

export interface UseScheduleSettingsResult {
  scheduleSettings: ScheduleSettings;
  logicLinks: CpmLogicLink[];
  logicNetworkLayout: LogicNetworkLayout[];
  leveledOffsets: Record<string, number>;
  logicReviewIgnored: string[];
  logicNetworkInitialized: boolean;
  logicNetworkViewMode: LogicNetworkViewMode;
  committedCpmResult: CpmResult | null;
  updateScheduleSettings: (patch: Partial<ScheduleSettings>) => void;
  setLogicLinks: (links: CpmLogicLink[]) => void;
  setLogicNetworkLayout: (layout: LogicNetworkLayout[]) => void;
  setLeveledOffsets: (offsets: Record<string, number>) => void;
  setLogicReviewIgnored: (ignoredWarningIds: string[]) => void;
  setLogicNetworkInitialized: (initialized: boolean) => void;
  setLogicNetworkViewMode: (mode: LogicNetworkViewMode) => void;
  setCommittedCpmResult: (result: CpmResult | null) => void;
  rehydrateFromEstimate: (estimate: CurrentEstimate | null, lineItems: EstimateDomainTask[]) => void;
}

export function useScheduleSettings(): UseScheduleSettingsResult {
  const [scheduleSettings, setScheduleSettings] =
    useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [logicLinks, setLogicLinksState] = useState<CpmLogicLink[]>([]);
  const [logicNetworkLayout, setLogicNetworkLayoutState] = useState<LogicNetworkLayout[]>([]);
  const [leveledOffsets, setLeveledOffsetsState] = useState<Record<string, number>>({});
  const [logicReviewIgnored, setLogicReviewIgnoredState] = useState<string[]>([]);
  const [logicNetworkInitialized, setLogicNetworkInitializedState] = useState(false);
  const [logicNetworkViewMode, setLogicNetworkViewModeState] =
    useState<LogicNetworkViewMode>('logic-network');
  const [committedCpmResult, setCommittedCpmResultState] = useState<CpmResult | null>(null);

  const rehydrateFromEstimate = useCallback(
    (estimate: CurrentEstimate | null, lineItems: EstimateDomainTask[]) => {
      if (!estimate) {
        setScheduleSettings(DEFAULT_SCHEDULE_SETTINGS);
        setLogicLinksState([]);
        setLogicNetworkLayoutState([]);
        setLeveledOffsetsState({});
        setLogicReviewIgnoredState([]);
        setLogicNetworkInitializedState(false);
        setLogicNetworkViewModeState('logic-network');
        setCommittedCpmResultState(null);
        return;
      }

      const sanitizedAssumptions = sanitizeScheduleAssumptionsForLineItems(
        estimate.assumptions,
        lineItems,
      );
      const parsedSettings = parseScheduleSettingsFromAssumptions(sanitizedAssumptions);
      const hasExplicitScheduleSettings =
        sanitizedAssumptions.scheduleSettings != null &&
        typeof sanitizedAssumptions.scheduleSettings === 'object';

      if (!hasExplicitScheduleSettings) {
        const estimateSettingsRaw = sanitizedAssumptions.estimateSettings as
          | Record<string, unknown>
          | undefined;
        parsedSettings.hoursPerDay =
          typeof estimateSettingsRaw?.hoursPerDay === 'number'
            ? estimateSettingsRaw.hoursPerDay
            : DEFAULT_SCHEDULE_SETTINGS.hoursPerDay;
        parsedSettings.availableCrewSize =
          typeof estimateSettingsRaw?.defaultCrewSize === 'number'
            ? estimateSettingsRaw.defaultCrewSize
            : DEFAULT_SCHEDULE_SETTINGS.availableCrewSize;
      }

      setScheduleSettings(parsedSettings);

      const initialized = parseLogicNetworkInitializedFromAssumptions(sanitizedAssumptions);
      const hasLinksKey = hasLogicLinksKey(estimate.assumptions);
      const existingLinks = parseLogicLinksFromAssumptions(sanitizedAssumptions);
      if (initialized || hasLinksKey) {
        setLogicLinksState(existingLinks);
      } else {
        setLogicLinksState(seedLogicLinksFromLineItems(lineItems));
      }
      setLogicNetworkInitializedState(initialized || hasLinksKey);

      setLogicNetworkLayoutState(parseLogicNetworkLayoutFromAssumptions(sanitizedAssumptions));
      setLeveledOffsetsState(parseLeveledOffsetsFromAssumptions(sanitizedAssumptions));
      setLogicReviewIgnoredState(parseLogicReviewIgnoredFromAssumptions(sanitizedAssumptions));
      setLogicNetworkViewModeState(parseLogicNetworkViewModeFromAssumptions(sanitizedAssumptions));
      setCommittedCpmResultState(parseCpmResultCacheFromAssumptions(sanitizedAssumptions));
    },
    [],
  );

  const updateScheduleSettings = useCallback((patch: Partial<ScheduleSettings>) => {
    setScheduleSettings((current) => ({ ...current, ...patch }));
  }, []);

  const setLogicLinks = useCallback((links: CpmLogicLink[]) => {
    setLogicLinksState(links);
  }, []);

  const setLogicNetworkLayout = useCallback((layout: LogicNetworkLayout[]) => {
    setLogicNetworkLayoutState(layout);
  }, []);

  const setLeveledOffsets = useCallback((offsets: Record<string, number>) => {
    setLeveledOffsetsState(offsets);
  }, []);

  const setLogicReviewIgnored = useCallback((ignoredWarningIds: string[]) => {
    setLogicReviewIgnoredState(ignoredWarningIds);
  }, []);

  const setLogicNetworkInitialized = useCallback((initialized: boolean) => {
    setLogicNetworkInitializedState(initialized);
  }, []);

  const setLogicNetworkViewMode = useCallback((mode: LogicNetworkViewMode) => {
    setLogicNetworkViewModeState(mode);
  }, []);

  const setCommittedCpmResult = useCallback((result: CpmResult | null) => {
    setCommittedCpmResultState(result);
  }, []);

  return {
    scheduleSettings,
    logicLinks,
    logicNetworkLayout,
    leveledOffsets,
    logicReviewIgnored,
    logicNetworkInitialized,
    logicNetworkViewMode,
    committedCpmResult,
    updateScheduleSettings,
    setLogicLinks,
    setLogicNetworkLayout,
    setLeveledOffsets,
    setLogicReviewIgnored,
    setLogicNetworkInitialized,
    setLogicNetworkViewMode,
    setCommittedCpmResult,
    rehydrateFromEstimate,
  };
}
