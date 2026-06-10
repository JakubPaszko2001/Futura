"use client";

import React from 'react';
import Booking from './Booking';

const SERVICES = [
  { id: '01', name: 'Realizacja nagrań', price: '90 zł', unit: '/h' },
  { id: '02', name: 'Miks / Mastering utworu', price: 'od 300 zł', unit: '' },
  { id: '03', name: 'Stworzenie podkładu', price: 'od 700 zł', unit: '' },
  { id: '04', name: 'Realizacja teledysku', price: 'od 2500 zł', unit: '', note: 'wycena indywidualna' },
];

// Presentational only — fills one viewport (100vh). Visibility/animation is
// driven by the parent (Mic) timeline.
export default function PricingPanel() {
  return (
    <div className="w-full h-full overflow-y-auto flex flex-col justify-start lg:justify-center px-5 py-10 md:px-16">
      {/* Section label */}
      <div className="flex items-center gap-4 mb-5 md:mb-8 shrink-0">
        <span className="inline-block w-2 h-2 rounded-full bg-[#8000ff] animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">
          Usługi / Pricing
        </span>
        <div className="flex-1 h-[1px] bg-white/10" />
      </div>

      {/* Two halves: pricing (left 50%) · booking (right 50%) */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-14 items-start lg:items-center">
        {/* ── Left 50%: Cennik ─────────────────────────────────────── */}
        <div className="w-full lg:w-1/2">
          <h2 className="text-[#8000ff] text-[12vw] md:text-[8vw] lg:text-[5.5vw] font-black uppercase tracking-tighter leading-[0.85] mb-6 md:mb-8">
            Cennik
          </h2>

          <div className="w-full">
            {SERVICES.map((s) => (
              <div
                key={s.id}
                className="group border-t border-white/10 py-3 md:py-4 flex items-baseline justify-between gap-6"
              >
                <div className="flex items-baseline gap-3 md:gap-5 min-w-0">
                  <span className="font-mono text-[10px] md:text-xs text-white/30 shrink-0">
                    {s.id}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-2xl font-black uppercase tracking-tight leading-tight transition-colors duration-300 group-hover:text-[#8000ff]">
                      {s.name}
                    </h3>
                    {s.note && (
                      <p className="font-mono text-[9px] md:text-[11px] uppercase tracking-[0.2em] text-white/40 mt-1">
                        {s.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm md:text-2xl font-black uppercase tracking-tight whitespace-nowrap">
                    {s.price}
                  </span>
                  {s.unit && (
                    <span className="text-xs md:text-lg font-black text-white/40">{s.unit}</span>
                  )}
                </div>
              </div>
            ))}
            <div className="border-t border-white/10" />
          </div>

          <p className="mt-5 md:mt-7 text-xs md:text-sm text-white/60 leading-relaxed border-l-2 border-[#8000ff] pl-4 md:pl-5">
            Możliwość rezerwacji studia na dowolną liczbę godzin i wybrany dzień —
            zaznacz termin obok.
          </p>
        </div>

        {/* ── Right 50%: Booking calendar ──────────────────────────── */}
        <div className="w-full lg:w-1/2">
          <Booking />
        </div>
      </div>
    </div>
  );
}
