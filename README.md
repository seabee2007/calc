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
https://app.concrete-calc.com
```

**Additional Redirect URLs:**

```text
http://localhost:5173/**
http://172.20.10.2:5173/**
https://app.concrete-calc.com/**
https://concrete-calc.com/**
```

The app uses `redirectTo: ${window.location.origin}/auth/callback` for OAuth. That URL must match an allowed redirect pattern above.

### Local development

1. Configure Google/GitHub OAuth apps with redirect URI pointing to your Supabase project callback URL (shown in the Supabase provider settings).
2. Run the app with `npm run dev` (default port `5173`).
3. Use **Continue with Google** or **Continue with GitHub** on the login/signup pages.
