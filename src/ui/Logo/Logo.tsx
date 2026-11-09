import { useId } from 'react';

/**
 * The Drumr mark: four pads on a tile, the struck pad lit in the accent gradient with a strike
 * ring (docs/03-DESIGN.md §4.2). Same drawing as public/favicon.svg and the app icons.
 */
export function LogoMark({ className = 'size-9' }: { className?: string }) {
  const id = useId();
  const lit = `${id}-lit`;
  const glow = `${id}-glow`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={lit} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="var(--bg-2)" stroke="var(--line)" />
      <rect x="6" y="17" width="9" height="9" rx="2.2" fill="var(--line)" />
      <rect x="17" y="17" width="9" height="9" rx="2.2" fill="var(--line)" />
      <rect x="17" y="6" width="9" height="9" rx="2.2" fill="var(--line)" />
      <rect
        x="6"
        y="6"
        width="9"
        height="9"
        rx="2.2"
        fill="var(--accent)"
        opacity="0.55"
        filter={`url(#${glow})`}
      />
      <rect x="6" y="6" width="9" height="9" rx="2.2" fill={`url(#${lit})`} />
      <rect
        x="3.75"
        y="3.75"
        width="13.5"
        height="13.5"
        rx="4"
        fill="none"
        stroke="var(--accent)"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="flex items-baseline gap-3">
        <h1 className="text-[17px] leading-none font-semibold tracking-tight text-fg-0">Drumr</h1>
        <span aria-hidden="true" className="hidden h-3.5 w-px self-center bg-line sm:block" />
        <span className="hidden text-xs leading-none text-fg-2 sm:inline">Live drum sampler</span>
      </div>
    </div>
  );
}
