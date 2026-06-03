# Haptics Web Fallback Report

## Problem

In Firefox and other browsers without the [Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API), every UI interaction that called `@capacitor/haptics` produced repeated console noise:

```
Browser does not support the vibrate API
```

`hapticService` treated `'Capacitor' in window` as “supported,” which is true in Capacitor web builds even when `navigator.vibrate` is missing. Each button/modal then invoked `Haptics.*` and logged `console.warn` on failure.

## Solution

**File:** `src/services/hapticService.ts`

1. **One-time platform detection** at module load:
   - `Capacitor.isNativePlatform()` → supported (iOS/Android unchanged).
   - Otherwise require `typeof navigator.vibrate === 'function'`.
2. **Early return** in `canUseHaptics()` when unsupported or disabled in preferences — no `Haptics` calls on unsupported web.
3. **Silent failures** on native edge cases (empty `catch`, no per-click warnings).
4. **Single dev-only message** via `console.debug` when web lacks Vibrate API (`import.meta.env.DEV`, logged once).
5. Removed per-trigger `console.log` / `console.warn` spam.

No other haptic wrappers exist; callers import `hapticService` only.

## Behavior matrix

| Environment | Vibrate API | User pref on | Result |
|-------------|-------------|--------------|--------|
| iOS/Android native | N/A (native haptics) | yes | Capacitor `Haptics.*` |
| iOS/Android native | N/A | no | Skip |
| Chrome mobile web | yes | yes | Capacitor web → vibrate |
| Firefox desktop web | no | yes | Skip quietly |
| Any web | — | off | Skip |

## Validation

Run from `calc/`:

| Command | Result |
|---------|--------|
| `npm run lint` | Exit 1 (repo-wide pre-existing); no `hapticService.ts` findings |
| `npx tsc -p tsconfig.app.json --noEmit` | Exit 2 (pre-existing drift); no `hapticService.ts` errors |
| `npm test` | **Pass** — 27 files, 196 tests |
| `npm run build` | **Pass** |
