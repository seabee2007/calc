import type { User } from '@supabase/supabase-js';
import { getUserInitials } from '../../utils/getUserInitials';
import { appNavIconButtonClass } from './appNavStyles';

export interface UserAvatarProfile {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}

interface UserAvatarButtonProps {
  user?: User | null;
  profile?: UserAvatarProfile | null;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
  title?: string;
}

export default function UserAvatarButton({
  user,
  profile,
  active = false,
  onClick,
  className,
  'aria-label': ariaLabel = 'Profile menu',
  title = 'Profile menu',
}: UserAvatarButtonProps) {
  const initials = getUserInitials({
    firstName: profile?.firstName,
    lastName: profile?.lastName,
    displayName: profile?.displayName,
    email: user?.email,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? `${appNavIconButtonClass(active)} !h-8 !w-8 !rounded-full !p-0`}
      aria-label={ariaLabel}
      title={title}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-semibold text-white"
        data-testid="user-avatar-initials"
      >
        {initials}
      </span>
    </button>
  );
}
