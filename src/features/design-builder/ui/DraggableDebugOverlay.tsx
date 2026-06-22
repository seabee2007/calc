import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  DEBUG_OVERLAY_STORAGE_PREFIX,
  type DebugOverlayPosition,
} from './debugOverlayLayout';
import { debugOverlayInitialStyle, useDebugOverlayLayout } from './DebugOverlayLayoutContext';

type StoredPosition = DebugOverlayPosition;

function readStoredPosition(id: string): StoredPosition | null {
  try {
    const raw = sessionStorage.getItem(`${DEBUG_OVERLAY_STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPosition;
    if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

function writeStoredPosition(id: string, position: StoredPosition): void {
  try {
    sessionStorage.setItem(`${DEBUG_OVERLAY_STORAGE_PREFIX}${id}`, JSON.stringify(position));
  } catch {
    // ignore quota errors
  }
}

export function DraggableDebugOverlay(props: {
  id: string;
  title: string;
  titleClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const { id, title, titleClassName = 'text-slate-300', className = '', children } = props;
  const layout = useDebugOverlayLayout();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const [userPosition, setUserPosition] = useState<StoredPosition | null>(() => readStoredPosition(id));
  const [zIndex, setZIndex] = useState(10);

  useEffect(() => {
    if (!layout) return undefined;
    return layout.registerOverlay({ id, ref: panelRef });
  }, [id, layout]);

  const layoutPosition = layout?.getLayoutPosition(id) ?? null;
  const resolvedPosition = userPosition ?? layoutPosition;

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setUserPosition((current) => {
        if (current) writeStoredPosition(id, current);
        return current;
      });
      setZIndex(10);
    },
    [id],
  );

  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!resolvedPosition) return;
    if (!userPosition) {
      setUserPosition(resolvedPosition);
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: resolvedPosition.left,
      originTop: resolvedPosition.top,
    };
    setZIndex(50);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHeaderPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setUserPosition({
      left: drag.originLeft + (event.clientX - drag.startX),
      top: drag.originTop + (event.clientY - drag.startY),
    });
  };

  const initial = debugOverlayInitialStyle();
  const style: CSSProperties = resolvedPosition
    ? { left: resolvedPosition.left, top: resolvedPosition.top, zIndex, opacity: 1 }
    : { left: initial.left, top: initial.top, zIndex, opacity: initial.opacity, pointerEvents: 'none' };

  return (
    <div
      ref={panelRef}
      className={`absolute max-w-xs space-y-1 rounded-xl border bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-lg ${className}`}
      style={style}
    >
      <div
        className="-mx-1 flex cursor-grab items-center gap-2 rounded px-1 pb-1 active:cursor-grabbing select-none"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        title="Drag to reposition"
      >
        <span className="text-[10px] leading-none text-slate-500" aria-hidden>
          ⋮⋮
        </span>
        <div className={`flex-1 font-semibold uppercase tracking-wide ${titleClassName}`}>{title}</div>
      </div>
      {children}
    </div>
  );
}
