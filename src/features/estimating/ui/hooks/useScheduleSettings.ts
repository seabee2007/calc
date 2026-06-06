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
  parseScheduleSettingsFromAssumptions,
} from '../../scheduling/scheduleAssumptions';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';
import { seedLogicLinksFromLineItems } from '../../scheduling/scheduleAssumptions';

export interface UseScheduleSettingsResult {
  scheduleSettings: ScheduleSettings;
  logicLinks: CpmLogicLink[];
  logicNetworkLayout: LogicNetworkLayout[];
  leveledOffsets: Record<string, number>;
  updateScheduleSettings: (patch: Partial<ScheduleSettings>) => void;
  setLogicLinks: (links: CpmLogicLink[]) => void;
  setLogicNetworkLayout: (layout: LogicNetworkLayout[]) => void;
  setLeveledOffsets: (offsets: Record<string, number>) => void;
  rehydrateFromEstimate: (estimate: CurrentEstimate | null, lineItems: EstimateDomainTask[]) => void;
}

export function useScheduleSettings(): UseScheduleSettingsResult {
  const [scheduleSettings, setScheduleSettings] =
    useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [logicLinks, setLogicLinksState] = useState<CpmLogicLink[]>([]);
  const [logicNetworkLayout, setLogicNetworkLayoutState] = useState<LogicNetworkLayout[]>([]);
  const [leveledOffsets, setLeveledOffsetsState] = useState<Record<string, number>>({});

  const rehydrateFromEstimate = useCallback(
    (estimate: CurrentEstimate | null, lineItems: EstimateDomainTask[]) => {
      if (!estimate) {
        setScheduleSettings(DEFAULT_SCHEDULE_SETTINGS);
        setLogicLinksState([]);
        setLogicNetworkLayoutState([]);
        setLeveledOffsetsState({});
        return;
      }

      const parsedSettings = parseScheduleSettingsFromAssumptions(estimate.assumptions);
      // Use estimate settings hoursPerDay as default if schedule settings not yet set
      const assumptions = estimate.assumptions as Record<string, unknown>;
      const hasExplicitScheduleSettings =
        assumptions.scheduleSettings != null &&
        typeof assumptions.scheduleSettings === 'object';

      if (!hasExplicitScheduleSettings) {
        // Copy hoursPerDay and defaultCrewSize from estimateSettings as defaults
        const estimateSettingsRaw = assumptions.estimateSettings as
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

      const existingLinks = parseLogicLinksFromAssumptions(estimate.assumptions);
      if (existingLinks.length > 0) {
        setLogicLinksState(existingLinks);
      } else {
        // Seed from line items on first open
        const seeded = seedLogicLinksFromLineItems(lineItems);
        setLogicLinksState(seeded);
      }

      setLogicNetworkLayoutState(parseLogicNetworkLayoutFromAssumptions(estimate.assumptions));

      const rawOffsets = (estimate.assumptions as Record<string, unknown>).leveledActivityOffsets;
      if (rawOffsets && typeof rawOffsets === 'object' && !Array.isArray(rawOffsets)) {
        const offsets: Record<string, number> = {};
        for (const [key, value] of Object.entries(rawOffsets as Record<string, unknown>)) {
          if (typeof value === 'number' && Number.isFinite(value)) offsets[key] = value;
        }
        setLeveledOffsetsState(offsets);
      } else {
        setLeveledOffsetsState({});
      }
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

  return {
    scheduleSettings,
    logicLinks,
    logicNetworkLayout,
    leveledOffsets,
    updateScheduleSettings,
    setLogicLinks,
    setLogicNetworkLayout,
    setLeveledOffsets,
    rehydrateFromEstimate,
  };
}
