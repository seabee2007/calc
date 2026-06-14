import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { useProjectTabCounts, type ProjectTabCounts } from '../../hooks/useProjectTabCounts';
import { exportPlannerBoardJson, exportPlannerTasksCsv } from '../../utils/plannerExport';
import { formatTabLabel } from '../../utils/formatTabLabel';
import { DEFAULT_PROFILE_DISPLAY_NAME } from '../../services/profileService';
import UserAvatar from './UserAvatar';
import Button from '../ui/Button';
import { isPlannerNavTabActive } from '../../utils/plannerRoutes';
import { PLANNER_NAV_TAB_LABEL, PLANNER_NAV_TAB_LABEL_ACTIVE } from './plannerTheme';
import { useEstimateWorkspaceHeaderOverlay } from '../../features/estimating/ui/hooks/useEstimateWorkspaceHeaderOverlay';

type TabCountKey = keyof ProjectTabCounts;

const PLAN_ACTIONS_MENU_WIDTH_PX = 176;
const PLAN_ACTIONS_MENU_MARGIN_PX = 8;

const TABS: { to: string; label: string; countKey?: TabCountKey }[] = [
  { to: 'estimate', label: 'Estimate' },
  { to: 'board', label: 'Board', countKey: 'board' },
  { to: 'charts', label: 'Charts' },
  { to: 'schedule', label: 'Schedule', countKey: 'schedule' },
  { to: 'documents', label: 'Documents', countKey: 'documents' },
  { to: 'rfis', label: 'RFIs', countKey: 'rfis' },
  { to: 'adjustments', label: 'FARs', countKey: 'fars' },
  { to: 'change-orders', label: 'Change orders', countKey: 'changeOrders' },
  { to: 'team', label: 'Team', countKey: 'team' },
];

function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function PlannerPlanHeader() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, bundle, team, isOwner } = usePlannerProject();
  const tabCounts = useProjectTabCounts(projectId, user?.id, bundle);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEstimateWorkspaceHeaderOverlay('planner-plan-actions-menu', menuOpen);

  const updateMenuPosition = () => {
    const anchor = menuWrapRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    let left = rect.right - PLAN_ACTIONS_MENU_WIDTH_PX;
    left = Math.max(
      PLAN_ACTIONS_MENU_MARGIN_PX,
      Math.min(left, window.innerWidth - PLAN_ACTIONS_MENU_WIDTH_PX - PLAN_ACTIONS_MENU_MARGIN_PX),
    );
    let top = rect.bottom + PLAN_ACTIONS_MENU_MARGIN_PX;
    const menuHeight = menuRef.current?.offsetHeight ?? 88;
    if (top + menuHeight > window.innerHeight - PLAN_ACTIONS_MENU_MARGIN_PX) {
      top = Math.max(PLAN_ACTIONS_MENU_MARGIN_PX, rect.top - menuHeight - PLAN_ACTIONS_MENU_MARGIN_PX);
    }
    setMenuPos({ top, left });
  };

  useEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
    const onLayout = () => updateMenuPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuWrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (!project || !projectId) return null;

  const base = `/projects/${projectId}/planner`;
  const visibleTeam = team.slice(0, 4);

  const planActionsMenu =
    menuOpen && bundle ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        data-testid="planner-plan-actions-menu"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: PLAN_ACTIONS_MENU_WIDTH_PX,
        }}
        className="fixed z-[1000] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        <button
          role="menuitem"
          type="button"
          data-testid="planner-plan-actions-export-csv"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
          onClick={() => {
            exportPlannerTasksCsv(bundle, project.name);
            setMenuOpen(false);
          }}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        <button
          role="menuitem"
          type="button"
          data-testid="planner-plan-actions-export-json"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
          onClick={() => {
            exportPlannerBoardJson(bundle, project.name);
            setMenuOpen(false);
          }}
        >
          <Download className="h-4 w-4" />
          Export JSON
        </button>
      </div>
    ) : null;

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-cyan-700 text-sm font-bold text-white"
            aria-hidden
          >
            {projectInitials(project.name)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
              {project.name}
            </h1>
            <p className="truncate text-xs text-gray-500 dark:text-slate-400">
              {project.statusLabel} · {project.locationLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex -space-x-2">
            {visibleTeam.map((m) => (
              <UserAvatar
                key={m.id}
                name={m.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME}
                size="md"
                className="ring-2 ring-white dark:ring-slate-900"
              />
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate(`${base}/team`)}>
            Members
          </Button>
          {isOwner && bundle && (
            <div className="relative shrink-0" ref={menuWrapRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                data-testid="planner-plan-actions-trigger"
              >
                <MoreHorizontal className="h-4 w-4 text-gray-600 dark:text-slate-300" />
              </button>
              {typeof document !== 'undefined'
                ? createPortal(planActionsMenu, document.body)
                : planActionsMenu}
            </div>
          )}
        </div>
      </div>

      <nav
        className="flex gap-0 overflow-x-auto border-t border-slate-100 px-2 dark:border-slate-800 sm:px-4"
        aria-label="Plan views"
      >
        {TABS.map(({ to, label, countKey }) => {
          const tabPath = `${base}/${to}`;
          const isActive = isPlannerNavTabActive(location.pathname, tabPath);
          return (
            <Link
              key={to}
              to={tabPath}
              className={[
                'shrink-0 border-b-2 px-4 py-2.5 transition-colors',
                isActive
                  ? `border-cyan-600 dark:border-cyan-400 ${PLANNER_NAV_TAB_LABEL_ACTIVE}`
                  : `border-transparent hover:text-gray-900 dark:hover:text-slate-200 ${PLANNER_NAV_TAB_LABEL}`,
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              {formatTabLabel(label, countKey ? tabCounts[countKey] : undefined)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
