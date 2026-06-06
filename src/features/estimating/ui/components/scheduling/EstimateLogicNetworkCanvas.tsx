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
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
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
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type {
  CpmLogicLink,
  CpmResult,
  LogicNetworkLayout,
} from '../../../scheduling/cpmTypes';
import { LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS } from '../../../scheduling/logicNetworkFullscreen';
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

const NODE_TYPES = { cpmActivity: CpmActivityNode };

function buildNodeId(activityCode: string): string {
  return `node-${activityCode}`;
}

function buildEdgeId(pred: string, succ: string): string {
  return `edge-${pred}-${succ}`;
}

function linkToEdge(link: CpmLogicLink): Edge {
  const label =
    link.lagDays > 0 ? `${link.relationshipType}+${link.lagDays}d` : link.relationshipType;
  return {
    id: buildEdgeId(link.predecessorActivityCode, link.successorActivityCode),
    source: buildNodeId(link.predecessorActivityCode),
    target: buildNodeId(link.successorActivityCode),
    label,
    animated: false,
    style: { stroke: '#64748b' },
    labelStyle: { fontSize: 10, fill: '#64748b' },
    data: {
      predecessorActivityCode: link.predecessorActivityCode,
      successorActivityCode: link.successorActivityCode,
      relationshipType: link.relationshipType,
      lagDays: link.lagDays,
    },
  };
}

export function buildLogicNetworkNodes(
  activities: ScheduleActivity[],
  cpmResult: CpmResult | null,
  layout: LogicNetworkLayout[],
): Node<CpmActivityNodeData>[] {
  const layoutByCode = new Map(layout.map((entry) => [entry.activityCode, entry]));
  const cpmByCode = new Map(cpmResult?.activities.map((a) => [a.activityCode, a]) ?? []);

  return activities.map((activity, index) => {
    const position = resolveLogicNetworkNodePosition(
      activity,
      index,
      layoutByCode.get(activity.activityCode),
      cpmByCode.get(activity.activityCode),
    );
    return {
      id: buildNodeId(activity.activityCode),
      type: 'cpmActivity',
      position,
      data: {
        activity,
        cpmResult: cpmByCode.get(activity.activityCode),
      },
    };
  });
}

export interface LogicNetworkCanvasHandle {
  autoLayout: () => void;
  fitView: () => void;
  saveLayout: () => void;
}

interface Props {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  cpmResult: CpmResult | null;
  layout: LogicNetworkLayout[];
  onLinksChange: (links: CpmLogicLink[]) => void;
  onLayoutChange: (layout: LogicNetworkLayout[]) => void;
  saving?: boolean;
  /** Changes only when project/estimate context changes — resets initial fit once. */
  canvasKey: string;
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
    layout,
    onLinksChange,
    onLayoutChange,
    saving = false,
    canvasKey,
    fullscreen = false,
    chromeless = false,
    viewport: controlledViewport,
    onViewportChange,
    hasFitInitialViewRef: externalHasFitInitialViewRef,
  },
  ref,
) {
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

  const effectiveLayout = useMemo(() => {
    if (layout.length > 0) {
      autoLayoutSnapshotRef.current = null;
      return layout;
    }
    if (activities.length === 0) return [];
    if (!autoLayoutSnapshotRef.current) {
      autoLayoutSnapshotRef.current = buildAutoLayoutFromActivities(activities, cpmResult);
    }
    return autoLayoutSnapshotRef.current;
  }, [layout, activities, cpmResult]);

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

  const mappedNodes = useMemo(
    () => buildLogicNetworkNodes(activities, cpmResult, effectiveLayout),
    [activities, cpmResult, effectiveLayout],
  );

  const mappedEdges = useMemo(() => logicLinks.map(linkToEdge), [logicLinks]);

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
    const autoLayout = buildAutoLayoutFromActivities(activities, cpmResult);
    autoLayoutSnapshotRef.current = autoLayout;
    setNodes(buildLogicNetworkNodes(activities, cpmResult, autoLayout));
    onLayoutChange(autoLayout);
    requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 300 });
    });
  }, [activities, cpmResult, onLayoutChange, setNodes, fitView]);

  const handleFitView = useCallback(() => {
    void fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const handleSaveLayout = useCallback(() => {
    if (layoutDebounceRef.current) {
      clearTimeout(layoutDebounceRef.current);
      layoutDebounceRef.current = null;
    }
    setNodes((currentNodes) => {
      const newLayout: LogicNetworkLayout[] = currentNodes.map((n) => ({
        activityCode: n.data.activity.activityCode,
        x: n.position.x,
        y: n.position.y,
      }));
      onLayoutChange(newLayout);
      return currentNodes;
    });
  }, [onLayoutChange, setNodes]);

  useImperativeHandle(
    ref,
    () => ({
      autoLayout: handleAutoLayout,
      fitView: handleFitView,
      saveLayout: handleSaveLayout,
    }),
    [handleAutoLayout, handleFitView, handleSaveLayout],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;

      const predCode = source.replace('node-', '');
      const succCode = target.replace('node-', '');

      if (predCode === succCode) {
        showToast('An activity cannot depend on itself.');
        return;
      }

      const alreadyExists = logicLinks.some(
        (l) =>
          l.predecessorActivityCode === predCode && l.successorActivityCode === succCode,
      );
      if (alreadyExists) {
        showToast('This logic link already exists.');
        return;
      }

      const newLink: CpmLogicLink = {
        predecessorActivityCode: predCode,
        successorActivityCode: succCode,
        relationshipType: 'FS',
        lagDays: 0,
      };

      if (hasCycleWithNewLink(logicLinks, newLink)) {
        showToast('Adding this link would create a circular dependency.');
        return;
      }

      const updatedLinks = [...logicLinks, newLink];
      onLinksChange(updatedLinks);
      setEdges((currentEdges) => addEdge(linkToEdge(newLink), currentEdges));
    },
    [logicLinks, onLinksChange, setEdges, showToast],
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
    setEdges((currentEdges) => currentEdges.filter((e) => e.id !== editingLink.edgeId));
    setEditingLink(null);
  }, [editingLink, logicLinks, onLinksChange, setEdges]);

  const hasWarnings = activities.some((a) => a.durationDays < 1 || a.crewSize < 1);

  const canvasWrapperClass = fullscreen
    ? `relative overflow-hidden bg-slate-900 ${LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS}`
    : `relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 ${LOGIC_NETWORK_CANVAS_HEIGHT_CLASS}`;

  if (activities.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 ${
          fullscreen
            ? LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS
            : `rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 ${LOGIC_NETWORK_CANVAS_HEIGHT_CLASS}`
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
          <Background gap={16} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
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
