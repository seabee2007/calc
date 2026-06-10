import { useCallback, useState } from 'react';
import type { CurrentEstimate } from '../../application/currentEstimateService';
import { estimateLineItemsToScheduleActivities } from '../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { ScheduleActivity } from '../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  type CpmLogicLink,
  type CpmResult,
  type LogicNetworkLayout,
  type LogicNetworkViewMode,
  type ScheduleSettings,
} from '../../scheduling/cpmTypes';
import {
  clearPrecedenceDiagramState,
  migratePrecedenceDiagramFromLegacyCpmCache,
  parsePrecedenceDiagramFromAssumptions,
  recomputeCommittedCpmFromSavedState,
  type PrecedenceDiagramState,
} from '../../scheduling/precedenceDiagram';
import {
  hasLogicLinksKey,
  parseLogicLinksFromAssumptions,
  parseLogicNetworkInitializedFromAssumptions,
  parseLogicNetworkLayoutFromAssumptions,
  parseLogicNetworkViewModeFromAssumptions,
  parseLeveledOffsetsFromAssumptions,
  parseLogicReviewIgnoredFromAssumptions,
  parseScheduleSettingsFromAssumptions,
  reconcileLogicLinksWithScheduleActivities,
  sanitizeScheduleAssumptionsForLineItems,
  seedLogicLinksFromLineItems,
} from '../../scheduling/scheduleAssumptions';
import { parseEstimateSettingsFromAssumptions } from '../../application/estimateSettings';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';

export interface UseScheduleSettingsResult {
  scheduleSettings: ScheduleSettings;
  logicLinks: CpmLogicLink[];
  logicNetworkLayout: LogicNetworkLayout[];
  leveledOffsets: Record<string, number>;
  logicReviewIgnored: string[];
  logicNetworkInitialized: boolean;
  logicNetworkViewMode: LogicNetworkViewMode;
  precedenceDiagram: PrecedenceDiagramState;
  committedCpmResult: CpmResult | null;
  cpmWarningMessage: string | null;
  updateScheduleSettings: (patch: Partial<ScheduleSettings>) => void;
  setLogicLinks: (links: CpmLogicLink[]) => void;
  setLogicNetworkLayout: (layout: LogicNetworkLayout[]) => void;
  setLeveledOffsets: (offsets: Record<string, number>) => void;
  setLogicReviewIgnored: (ignoredWarningIds: string[]) => void;
  setLogicNetworkInitialized: (initialized: boolean) => void;
  setLogicNetworkViewMode: (mode: LogicNetworkViewMode) => void;
  setPrecedenceDiagram: (state: PrecedenceDiagramState) => void;
  setCommittedCpmResult: (result: CpmResult | null) => void;
  setCpmWarningMessage: (message: string | null) => void;
  rehydrateFromEstimate: (
    estimate: CurrentEstimate | null,
    lineItems: EstimateDomainTask[],
    scheduleActivities?: ScheduleActivity[],
    options?: {
      enableLegacyEstimateScheduleFallback?: boolean;
    },
  ) => void;
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
  const [precedenceDiagram, setPrecedenceDiagramState] =
    useState<PrecedenceDiagramState>(clearPrecedenceDiagramState());
  const [committedCpmResult, setCommittedCpmResultState] = useState<CpmResult | null>(null);
  const [cpmWarningMessage, setCpmWarningMessageState] = useState<string | null>(null);

  const rehydrateFromEstimate = useCallback(
    (
      estimate: CurrentEstimate | null,
      lineItems: EstimateDomainTask[],
      scheduleActivities?: ScheduleActivity[],
      options?: {
        enableLegacyEstimateScheduleFallback?: boolean;
      },
    ) => {
      if (!estimate) {
        setScheduleSettings(DEFAULT_SCHEDULE_SETTINGS);
        setLogicLinksState([]);
        setLogicNetworkLayoutState([]);
        setLeveledOffsetsState({});
        setLogicReviewIgnoredState([]);
        setLogicNetworkInitializedState(false);
        setLogicNetworkViewModeState('logic-network');
        setPrecedenceDiagramState(clearPrecedenceDiagramState());
        setCommittedCpmResultState(null);
        setCpmWarningMessageState(null);
        return;
      }

      const rawPrecedenceDiagram = parsePrecedenceDiagramFromAssumptions(
        estimate.assumptions as Record<string, unknown> | undefined,
      );

      const sanitizedAssumptions = sanitizeScheduleAssumptionsForLineItems(
        estimate.assumptions,
        lineItems,
        scheduleActivities,
      );
      const parsedSettings = parseScheduleSettingsFromAssumptions(sanitizedAssumptions);
      const hasExplicitScheduleSettings =
        sanitizedAssumptions.scheduleSettings != null &&
        typeof sanitizedAssumptions.scheduleSettings === 'object';

      const estimateSettings = parseEstimateSettingsFromAssumptions(sanitizedAssumptions);

      if (!hasExplicitScheduleSettings) {
        parsedSettings.hoursPerDay = estimateSettings.hoursPerDay;
        // Project crew size is stored on the project record — never copy default activity crew size here.
        parsedSettings.availableCrewSize = DEFAULT_SCHEDULE_SETTINGS.availableCrewSize;
      }

      setScheduleSettings(parsedSettings);

      const initialized = parseLogicNetworkInitializedFromAssumptions(sanitizedAssumptions);
      const hasLinksKey = hasLogicLinksKey(estimate.assumptions);
      const parsedLinks = parseLogicLinksFromAssumptions(sanitizedAssumptions);
      const legacyFallbackEnabled = options?.enableLegacyEstimateScheduleFallback === true;

      const linksForState =
        scheduleActivities !== undefined && scheduleActivities.length > 0
          ? reconcileLogicLinksWithScheduleActivities(parsedLinks, scheduleActivities).links
          : parsedLinks;

      if (initialized || hasLinksKey) {
        setLogicLinksState(linksForState);
      } else if (legacyFallbackEnabled && scheduleActivities === undefined) {
        setLogicLinksState(seedLogicLinksFromLineItems(lineItems));
      } else {
        setLogicLinksState([]);
      }
      setLogicNetworkInitializedState(initialized || hasLinksKey);

      setLogicNetworkLayoutState(parseLogicNetworkLayoutFromAssumptions(sanitizedAssumptions));
      setLeveledOffsetsState(parseLeveledOffsetsFromAssumptions(sanitizedAssumptions));
      setLogicReviewIgnoredState(parseLogicReviewIgnoredFromAssumptions(sanitizedAssumptions));

      const savedViewMode = parseLogicNetworkViewModeFromAssumptions(sanitizedAssumptions);
      const { activities: lineItemScheduleActivities } = estimateLineItemsToScheduleActivities(
        lineItems,
        {
          defaultCrewSize: estimateSettings.defaultCrewSize,
          hoursPerDay: parsedSettings.hoursPerDay,
        },
      );
      const activitiesForCpm =
        scheduleActivities !== undefined
          ? scheduleActivities
          : legacyFallbackEnabled
            ? lineItemScheduleActivities
            : [];
      const savedPrecedenceDiagram =
        parsePrecedenceDiagramFromAssumptions(sanitizedAssumptions) ??
        rawPrecedenceDiagram ??
        migratePrecedenceDiagramFromLegacyCpmCache({
          assumptions: estimate.assumptions as Record<string, unknown> | undefined,
          activities: activitiesForCpm,
          logicLinks: linksForState,
          scheduleSettings: parsedSettings,
        });
      const recompute = recomputeCommittedCpmFromSavedState({
        precedenceDiagram: savedPrecedenceDiagram,
        activities: activitiesForCpm,
        logicLinks: linksForState,
        scheduleSettings: parsedSettings,
      });

      setPrecedenceDiagramState(recompute.precedenceDiagram);
      setCommittedCpmResultState(recompute.cpmResult);
      setCpmWarningMessageState(recompute.warningMessage);

      // Honor the persisted diagram mode; layout-only saves must not bounce the user
      // back to Logic Network when CPM is still valid or only appearance changed.
      setLogicNetworkViewModeState(
        savedViewMode === 'precedence-diagram' ? 'precedence-diagram' : 'logic-network',
      );
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

  const setPrecedenceDiagram = useCallback((state: PrecedenceDiagramState) => {
    setPrecedenceDiagramState(state);
  }, []);

  const setCommittedCpmResult = useCallback((result: CpmResult | null) => {
    setCommittedCpmResultState(result);
  }, []);

  const setCpmWarningMessage = useCallback((message: string | null) => {
    setCpmWarningMessageState(message);
  }, []);

  return {
    scheduleSettings,
    logicLinks,
    logicNetworkLayout,
    leveledOffsets,
    logicReviewIgnored,
    logicNetworkInitialized,
    logicNetworkViewMode,
    precedenceDiagram,
    committedCpmResult,
    cpmWarningMessage,
    updateScheduleSettings,
    setLogicLinks,
    setLogicNetworkLayout,
    setLeveledOffsets,
    setLogicReviewIgnored,
    setLogicNetworkInitialized,
    setLogicNetworkViewMode,
    setPrecedenceDiagram,
    setCommittedCpmResult,
    setCpmWarningMessage,
    rehydrateFromEstimate,
  };
}
