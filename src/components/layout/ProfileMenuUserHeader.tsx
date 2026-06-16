import type { User } from '@supabase/supabase-js';
import ProfileMenuPlanBadge from '../subscription/ProfileMenuPlanBadge';
import { getUserInitials } from '../../utils/getUserInitials';

interface ProfileMenuUserHeaderProps {
  user: User | null;
  profile: {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
  } | null;
}

export default function ProfileMenuUserHeader({ user, profile }: ProfileMenuUserHeaderProps) {
  const displayName = profile?.displayName ?? user?.email ?? 'Account';

  return (
    <div className="flex items-start gap-2 px-3 py-2" data-testid="profile-menu-user-header">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-semibold text-white">
        {getUserInitials({
          firstName: profile?.firstName,
          lastName: profile?.lastName,
          displayName: profile?.displayName,
          email: user?.email,
        })}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-200">{displayName}</p>
        <div className="mt-1">
          <ProfileMenuPlanBadge />
        </div>
      </div>
    </div>
  );
}
