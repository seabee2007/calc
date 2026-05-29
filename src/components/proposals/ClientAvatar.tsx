import React from 'react';
import { clientInitials } from '../../utils/proposalCrm';

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-cyan-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ClientAvatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md';
}) {
  const initials = clientInitials(name);
  const color = colorForName(name);
  const dim = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';

  return (
    <div
      className={`${dim} ${color} flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/20`}
      title={name}
      aria-hidden
    >
      {initials}
    </div>
  );
}
