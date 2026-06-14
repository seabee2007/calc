import React from 'react';
import { getUserInitials } from '../../utils/getUserInitials';

interface UserAvatarProps {
  name?: string | null;
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
  size?: 'sm' | 'md';
  className?: string;
}

export default function UserAvatar({ name, profile, size = 'sm', className = '' }: UserAvatarProps) {
  const label = name?.trim() || profile?.displayName?.trim() || '?';

  const initials = profile
    ? getUserInitials({
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: profile.displayName ?? name,
        email: profile.email,
      })
    : getUserInitials({ displayName: name });

  const sizeClass = size === 'md' ? 'h-8 w-8 text-xs' : 'h-6 w-6 text-[10px]';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-600 font-semibold text-white dark:bg-cyan-700 ${sizeClass} ${className}`}
      title={label}
      aria-hidden
    >
      {initials}
    </span>
  );
}
