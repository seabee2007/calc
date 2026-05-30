import React from 'react';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface UserAvatarProps {
  name?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export default function UserAvatar({ name, size = 'sm', className = '' }: UserAvatarProps) {
  const label = name?.trim() || '?';
  const initials = initialsFromName(label);
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
