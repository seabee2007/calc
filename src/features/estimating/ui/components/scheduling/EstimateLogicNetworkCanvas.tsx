import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type {
  CpmLogicLink,
  CpmResult,
  LogicNetworkLayout,
} from '../../../scheduling/cpmTypes';
import { CpmActivityNode, type CpmActivityNodeData } from './CpmActivityNode';
import LogicLinkEditorPanel from './LogicLinkEditorPanel';
import { calculateCpm } from '../../../scheduling/cpm/calculateCpm';

const NODE_TYPES = { cpmActivity: CpmActivityNode };

const DEFAULT_NODE_X_SPACING = 240;
const DEFAULT_NODE_Y_GAP = 140;

function buildNodeId(activityCode: string): string {
  return `node-${activityCode}`;
}

function buildEdgeId(pred: string, succ: string): string {
  return `edge-${pred}-${succ}`;
}

function linkToEdge(link: CpmLogicLink): Edge {
  const label = link.lagDays > 0 ? `${link.relationshipType}+${link.lagDays}d` : link.relationshipType;
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

function activitiesToNodes(
  activities: ScheduleActivity[],
  cpmResult: CpmResult | null,
  layout: LogicNetworkLayout[],
): Node<CpmActivityNodeData>[] {
  const layoutByCode = new Map(layout.map((l) => [l.activityCode, l]));
  const cpmByCode = new Map(cpmResult?.activities.map((a) => [a.activityCode, a]) ?? []);

  return activities.map((activity, index) => {
    const pos = layoutByCode.get(activity.activityCode);
    const col = index % 4;
    const row = Math.floor(index / 4);
    return {
      id: buildNodeId(activity.activityCode),
      type: 'cpmActivity',
      position: pos
        ? { x: pos.x, y: pos.y }
        : { x: col * DEFAULT_NODE_X_SPACING, y: row * DEFAULT_NODE_Y_GAP },
      data: {
        activity,
        cpmResult: cpmByCode.get(activity.activityCode),
      },
    };
  });
}

interface Props {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  cpmResult: CpmResult | null;
  layout: LogicNetworkLayout[];
  onLinksChange: (links: CpmLogicLink[]) => void;
  onLayoutChange: (layout: LogicNetworkLayout[]) => void;
  saving?: boolean;
}

function hasCycleWithNewLink(
  existingLinks: CpmLogicLink[],
  newLink: CpmLogicLink,
): boolean {
  const testLinks = [...existingLinks, newLink];
  const result = calculateCpm({
    activities: [
      ...new Set(testLinks.flatMap((l) => [
        l.predecessorActivityCode,
        l.successorActivityCode,
      ])),
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

function CanvasInner({
  activities,
  logicLinks,
  cpmResult,
  layout,
  onLinksChange,
  onLayoutChange,
  saving = false,
}: Props) {
  const initialNodes = useMemo(
    () => activitiesToNodes(activities, cpmResult, layout),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities.length],
  );
  const initialEdges = useMemo(() => logicLinks.map(linkToEdge), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CpmActivityNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [editingLink, setEditingLink] = useState<{
    link: CpmLogicLink;
    edgeId: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync CPM values into node data when cpmResult changes
  useEffect(() => {
    const cpmByCode = new Map(cpmResult?.activities.map((a) => [a.activityCode, a]) ?? []);
    setNodes((prev) =>
      prev.map((node) => {
        const code = node.data.activity.activityCode;
        return { ...node, data: { ...node.data, cpmResult: cpmByCode.get(code) } };
      }),
    );
  }, [cpmResult, setNodes]);

  // Sync new logic links when parent changes them externally
  useEffect(() => {
    setEdges(logicLinks.map(linkToEdge));
  }, [logicLinks, setEdges]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // Capture position changes and debounce-save layout
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

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
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
    },
    [],
  );

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

  const hasWarnings = activities.some(
    (a) => a.durationDays < 1 || a.crewSize < 1,
  );

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
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
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
}

export default function EstimateLogicNetworkCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
