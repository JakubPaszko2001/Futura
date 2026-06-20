"use client";

import React, { useEffect, useState, useCallback } from 'react';

// Each stop maps to a fraction of the pinned "experience" scroll range.
// frac 0 == the very top (Hero). The big pinned Mic section scrubs mic → wave
// → speaker → cennik, so the later stops are fractions through that pin.
const STOPS = [
  { id: 'start', label: 'Start', frac: 0 },
  { id: 'mic', label: 'Nagrania', frac: 0.03 },
  { id: 'wave', label: 'Fala', frac: 0.35 },     // oba napisy już w pełni widoczne
  { id: 'speaker', label: 'Dźwięk', frac: 0.56 }, // cały napis POCZUJ POTĘGĘ BASU odsłonięty
  { id: 'cennik', label: 'Cennik', frac: 0.85 },
] as const;

function Icon({ id, className }: { id: string; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (id) {
    case 'start':
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v10h13V10" />
        </svg>
      );
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v4M8.5 22h7" />
        </svg>
      );
    case 'wave':
      return (
        <svg {...common}>
          <path d="M2 12q2.5 -7 5 0t5 0t5 0t5 0" />
        </svg>
      );
    case 'speaker':
      return (
        <svg {...common}>
          <rect x="5" y="2" width="14" height="20" rx="2.5" />
          <circle cx="12" cy="14.5" r="3.8" />
          <circle cx="12" cy="6" r="1.1" />
        </svg>
      );
    case 'cennik':
      return (
        <svg {...common}>
          <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2.5 12V3.5h8.5l8.9 8.9a2 2 0 0 1 .7 1z" />
          <circle cx="7" cy="7" r="1.2" />
        </svg>
      );
    default:
      return null;
  }
}

export default function SectionHub() {
  const [active, setActive] = useState(0);

  // Smoothly scroll to a fraction of the pinned experience.
  const goTo = useCallback((frac: number) => {
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const pinStart = vh;                       // Hero is exactly 100vh
    const pinRange = Math.max(0, max - pinStart);
    const target = frac === 0 ? 0 : Math.min(max, pinStart + frac * pinRange);

    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: number, o?: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else window.scrollTo({ top: target, behavior: 'smooth' });
  }, []);

  // Track active stop from scroll position.
  useEffect(() => {
    const onScroll = () => {
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      const pinStart = vh;
      const pinRange = Math.max(1, max - pinStart);
      const y = window.scrollY;

      let idx = 0;
      if (y < pinStart * 0.55) idx = 0;          // Hero
      else {
        const frac = (y - pinStart) / pinRange;
        if (frac < 0.18) idx = 1;                // mic
        else if (frac < 0.42) idx = 2;           // wave
        else if (frac < 0.62) idx = 3;           // speaker
        else idx = 4;                            // cennik
      }
      setActive(idx);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <nav
      aria-label="Sekcje"
      className="fixed right-3 md:right-6 top-1/2 -translate-y-1/2 z-[200] flex flex-col items-center"
    >
      {/* connecting line */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-white/10" />

      <ul className="relative flex flex-col items-center gap-4 md:gap-5">
        {STOPS.map((s, i) => {
          const isActive = active === i;
          return (
            <li key={s.id} className="group relative flex items-center justify-center">
              {/* hover label (to the left of the icon) */}
              <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-black/80 backdrop-blur-sm px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-white/80 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                {s.label}
              </span>

              <button
                onClick={() => goTo(s.frac)}
                aria-label={s.label}
                aria-current={isActive ? 'true' : undefined}
                className={`flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full border transition-all duration-300 active:scale-90
                  ${isActive
                    ? 'border-[#8000ff] bg-[#8000ff] text-white shadow-[0_0_18px_rgba(128,0,255,0.55)] scale-105'
                    : 'border-white/15 bg-black/40 backdrop-blur-sm text-white/55 hover:text-white hover:border-[#8000ff]/60'}`}
              >
                <Icon id={s.id} className="h-[18px] w-[18px] md:h-5 md:w-5" />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
