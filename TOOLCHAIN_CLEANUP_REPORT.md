# Toolchain Cleanup Report
## Summary
Updated the project lint command so ESLint only scans application source files instead of the entire user directory.
## Change Made
- `package.json`
  - Changed `lint` from `eslint .` to `eslint src`.
## Validation Results
- `npm run lint`: passed.
  - Confirmed the command now runs `eslint src`.
  - The previous `EPERM` scan failure from protected profile/temp paths did not recur.
  - Existing non-failing warning remains: TypeScript 5.6.3 is outside the officially supported `@typescript-eslint/typescript-estree` range of `>=4.7.4 <5.6.0`.
- `npx tsc -p tsconfig.app.json --noEmit`: passed with no output.
- `npm run build`: passed.
  - Existing non-failing warnings remain:
    - Browserslist/caniuse-lite data is stale.
    - One generated chunk is larger than 500 kB after minification.
## dist/ Tracking Status
- `git --no-pager status --short -- package.json dist TOOLCHAIN_CLEANUP_REPORT.md` showed only `package.json` changed before this report was created.
- `git --no-pager ls-files -- dist` returned no tracked files.
- `git --no-pager status --short --ignored -- dist` reported `!! dist/`, confirming `dist/` is ignored.
- No tracked `dist/` cleanup or commit handling is needed.
## Final Status
Toolchain cleanup is complete. The narrowed lint script, TypeScript no-emit check, and production build all pass.
