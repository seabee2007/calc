import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  HelpCircle,
  Moon,
  Share2,
  Sun,
  User,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToolsModalStore } from '../../store/toolsModalStore';
import { useDefinitionsHelpStore } from '../../features/help/definitionsHelpStore';
import { useThemeStore } from '../../store/themeStore';
import {
  persistExpandedSettingsSections,
  type SettingsSectionId,
} from '../settings/SettingsCollapsibleSection';

const menuItemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800';

const menuDividerClass = 'my-1 border-t border-slate-700';

interface AppProfileMenuProps {
  onClose: () => void;
  showThemeToggle?: boolean;
  showShareInvite?: boolean;
  onShareInvite?: () => void;
  showSurvey?: boolean;
  onSurvey?: () => void;
}

function navigateToSettingsSection(
  navigate: ReturnType<typeof useNavigate>,
  section: SettingsSectionId,
  onClose: () => void,
) {
  persistExpandedSettingsSections(new Set([section]));
  onClose();
  navigate('/settings');
}

export default function AppProfileMenu({
  onClose,
  showThemeToggle = true,
  showShareInvite = false,
  onShareInvite,
  showSurvey = false,
  onSurvey,
}: AppProfileMenuProps) {
  const navigate = useNavigate();
  const { user, profile, signOut, isOwner, isEmployee } = useAuth();
  const openTools = useToolsModalStore((s) => s.open);
  const openHelp = useDefinitionsHelpStore((s) => s.open);
  const { isDark, toggleTheme } = useThemeStore();

  const handleSignOut = () => {
    onClose();
    void signOut().then(() => navigate('/login'));
  };

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
      <p className="truncate px-3 py-2 text-xs text-slate-400">
        {profile?.displayName ?? user?.email}
      </p>

      <button
        type="button"
        className={menuItemClass}
        onClick={() => navigateToSettingsSection(navigate, 'company', onClose)}
      >
        <Building2 className="h-4 w-4 text-cyan-400" aria-hidden />
        Company settings
      </button>
      <button
        type="button"
        className={menuItemClass}
        onClick={() => navigateToSettingsSection(navigate, 'preferences', onClose)}
      >
        <User className="h-4 w-4 text-cyan-400" aria-hidden />
        User preferences
      </button>

      <div className={menuDividerClass} />

      {isOwner && (
        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            onClose();
            openTools();
          }}
        >
          <Wrench className="h-4 w-4 text-cyan-400" aria-hidden />
          Tools
        </button>
      )}

      <button
        type="button"
        className={menuItemClass}
        onClick={() => {
          onClose();
          openHelp();
        }}
      >
        <HelpCircle className="h-4 w-4 text-cyan-400" aria-hidden />
        Help
      </button>

      {showThemeToggle ? (
        <button
          type="button"
          className={menuItemClass}
          onClick={toggleTheme}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-cyan-400" aria-hidden />
          ) : (
            <Moon className="h-4 w-4 text-cyan-400" aria-hidden />
          )}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
      ) : null}

      <div className={menuDividerClass} />

      {isEmployee && !isOwner && (
        <Link
          to="/employee/dashboard"
          className={menuItemClass}
          onClick={onClose}
        >
          Employee portal
        </Link>
      )}
      {isOwner && (
        <Link
          to="/employees"
          className={menuItemClass}
          onClick={onClose}
        >
          Team & employees
        </Link>
      )}
      {showShareInvite && onShareInvite ? (
        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            onClose();
            onShareInvite();
          }}
        >
          <Share2 className="h-4 w-4 text-cyan-400" aria-hidden />
          Share / Invite Client
        </button>
      ) : null}

      {showSurvey && onSurvey ? (
        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            onClose();
            onSurvey();
          }}
        >
          <ClipboardList className="h-4 w-4 text-cyan-400" aria-hidden />
          Survey
        </button>
      ) : null}

      <div className={menuDividerClass} />

      <button type="button" className={menuItemClass} onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
}
