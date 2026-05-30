import React from 'react';
import backgroundImage from '../../assets/images/bkgrnd.jpg';
import { useThemeStore } from '../../store/themeStore';

/** Frosted concrete background shared by main site and planner workspace. */
const SiteBackground: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ top: 'env(safe-area-inset-top)' }}
      aria-hidden
    >
      <div
        className="absolute inset-0 transition-[filter] duration-300 ease-out"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: 'scale(1.06)',
          filter: isDark
            ? 'grayscale(85%) brightness(0.48) blur(5px)'
            : 'grayscale(30%) brightness(1.02) blur(2px)',
          willChange: 'transform, filter',
        }}
      />
      <div
        className={`absolute inset-0 transition-colors duration-300 ease-out ${
          isDark ? 'bg-slate-950/94' : 'bg-slate-50/75'
        }`}
      />
      {isDark && <div className="absolute inset-0 bg-slate-950/40 transition-opacity duration-300" />}
    </div>
  );
};

export default SiteBackground;
