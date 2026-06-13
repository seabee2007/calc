# calc-ios

## Supabase Social Login Setup

OAuth client secrets must only be configured in the Supabase Dashboard and provider consoles — never in frontend code.

### Enable providers

In **Supabase Dashboard → Authentication → Providers**:

1. **Google** — Enable, then add Google OAuth Client ID and Client Secret ([Google setup docs](https://supabase.com/docs/guides/auth/social-login/auth-google)).
2. **GitHub** — Enable, then add GitHub OAuth App Client ID and Client Secret ([GitHub setup docs](https://supabase.com/docs/guides/auth/social-login/auth-github)).

### URL configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

**Site URL:**

```text
https://app.ardenprojectos.com
```

**Additional Redirect URLs:**

```text
https://app.ardenprojectos.com/auth/callback
http://localhost:5173/auth/callback
```

The app uses `redirectTo: ${window.location.origin}/auth/callback` for OAuth. That URL must match an allowed redirect URL above.

### Two-site OAuth flow

| Site | Role |
| --- | --- |
| `https://ardenprojectos.com` | Public marketing site only. Sign-in buttons must link to `https://app.ardenprojectos.com/login`. The marketing site must **not** host `/auth/callback`. |
| `https://app.ardenprojectos.com` | App owns `/login`, `/signup`, `/auth/callback`, onboarding, and the workspace. |

Sign-in entry points on the app:

- App landing (`/`) — **Continue with Google** and **Sign in** → `/login`
- Login page (`/login`) — **Continue with Google** via existing social login buttons

Google OAuth always requests account selection via `prompt=select_account`.

### Google Cloud Console

In **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client**:

**Authorized redirect URI** (Supabase provider callback, not the app callback):

```text
https://bhxbxcexssolsdgvgxjz.supabase.co/auth/v1/callback
```

After Google auth, Supabase redirects to the app callback (`/auth/callback`), which exchanges the PKCE code and routes to `/` for existing onboarding/dashboard gating.

### Local development

1. Configure Google/GitHub OAuth apps with redirect URI pointing to your Supabase project callback URL (shown in the Supabase provider settings).
2. Run the app with `npm run dev` (default port `5173`).
3. Use **Continue with Google** or **Continue with GitHub** on the login/signup pages.
