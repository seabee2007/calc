# Support request emails

User-submitted support requests from the Contact page **Support Request** modal are sent to `support@ardenprojectos.com` via the `send-support-request` edge function.

## Trigger

- User opens Contact / Support and clicks the visible support email link.
- User completes the modal and clicks **Send request**.

## Email delivery

- Provider: Resend (server-side only).
- Edge function: `supabase/functions/send-support-request/index.ts`
- Inbox: `SUPPORT_INBOX_EMAIL` env var, default `support@ardenprojectos.com`.
- Reply-to: the user's contact email.
- Subject prefix: `[Arden Support]`

## Usage metering

**Support request emails do not consume customer `email_send` usage.** They bypass `send-transactional-email` and the usage metering path entirely. These are operational/system support messages, not customer project communication.

## Persistence

Optional logging table: `public.support_requests`

- Inserts are service-role only (edge function).
- Authenticated users may read their own rows via RLS.
- Used for basic rate limiting and audit trail.

## Rate limits

- Authenticated users: 10 requests per hour per user.
- Guest/unauthenticated: 3 requests per hour per contact email.

Future hardening: IP-based cooldown for anonymous submissions.

## Auth

- Logged-in users: JWT optional; contact email defaults to account email.
- Logged-out users: must provide contact email; request uses anon key bearer.
