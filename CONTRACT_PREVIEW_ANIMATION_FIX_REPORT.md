# Contract Preview Animation Fix Report

## Files Changed
- `src/features/documents/ui/DocumentBuilderPage.tsx`

## Animation Approach
- Replaced the desktop preview area from animated grid-template columns to an animated flex layout.
- The builder panel now transitions between a centered full-width layout and a desktop split layout.
- The preview panel now transitions with width/flex-basis, opacity, and translate movement.
- The existing fixed preview toggle measurement behavior was preserved.

## Duration And Easing
- Desktop and preview transitions use `motion-safe:duration-300` with `motion-safe:ease-in-out`.
- The preview toggle button uses the same timing plus small hover/active scale feedback.
- `motion-reduce:transition-none` is applied to the animated layout areas for reduced-motion users.

## Close Animation And Scroll Height
- Added `shouldRenderPreview` so the preview remains mounted for 300ms after closing.
- During close, the preview animates toward zero desktop flex-basis with opacity and slide movement.
- After the animation finishes, the preview is unmounted so it no longer contributes to page height.
- The existing scroll clamp runs after the preview is removed to avoid blank concrete background scroll space.

## Toggle Positioning
- The existing toggle button positioning remains based on the builder column and New Contract card measurements.
- The layout still remeasures on preview open/close, resize, scroll, and after the transition settle timer.
- The button remains fixed in the viewport and attached to the builder/preview boundary.

## Validation
- `ReadLints` reported no linter errors for `DocumentBuilderPage.tsx`.
- `npm run build` completed successfully.
- Build retained the pre-existing Vite warning about `employeeService.ts` being both dynamically and statically imported.
