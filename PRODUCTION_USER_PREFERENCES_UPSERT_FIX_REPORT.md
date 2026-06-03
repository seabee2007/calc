# Production Fix: User Preferences Upsert + Auth/Haptics Cleanup

## Production symptoms

1. `23505 duplicate key value violates unique constraint "user_preferences_user_id_key"` when saving preferences
2. `AuthApiError: Invalid Refresh Token: Refresh Token Not Found`
3. Repeated `Browser does not support the vibrate API` in Firefox/desktop web

---

## 1. User preferences save (root cause)

**Root cause:** `.upsert()` was called **without** `onConflict: 'user_id'`. PostgREST treated conflicts on primary key `id`, so each save attempted a new INSERT with a new `id`, violating `UNIQUE(user_id)` when a row already existed.

**Fix:** Centralized in `src/services/userPreferencesService.ts`:

```typescript
await supabase
  .from('user_preferences')
  .upsert(preferencesToRow(userId, preferences), { onConflict: 'user_id' })
  .select()
  .single();
```

**Rules enforced:**

- No `id` in payload (DB default UUID)
- Only columns that exist on `user_preferences` (no `theme`)
- `user_id` from `requireAuthenticatedUserId()`
- `updateUserPreferences()` merges partial updates, then calls `saveUserPreferences()`

**Store (`src/store/index.ts`):**

- Optimistic Zustand update before network call
- On failure: revert, persist to `localStorage` fallback, rethrow for Settings toast
- Dev-only `console.error` (no production spam)

**Audit:** No `.from('user_preferences').insert` in the repo.

---

## 2. RLS (upsert support)

Verified in `20250125000000_add_storage_and_company_settings.sql` (not modified):

| Policy | Rule |
|--------|------|
| SELECT | `auth.uid() = user_id` |
| INSERT | `WITH CHECK (auth.uid() = user_id)` |
| UPDATE | `USING (auth.uid() = user_id)` |

`20260618000000_expand_user_preferences.sql` idempotently recreates these if missing.

**Migration needed for this fix:** No new migration.

---

## 3. Invalid refresh token handling

**New:** `src/lib/authSession.ts`

- `isStaleRefreshTokenError()` — detects refresh token not found / invalid / revoked
- `clearStaleAuthSession()` — `signOut({ scope: 'local' })` without requiring a valid server session

**Updated:** `src/contexts/AuthContext.tsx`

- `getSession()` — on stale refresh error → clear local session, `user = null`
- `onAuthStateChange` — `SIGNED_OUT` / null session → clear user/profile
- `signOut()` — always clears local state; ignores stale-token errors
- Auth errors logged only in `import.meta.env.DEV`

**Redirect:** `AuthGuard` sends unauthenticated users to `/login` when `user` is null.

**Preferences service:** `requireAuthenticatedUserId()` clears stale session on auth errors before throwing.

---

## 4. Haptics web fallback

**File:** `src/services/hapticService.ts` (already in place)

- One-time detection: native → always on; web → requires `navigator.vibrate`
- Skips Capacitor `Haptics` calls when unsupported (Firefox)
- Respects `hapticsEnabled` preference
- Single `console.debug` in dev when skipped; no per-click warnings
- Native iOS/Android behavior unchanged

---

## Files changed

| File | Change |
|------|--------|
| `src/services/userPreferencesService.ts` | Upsert `onConflict: 'user_id'`, auth helper |
| `src/store/index.ts` | Optimistic preference updates |
| `src/lib/authSession.ts` | **New** stale refresh helpers |
| `src/contexts/AuthContext.tsx` | Stale session cleanup |
| `src/services/hapticService.ts` | Web vibrate gate (prior pass) |
| `src/services/companySettingsService.ts` | Re-exports preferences service |

---

## Acceptance checklist

| Test | Expected |
|------|----------|
| First preference save | Creates one row |
| Second save | Updates same row, no `23505` |
| Refresh | Preferences load from DB |
| Stale refresh token | Local sign-out, redirect to login, no crash loop |
| Firefox haptics | No repeated vibrate API console noise |
| iOS native haptics | Unchanged |

---

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Repo-wide pre-existing issues; no new issues in changed auth/preference files |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing repo drift |
| `npm test` | **Pass** — 27 files, 196 tests |
| `npm run build` | **Pass** |

**Deploy note:** Production (`concrete-calc.com`) must ship this build for upsert/auth/haptics fixes to take effect in the browser.
