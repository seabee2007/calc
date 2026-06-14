import { useEffect, useState } from 'react';

/** True on narrow viewports and coarse-pointer devices where auto-hide headers are disruptive. */
export function usePrefersTouchLayout(): boolean {
  const [prefersTouchLayout, setPrefersTouchLayout] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');
    const update = () => setPrefersTouchLayout(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return prefersTouchLayout;
}
