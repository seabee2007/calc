import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  Moon,
  Share2,
  Sun,
  User,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDefinitionsHelpStore } from '../../features/help/definitionsHelpStore';
import { useThemeStore } from '../../store/themeStore';
import { isFieldOnlyRole } from '../../types/fieldPlanner';
import ProfileMenuUserHeader from './ProfileMenuUserHeader';
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

interface MenuBodyProps {
  onClose: () => void;
  showThemeToggle: boolean;
  showShareInvite: boolean;
  onShareInvite?: () => void;
  showSurvey: boolean;
  onSurvey?: () => void;
}

function FieldUserProfileMenu({
  onClose,
  showThemeToggle,
}: Pick<MenuBodyProps, 'onClose' | 'showThemeToggle'>) {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const openHelp = useDefinitionsHelpStore((s) => s.open);
  const { isDark, toggleTheme } = useThemeStore();

  const handleSignOut = () => {
    onClose();
    void signOut().then(() => navigate('/login'));
  };

  return (
    <>
      <ProfileMenuUserHeader user={user} profile={profile} />

      <Link to="/employee/profile" className={menuItemClass} onClick={onClose}>
        <User className="h-4 w-4 text-cyan-400" aria-hidden />
        Profile
      </Link>

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
        <button type="button" className={menuItemClass} onClick={toggleTheme}>
          {isDark ? (
            <Sun className="h-4 w-4 text-cyan-400" aria-hidden />
          ) : (
            <Moon className="h-4 w-4 text-cyan-400" aria-hidden />
          )}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
      ) : null}

      <div className={menuDividerClass} />

      <Link to="/employee/dashboard" className={menuItemClass} onClick={onClose}>
        <LayoutDashboard className="h-4 w-4 text-cyan-400" aria-hidden />
        Field portal
      </Link>

      <div className={menuDividerClass} />

      <button type="button" className={menuItemClass} onClick={handleSignOut}>
        Sign out
      </button>
    </>
  );
}

function AdminUserProfileMenu({
  onClose,
  showThemeToggle,
  showShareInvite,
  onShareInvite,
  showSurvey,
  onSurvey,
}: MenuBodyProps) {
  const navigate = useNavigate();
  const { user, profile, signOut, isOwner, isEmployee } = useAuth();
  const openHelp = useDefinitionsHelpStore((s) => s.open);
  const { isDark, toggleTheme } = useThemeStore();

  const handleSignOut = () => {
    onClose();
    void signOut().then(() => navigate('/login'));
  };

  return (
    <>
      <ProfileMenuUserHeader user={user} profile={profile} />

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
      {isOwner ? (
        <Link to="/settings/billing" className={menuItemClass} onClick={onClose}>
          <CreditCard className="h-4 w-4 text-cyan-400" aria-hidden />
          Billing & Subscription
        </Link>
      ) : null}

      <div className={menuDividerClass} />

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
        <button type="button" className={menuItemClass} onClick={toggleTheme}>
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
        <Link to="/employee/dashboard" className={menuItemClass} onClick={onClose}>
          Employee portal
        </Link>
      )}
      {isOwner && (
        <Link to="/employees" className={menuItemClass} onClick={onClose}>
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
    </>
  );
}

export default function AppProfileMenu({
  onClose,
  showThemeToggle = true,
  showShareInvite = false,
  onShareInvite,
  showSurvey = false,
  onSurvey,
}: AppProfileMenuProps) {
  const { profile } = useAuth();
  const isFieldOnly = isFieldOnlyRole(profile?.role);

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
      {isFieldOnly ? (
        <FieldUserProfileMenu onClose={onClose} showThemeToggle={showThemeToggle} />
      ) : (
        <AdminUserProfileMenu
          onClose={onClose}
          showThemeToggle={showThemeToggle}
          showShareInvite={showShareInvite}
          onShareInvite={onShareInvite}
          showSurvey={showSurvey}
          onSurvey={onSurvey}
        />
      )}
    </div>
  );
}
