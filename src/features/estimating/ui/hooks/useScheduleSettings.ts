import { useCallback, useState } from 'react';
import type { CurrentEstimate } from '../../application/currentEstimateService';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  type CpmLogicLink,
  type LogicNetworkLayout,
  type ScheduleSettings,
} from '../../scheduling/cpmTypes';
import {
  parseLogicLinksFromAssumptions,
  parseLogicNetworkLayoutFromAssumptions,
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
  updateScheduleSettings: (patch: Partial<ScheduleSettings>) => void;
  setLogicLinks: (links: CpmLogicLink[]) => void;
  setLogicNetworkLayout: (layout: LogicNetworkLayout[]) => void;
  setLeveledOffsets: (offsets: Record<string, number>) => void;
  setLogicReviewIgnored: (ignoredWarningIds: string[]) => void;
  rehydrateFromEstimate: (estimate: CurrentEstimate | null, lineItems: EstimateDomainTask[]) => void;
}

export function useScheduleSettings(): UseScheduleSettingsResult {
  const [scheduleSettings, setScheduleSettings] =
    useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [logicLinks, setLogicLinksState] = useState<CpmLogicLink[]>([]);
  const [logicNetworkLayout, setLogicNetworkLayoutState] = useState<LogicNetworkLayout[]>([]);
  const [leveledOffsets, setLeveledOffsetsState] = useState<Record<string, number>>({});
  const [logicReviewIgnored, setLogicReviewIgnoredState] = useState<string[]>([]);

  const rehydrateFromEstimate = useCallback(
    (estimate: CurrentEstimate | null, lineItems: EstimateDomainTask[]) => {
      if (!estimate) {
        setScheduleSettings(DEFAULT_SCHEDULE_SETTINGS);
        setLogicLinksState([]);
        setLogicNetworkLayoutState([]);
        setLeveledOffsetsState({});
        setLogicReviewIgnoredState([]);
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

      const existingLinks = parseLogicLinksFromAssumptions(sanitizedAssumptions);
      if (existingLinks.length > 0) {
        setLogicLinksState(existingLinks);
      } else {
        const seeded = seedLogicLinksFromLineItems(lineItems);
        setLogicLinksState(seeded);
      }

      setLogicNetworkLayoutState(parseLogicNetworkLayoutFromAssumptions(sanitizedAssumptions));
      setLeveledOffsetsState(parseLeveledOffsetsFromAssumptions(sanitizedAssumptions));
      setLogicReviewIgnoredState(parseLogicReviewIgnoredFromAssumptions(sanitizedAssumptions));
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

  return {
    scheduleSettings,
    logicLinks,
    logicNetworkLayout,
    leveledOffsets,
    logicReviewIgnored,
    updateScheduleSettings,
    setLogicLinks,
    setLogicNetworkLayout,
    setLeveledOffsets,
    setLogicReviewIgnored,
    rehydrateFromEstimate,
  };
}
