import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import type { PlannerTask } from '../../types/fieldPlanner';
import { updateTask } from '../../services/plannerService';
import type { TaskStatus } from '../../types/fieldPlanner';

interface TaskCardMenuProps {
  task: PlannerTask;
  isOwner: boolean;
  buckets: { id: string; title: string }[];
  onOpen: () => void;
  onRefresh: () => void;
  onCreateRfi: () => void;
  onCreateAdjustment: () => void;
}

const MENU_WIDTH = 208;
const MENU_MARGIN = 8;
const MENU_ITEM_HEIGHT = 36;

export default function TaskCardMenu({
  task,
  isOwner,
  buckets,
  onOpen,
  onRefresh,
  onCreateRfi,
  onCreateAdjustment,
}: TaskCardMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const actionCount = useMemo(() => {
    const moveCount = isOwner ? buckets.filter((b) => b.id !== task.bucketId).length : 0;
    return 1 + (task.status !== 'Completed' ? 1 : 0) + moveCount + 2;
  }, [buckets, isOwner, task.bucketId, task.status]);

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const estimatedHeight = Math.min(actionCount * MENU_ITEM_HEIGHT + 8, 320);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_MARGIN;
    const opensUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    const top = opensUp
      ? Math.max(MENU_MARGIN, rect.top - estimatedHeight - MENU_MARGIN)
      : Math.min(rect.bottom + MENU_MARGIN, window.innerHeight - MENU_MARGIN);
    const left = Math.min(
      Math.max(MENU_MARGIN, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - MENU_MARGIN,
    );

    setPosition({ top, left });
  };

  const openMenu = () => {
    window.dispatchEvent(new CustomEvent('planner-task-menu-open', { detail: task.id }));
    updatePosition();
    setOpen(true);
  };

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    const handleOtherMenuOpen = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== task.id) closeMenu();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('planner-task-menu-open', handleOtherMenuOpen);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('planner-task-menu-open', handleOtherMenuOpen);
    };
  }, [open, task.id, actionCount]);

  const markComplete = async () => {
    await updateTask(task.id, { status: 'Completed' as TaskStatus });
    onRefresh();
    closeMenu();
  };

  const moveToBucket = async (bucketId: string) => {
    await updateTask(task.id, { bucketId });
    onRefresh();
    closeMenu();
  };

  const menu =
    open && position
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] max-h-[min(20rem,calc(100dvh-1rem))] w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            style={{ top: position.top, left: position.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                closeMenu();
                onOpen();
              }}
            >
              Open
            </button>
            {task.status !== 'Completed' && (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => void markComplete()}
              >
                Mark complete
              </button>
            )}
            {isOwner &&
              buckets
                .filter((b) => b.id !== task.bucketId)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => void moveToBucket(b.id)}
                  >
                    Move to {b.title}
                  </button>
                ))}
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                closeMenu();
                onCreateRfi();
              }}
            >
              Create RFI
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                closeMenu();
                onCreateAdjustment();
              }}
            >
              Create FAR
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="absolute right-1 top-1 z-10">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) closeMenu();
          else openMenu();
        }}
        className={`rounded p-1 transition hover:bg-slate-100 dark:hover:bg-slate-700 ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label="Task menu"
        aria-expanded={open}
        aria-haspopup="menu"
        data-menu-open={open}
      >
        <MoreHorizontal className="h-4 w-4 text-gray-500" />
      </button>
      {menu}
    </div>
  );
}
