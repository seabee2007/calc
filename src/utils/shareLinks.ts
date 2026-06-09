const DEFAULT_SHARE_ORIGIN = 'https://app.concrete-calc.com';

const UNSAFE_PATH_PREFIXES = ['/auth/callback', '/login', '/signup', '/reset-password'];

export function getAppShareOrigin(): string {
  const fromEnv = import.meta.env.VITE_APP_SHARE_ORIGIN;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  return DEFAULT_SHARE_ORIGIN;
}

export function getSafeShareUrl(pathname?: string): string {
  const origin = getAppShareOrigin();

  if (!pathname || pathname === '/') {
    return origin;
  }

  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const isUnsafe = UNSAFE_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (isUnsafe) {
    return origin;
  }

  return `${origin}${path}`;
}

export function getProjectInviteUrl(token: string): string {
  return `${getAppShareOrigin()}/invite/${encodeURIComponent(token)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export interface ShareOrCopyData {
  title?: string;
  text?: string;
  url: string;
}

export type ShareOrCopyResult = 'shared' | 'copied' | 'cancelled';

export async function shareOrCopy(data: ShareOrCopyData): Promise<ShareOrCopyResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  const copied = await copyToClipboard(data.url);
  return copied ? 'copied' : 'cancelled';
}

export function buildMailtoLink(options: {
  to?: string;
  subject: string;
  body: string;
}): string {
  const params = new URLSearchParams();
  params.set('subject', options.subject);
  params.set('body', options.body);
  const query = params.toString();
  const recipient = options.to?.trim() ?? '';
  return `mailto:${encodeURIComponent(recipient)}?${query}`;
}

export const APP_SHARE_EMAIL_SUBJECT = 'Concrete Calc Project Management Suite';

export function buildAppShareEmailBody(url?: string): string {
  const link = url ?? getAppShareOrigin();
  return [
    'I wanted to share Concrete Calc with you. It is a professional construction project management workspace for estimates, proposals, schedules, and field tracking.',
    '',
    'Open it here:',
    link,
  ].join('\n');
}

export const PROJECT_INVITE_EMAIL_SUBJECT = "You're invited to Concrete Calc";

export function buildProjectInviteEmailBody(options: {
  inviteeName?: string;
  inviteUrl: string;
}): string {
  const greeting = options.inviteeName?.trim()
    ? `Hi ${options.inviteeName.trim()},`
    : 'Hi,';

  return [
    greeting,
    '',
    "I'd like to invite you to Concrete Calc, a professional construction project management workspace for estimates, proposals, schedules, and project tracking.",
    '',
    'Open your invite here:',
    options.inviteUrl,
  ].join('\n');
}
