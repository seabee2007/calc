import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import '@xyflow/react/dist/style.css';
import './logicNetworkControls.css';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  type Viewport,
} from '@xyflow/react';
import {
  getActivityGraphKey,
  type ScheduleActivity,
} from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type {
  CpmLogicLink,
  CpmResult,
  LogicNetworkLayout,
  LogicNetworkViewMode,
} from '../../../scheduling/cpmTypes';
import {
  buildLogicNetworkTopology,
  resolveLogicTopologyLabel,
  type LogicNetworkTopology,
} from '../../../scheduling/logic/logicNetworkTopology';
import type { EffectiveScheduleAnalysis } from '../../../scheduling/effectiveSchedule';
import { LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS } from '../../../scheduling/logicNetworkFullscreen';
import { autoLayoutLogicNetwork } from '../../../scheduling/logic/autoLayoutLogicNetwork';
import {
  LOGIC_NETWORK_CANVAS_HEIGHT_CLASS,
  buildAutoLayoutFromActivities,
  resolveLogicNetworkNodePosition,
} from '../../../scheduling/logicNetworkLayout';
import {
  INITIAL_LOGIC_NETWORK_VIEWPORT,
  shouldAutoFitOnInitialLoad,
} from '../../../scheduling/logicNetworkViewportPolicy';
import { CpmActivityNode, type CpmActivityNodeData } from './CpmActivityNode';
import LogicLinkEditorPanel from './LogicLinkEditorPanel';
import { calculateCpm } from '../../../scheduling/cpm/calculateCpm';
import { isDisplayCritical, resolveTopologyLabel } from '../../../scheduling/cpm/cpmDisplayCritical';
import { sanitizeLogicLinksForActivities } from '../../../scheduling/scheduleAssumptions';

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

const NODE_TYPES = { cpmActivity: CpmActivityNode };

function buildNodeId(graphKey: string): string {
  return `node-${graphKey}`;
}

function buildEdgeId(pred: string, succ: string): string {
  return `edge-${pred}-${succ}`;
}

/** Maps activity codes to a representative graph key (first occurrence) for legacy links. */
function buildCodeToGraphKey(activities: ScheduleActivity[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const activity of activities) {
    if (!map.has(activity.activityCode)) {
      map.set(activity.activityCode, getActivityGraphKey(activity));
    }
  }
  return map;
}

/** Resolves a link endpoint to its node graph key, preferring a current runtime id. */
function resolveEndpointKey(
  runtimeId: string | undefined,
  activityCode: string,
  codeToGraphKey: Map<string, string>,
  validGraphKeys?: Set<string>,
): string {
  const trimmedRuntime = runtimeId?.trim();
  if (trimmedRuntime && (!validGraphKeys || validGraphKeys.has(trimmedRuntime))) {
    return trimmedRuntime;
  }
  return codeToGraphKey.get(activityCode) || activityCode;
}

export function linkToEdge(
  link: CpmLogicLink,
  cpmResult: CpmResult | null,
  viewMode: LogicNetworkViewMode = 'logic-network',
  codeToGraphKey: Map<string, string> = new Map(),
  validGraphKeys?: Set<string>,
): Edge {
  const label =
    link.lagDays > 0 ? `${link.relationshipType}+${link.lagDays}d` : link.relationshipType;
  const onDisplayCriticalPath =
    viewMode === 'precedence-diagram' &&
    cpmResult != null &&
    isDisplayCritical(cpmResult, link.predecessorActivityCode) &&
    isDisplayCritical(cpmResult, link.successorActivityCode);
  const stroke = onDisplayCriticalPath ? '#ef4444' : '#64748b';
  const predKey = resolveEndpointKey(
    link.predecessorRuntimeId,
    link.predecessorActivityCode,
    codeToGraphKey,
    validGraphKeys,
  );
  const succKey = resolveEndpointKey(
    link.successorRuntimeId,
    link.successorActivityCode,
    codeToGraphKey,
    validGraphKeys,
  );
  return {
    id: buildEdgeId(predKey, succKey),
    source: buildNodeId(predKey),
    target: buildNodeId(succKey),
    label,
    animated: false,
    style: { stroke },
    labelStyle: { fontSize: 10, fill: stroke },
    data: {
      predecessorActivityCode: link.predecessorActivityCode,
      successorActivityCode: link.successorActivityCode,
      relationshipType: link.relationshipType,
      lagDays: link.lagDays,
    },
  };
}

export function mapLogicLinksToEdges(
  links: CpmLogicLink[],
  cpmResult: CpmResult | null,
  viewMode: LogicNetworkViewMode = 'logic-network',
  codeToGraphKey: Map<string, string> = new Map(),
  validGraphKeys?: Set<string>,
): Edge[] {
  return links.map((link) => linkToEdge(link, cpmResult, viewMode, codeToGraphKey, validGraphKeys));
}

export function buildLogicNetworkNodes(
  activities: ScheduleActivity[],
  cpmResult: CpmResult | null,
  layout: LogicNetworkLayout[],
  options: {
    viewMode: LogicNetworkViewMode;
    logicTopology: LogicNetworkTopology;
    showCpmFields: boolean;
    effectiveAnalysis?: EffectiveScheduleAnalysis | null;
    leveledViewActive?: boolean;
  },
): Node<CpmActivityNodeData>[] {
  const {
    viewMode,
    logicTopology,
    showCpmFields,
    effectiveAnalysis = null,
    leveledViewActive = false,
  } = options;
  const layoutByCode = new Map(layout.map((entry) => [entry.activityCode, entry]));
  // CPM results may be keyed by graph key (live preview) or activity code (committed).
  const cpmByKey = new Map(cpmResult?.activities.map((a) => [a.activityCode, a]) ?? []);

  return activities.map((activity, index) => {
    const graphKey = getActivityGraphKey(activity);
    const cpmActivity = cpmByKey.get(graphKey) ?? cpmByKey.get(activity.activityCode);
    // The key that actually matched the CPM result (graph key for live preview, else code).
    const cpmKey = cpmByKey.has(graphKey) ? graphKey : activity.activityCode;
    const position = resolveLogicNetworkNodePosition(
      activity,
      index,
      layoutByCode.get(activity.activityCode),
      showCpmFields ? cpmActivity : undefined,
    );
    // Effective leveled analysis is keyed by activity code (committed CPM).
    const leveled = effectiveAnalysis?.byActivityCode.get(activity.activityCode) ?? null;
    const useLeveledView = leveledViewActive && leveled != null && showCpmFields;
    const baselineCritical =
      showCpmFields && cpmResult != null ? isDisplayCritical(cpmResult, cpmKey) : false;
    return {
      id: buildNodeId(graphKey),
      type: 'cpmActivity',
      position,
      data: {
        activity,
        viewMode,
        cpmResult: cpmActivity,
        showCpmFields,
        predecessorCount: logicTopology.predecessorCountByCode[activity.activityCode] ?? 0,
        successorCount: logicTopology.successorCountByCode[activity.activityCode] ?? 0,
        logicTopologyLabel:
          viewMode === 'logic-network'
            ? resolveLogicTopologyLabel(logicTopology, activity)
            : null,
        isDisplayCritical: useLeveledView
          ? leveled!.controllingAfterLeveling
          : baselineCritical,
        leveledViewActive: useLeveledView,
        leveledOffsetDays: leveled?.leveledOffsetDays ?? 0,
        effectiveTotalFloat: leveled?.effectiveTotalFloat ?? null,
        controllingAfterLeveling: leveled?.controllingAfterLeveling ?? false,
        topologyLabel:
          viewMode === 'precedence-diagram'
            ? resolveTopologyLabel(
                cpmResult,
                cpmKey,
                cpmActivity?.totalFloat === 0,
              )
            : null,
      },
    };
  });
}

export interface LogicNetworkCanvasHandle {
  autoLayout: () => void;
  fitView: () => void;
  collectCurrentLayout: () => LogicNetworkLayout[];
}

interface Props {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  cpmResult: CpmResult | null;
  /** Live CPM preview computed in LogicNetworkWorkspace — shown in Logic Network mode. */
  livePreviewCpm?: CpmResult | null;
  /** Resource-leveled effective schedule analysis (controlling path, offsets). */
  effectiveAnalysis?: EffectiveScheduleAnalysis | null;
  /** When true, color/annotate nodes from the leveled controlling path. */
  leveledViewActive?: boolean;
  layout: LogicNetworkLayout[];
  onLinksChange: (links: CpmLogicLink[]) => void;
  onLayoutChange: (layout: LogicNetworkLayout[]) => void;
  saving?: boolean;
  /** Changes only when project/estimate context changes — resets initial fit once. */
  canvasKey: string;
  /** Changes when scheduled activities change — clears stale auto-layout snapshots. */
  activitySignature?: string;
  logicNetworkInitialized?: boolean;
  viewMode?: LogicNetworkViewMode;
  fullscreen?: boolean;
  chromeless?: boolean;
  viewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  hasFitInitialViewRef?: MutableRefObject<boolean>;
}

function hasCycleWithNewLink(
  existingLinks: CpmLogicLink[],
  newLink: CpmLogicLink,
): boolean {
  const testLinks = [...existingLinks, newLink];
  const result = calculateCpm({
    activities: [
      ...new Set(
        testLinks.flatMap((l) => [l.predecessorActivityCode, l.successorActivityCode]),
      ),
    ].map((code) => ({
      activityCode: code,
      activityDescription: code,
      divisionCode: '00',
      divisionName: '',
      durationDays: 1,
      laborHours: 0,
      manDays: 0,
      crewDays: 0,
      crewSize: 1,
      totalCost: 0,
      relationshipType: 'FS' as const,
      lagDays: 0,
    })),
    logicLinks: testLinks,
  });
  return result.warnings.some((w) => w.includes('Circular'));
}

const CanvasInner = forwardRef<LogicNetworkCanvasHandle, Props>(function CanvasInner(
  {
    activities,
    logicLinks,
    cpmResult,
    livePreviewCpm = null,
    effectiveAnalysis = null,
    leveledViewActive = false,
    layout,
    onLinksChange,
    onLayoutChange,
    saving = false,
    canvasKey,
    activitySignature = '',
    logicNetworkInitialized = false,
    viewMode = 'logic-network',
    fullscreen = false,
    chromeless = false,
    viewport: controlledViewport,
    onViewportChange,
    hasFitInitialViewRef: externalHasFitInitialViewRef,
  },
  ref,
) {
  const isDark = useIsDarkMode();
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CpmActivityNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [internalViewport, setInternalViewport] = useState<Viewport>(INITIAL_LOGIC_NETWORK_VIEWPORT);
  const viewport = controlledViewport ?? internalViewport;
  const setViewport = onViewportChange ?? setInternalViewport;
  const [editingLink, setEditingLink] = useState<{
    link: CpmLogicLink;
    edgeId: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalHasFitInitialViewRef = useRef(false);
  const hasFitInitialViewRef = externalHasFitInitialViewRef ?? internalHasFitInitialViewRef;
  const previousCanvasKeyRef = useRef<string | null>(null);
  const previousActivitySignatureRef = useRef<string | null>(null);
  const autoLayoutSnapshotRef = useRef<LogicNetworkLayout[] | null>(null);
  const persistedAutoLayoutRef = useRef(false);

  useEffect(() => {
    if (previousCanvasKeyRef.current === canvasKey) return;
    previousCanvasKeyRef.current = canvasKey;
    hasFitInitialViewRef.current = false;
    autoLayoutSnapshotRef.current = null;
    persistedAutoLayoutRef.current = false;
    setViewport(INITIAL_LOGIC_NETWORK_VIEWPORT);
  }, [canvasKey]);

  useEffect(() => {
    if (previousActivitySignatureRef.current === activitySignature) return;
    previousActivitySignatureRef.current = activitySignature;
    autoLayoutSnapshotRef.current = null;
    persistedAutoLayoutRef.current = false;
  }, [activitySignature]);

  const effectiveLayout = useMemo(() => {
    if (layout.length > 0) {
      autoLayoutSnapshotRef.current = null;
      return layout;
    }
    if (activities.length === 0) return [];
    if (!autoLayoutSnapshotRef.current) {
      autoLayoutSnapshotRef.current = buildAutoLayoutFromActivities(activities, logicLinks);
    }
    return autoLayoutSnapshotRef.current;
  }, [layout, activities, logicLinks]);

  useEffect(() => {
    if (layout.length > 0) {
      persistedAutoLayoutRef.current = false;
      return;
    }
    const generated = autoLayoutSnapshotRef.current;
    if (!generated || generated.length === 0 || persistedAutoLayoutRef.current) return;
    persistedAutoLayoutRef.current = true;
    onLayoutChange(generated);
  }, [layout, onLayoutChange]);

  const logicTopology = useMemo(
    () => buildLogicNetworkTopology(activities, logicLinks),
    [activities, logicLinks],
  );

  // In Logic Network mode: show CPM fields if a live preview has been calculated.
  // In Precedence Diagram mode: show CPM fields only after Run CPM has been committed.
  const showCpmFields =
    (viewMode === 'logic-network' && livePreviewCpm != null) ||
    (viewMode === 'precedence-diagram' && (cpmResult?.hasRunCpm ?? false));

  // The active CPM dataset: live preview in Logic Network mode, committed in Precedence mode.
  const activeCpmResult =
    viewMode === 'logic-network' && livePreviewCpm != null ? livePreviewCpm : cpmResult;

  const mappedNodes = useMemo(
    () =>
      buildLogicNetworkNodes(activities, activeCpmResult, effectiveLayout, {
        viewMode,
        logicTopology,
        showCpmFields,
        effectiveAnalysis,
        leveledViewActive,
      }),
    [
      activities,
      activeCpmResult,
      effectiveLayout,
      logicTopology,
      showCpmFields,
      viewMode,
      effectiveAnalysis,
      leveledViewActive,
    ],
  );

  const codeToGraphKey = useMemo(() => buildCodeToGraphKey(activities), [activities]);

  const validGraphKeys = useMemo(
    () => new Set(activities.map((activity) => getActivityGraphKey(activity))),
    [activities],
  );

  const sanitizedLogicLinks = useMemo(() => {
    const activityCodes = new Set(activities.map((activity) => activity.activityCode));
    return sanitizeLogicLinksForActivities(logicLinks, activityCodes);
  }, [activities, logicLinks]);

  const mappedEdges = useMemo(
    () =>
      mapLogicLinksToEdges(
        sanitizedLogicLinks,
        activeCpmResult,
        viewMode,
        codeToGraphKey,
        validGraphKeys,
      ),
    [activeCpmResult, sanitizedLogicLinks, viewMode, codeToGraphKey, validGraphKeys],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.info('[Logic Network]', {
      activityCount: activities.length,
      linkCount: logicLinks.length,
      sanitizedLinkCount: sanitizedLogicLinks.length,
      edgeCount: mappedEdges.length,
      initialized: logicNetworkInitialized,
      viewMode,
      hasRunCpm: activeCpmResult?.hasRunCpm ?? false,
      hasValidCriticalPath: activeCpmResult?.hasValidCriticalPath ?? false,
      criticalPathStatus: activeCpmResult?.criticalPathStatus ?? 'unknown',
    });
  }, [
    activities.length,
    activeCpmResult?.criticalPathStatus,
    activeCpmResult?.hasValidCriticalPath,
    logicLinks.length,
    logicNetworkInitialized,
    mappedEdges.length,
    sanitizedLogicLinks.length,
    viewMode,
    activeCpmResult?.hasRunCpm,
  ]);

  useEffect(() => {
    setNodes(mappedNodes);
  }, [mappedNodes, setNodes]);

  useEffect(() => {
    setEdges(mappedEdges);
  }, [mappedEdges, setEdges]);

  useEffect(() => {
    if (!shouldAutoFitOnInitialLoad(hasFitInitialViewRef.current, nodes.length)) return;
    hasFitInitialViewRef.current = true;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 200 });
    });
    return () => cancelAnimationFrame(frame);
  }, [nodes.length, fitView]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const positionChanges = changes.filter(
        (c): c is NodeChange & { type: 'position'; position?: { x: number; y: number } } =>
          c.type === 'position' && (c as { dragging?: boolean }).dragging === false,
      );
      if (positionChanges.length === 0) return;

      if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
      layoutDebounceRef.current = setTimeout(() => {
        setNodes((currentNodes) => {
          const newLayout: LogicNetworkLayout[] = currentNodes.map((n) => ({
            activityCode: n.data.activity.activityCode,
            x: n.position.x,
            y: n.position.y,
          }));
          onLayoutChange(newLayout);
          return currentNodes;
        });
      }, 500);
    },
    [onNodesChange, setNodes, onLayoutChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const handleAutoLayout = useCallback(() => {
    const { layout: autoLayout, warning } = autoLayoutLogicNetwork({
      activities,
      logicLinks,
    });
    autoLayoutSnapshotRef.current = autoLayout;
    setNodes(
      buildLogicNetworkNodes(activities, activeCpmResult, autoLayout, {
        viewMode,
        logicTopology,
        showCpmFields,
        effectiveAnalysis,
        leveledViewActive,
      }),
    );
    onLayoutChange(autoLayout);
    showToast(warning ?? 'Layout updated');
    requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 300 });
    });
  }, [
    activities,
    activeCpmResult,
    logicLinks,
    logicTopology,
    onLayoutChange,
    setNodes,
    showCpmFields,
    showToast,
    viewMode,
    fitView,
    effectiveAnalysis,
    leveledViewActive,
  ]);

  const handleFitView = useCallback(() => {
    void fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const collectCurrentLayout = useCallback((): LogicNetworkLayout[] => {
    if (layoutDebounceRef.current) {
      clearTimeout(layoutDebounceRef.current);
      layoutDebounceRef.current = null;
    }
    return nodes.map((n) => ({
      activityCode: n.data.activity.activityCode,
      x: n.position.x,
      y: n.position.y,
    }));
  }, [nodes]);

  useImperativeHandle(
    ref,
    () => ({
      autoLayout: handleAutoLayout,
      fitView: handleFitView,
      collectCurrentLayout,
    }),
    [handleAutoLayout, handleFitView, collectCurrentLayout],
  );

  const activityByGraphKey = useMemo(() => {
    const map = new Map<string, ScheduleActivity>();
    for (const activity of activities) {
      map.set(getActivityGraphKey(activity), activity);
    }
    return map;
  }, [activities]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;

      const predKey = source.replace('node-', '');
      const succKey = target.replace('node-', '');

      if (predKey === succKey) {
        showToast('An activity cannot depend on itself.');
        return;
      }

      const predActivity = activityByGraphKey.get(predKey);
      const succActivity = activityByGraphKey.get(succKey);
      const predCode = predActivity?.activityCode ?? predKey;
      const succCode = succActivity?.activityCode ?? succKey;
      const predRuntimeId = predActivity?.runtimeActivityId;
      const succRuntimeId = succActivity?.runtimeActivityId;

      const alreadyExists = logicLinks.some((l) => {
        const lPred = resolveEndpointKey(
          l.predecessorRuntimeId,
          l.predecessorActivityCode,
          codeToGraphKey,
          validGraphKeys,
        );
        const lSucc = resolveEndpointKey(
          l.successorRuntimeId,
          l.successorActivityCode,
          codeToGraphKey,
          validGraphKeys,
        );
        return lPred === predKey && lSucc === succKey;
      });
      if (alreadyExists) {
        showToast('This logic link already exists.');
        return;
      }

      const newLink: CpmLogicLink = {
        predecessorActivityCode: predCode,
        successorActivityCode: succCode,
        predecessorRuntimeId: predRuntimeId,
        successorRuntimeId: succRuntimeId,
        relationshipType: 'FS',
        lagDays: 0,
      };

      if (hasCycleWithNewLink(logicLinks, newLink)) {
        showToast('Adding this link would create a circular dependency.');
        return;
      }

      onLinksChange([...logicLinks, newLink]);
    },
    [activityByGraphKey, codeToGraphKey, logicLinks, onLinksChange, showToast, validGraphKeys],
  );

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    const linkData = edge.data as {
      predecessorActivityCode: string;
      successorActivityCode: string;
      relationshipType: string;
      lagDays: number;
    };
    if (!linkData?.predecessorActivityCode) return;
    setEditingLink({
      link: {
        predecessorActivityCode: linkData.predecessorActivityCode,
        successorActivityCode: linkData.successorActivityCode,
        relationshipType: linkData.relationshipType as CpmLogicLink['relationshipType'],
        lagDays: linkData.lagDays,
      },
      edgeId: edge.id,
    });
  }, []);

  const handleLinkSave = useCallback(
    (updated: CpmLogicLink) => {
      const updatedLinks = logicLinks.map((l) =>
        l.predecessorActivityCode === updated.predecessorActivityCode &&
        l.successorActivityCode === updated.successorActivityCode
          ? updated
          : l,
      );
      onLinksChange(updatedLinks);
      setEditingLink(null);
    },
    [logicLinks, onLinksChange],
  );

  const handleLinkDelete = useCallback(() => {
    if (!editingLink) return;
    const { link } = editingLink;
    const updatedLinks = logicLinks.filter(
      (l) =>
        !(
          l.predecessorActivityCode === link.predecessorActivityCode &&
          l.successorActivityCode === link.successorActivityCode
        ),
    );
    onLinksChange(updatedLinks);
    setEditingLink(null);
  }, [editingLink, logicLinks, onLinksChange]);

  const hasWarnings = activities.some((a) => a.durationDays < 1 || a.crewSize < 1);

  const canvasSurfaceClass =
    'relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100';

  const canvasWrapperClass = fullscreen
    ? `${canvasSurfaceClass} ${LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS}`
    : `${canvasSurfaceClass} rounded-xl border border-slate-300 dark:border-slate-700 ${LOGIC_NETWORK_CANVAS_HEIGHT_CLASS}`;

  if (activities.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-slate-600 dark:text-slate-400 ${
          fullscreen
            ? LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS
            : `rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 ${LOGIC_NETWORK_CANVAS_HEIGHT_CLASS}`
        }`}
      >
        No schedule-enabled activities yet.
      </div>
    );
  }

  const canvasBody = (
    <div className={canvasWrapperClass} data-logic-network-canvas-wrapper>
        {hasWarnings && (
          <div className="absolute left-0 right-0 top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Some activities are missing crew size or duration. Check line items for completeness.
          </div>
        )}

        {toast && (
          <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded bg-red-600 px-4 py-2 text-xs font-medium text-white shadow">
            {toast}
          </div>
        )}

        {saving && (
          <div className="absolute bottom-4 right-4 z-20 rounded bg-slate-700 px-3 py-1.5 text-xs text-white shadow">
            Saving…
          </div>
        )}

        {editingLink && (
          <div className="absolute left-4 top-16 z-20">
            <LogicLinkEditorPanel
              link={editingLink.link}
              onSave={handleLinkSave}
              onDelete={handleLinkDelete}
              onClose={() => setEditingLink(null)}
            />
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          viewport={viewport}
          onViewportChange={setViewport}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          className="h-full w-full"
          minZoom={0.2}
          maxZoom={2}
        >
          <Background gap={20} size={1} color={isDark ? '#1e293b' : '#cbd5e1'} />
          <Controls className="logic-network-controls" position="bottom-left" />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            bgColor={isDark ? '#020817' : '#f8fafc'}
            nodeColor={isDark ? '#475569' : '#94a3b8'}
            nodeStrokeColor={isDark ? '#64748b' : '#64748b'}
            maskColor={isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(15, 23, 42, 0.08)'}
            style={{
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: isDark ? '#334155' : '#cbd5e1',
            }}
          />
        </ReactFlow>
    </div>
  );

  if (chromeless) {
    return canvasBody;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {activities.length} activities · drag blocks to reposition · connect handles to wire logic
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={handleAutoLayout}
          >
            Auto layout
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={handleFitView}
          >
            Fit view
          </button>
        </div>
      </div>
      {canvasBody}
    </div>
  );
});

const EstimateLogicNetworkCanvas = forwardRef<LogicNetworkCanvasHandle, Props>(
  function EstimateLogicNetworkCanvas(props, ref) {
    return (
      <ReactFlowProvider key={props.canvasKey}>
        <CanvasInner {...props} ref={ref} />
      </ReactFlowProvider>
    );
  },
);

export default EstimateLogicNetworkCanvas;
