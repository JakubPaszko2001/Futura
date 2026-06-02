"use client";

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Booking from './Booking';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const SERVICES = [
  { id: '01', name: 'Realizacja nagrań', price: '90 zł', unit: '/h' },
  { id: '02', name: 'Miks / Mastering utworu', price: 'od 300 zł', unit: '' },
  { id: '03', name: 'Stworzenie podkładu', price: 'od 700 zł', unit: '' },
  { id: '04', name: 'Realizacja teledysku', price: 'od 2500 zł', unit: '', note: 'wycena indywidualna' },
];

export default function Pricing() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useGSAP(() => {
    const rows = gsap.utils.toArray<HTMLElement>('.price-row');

    // Heading reveal
    gsap.from(headingRef.current, {
      yPercent: 30,
      opacity: 0,
      filter: 'blur(12px)',
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
    });

    // Rows reveal — staggered slide-up as the section enters
    gsap.from(rows, {
      yPercent: 60,
      opacity: 0,
      filter: 'blur(8px)',
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 55%' },
    });

    // Booking widget reveal
    gsap.from('.booking-col', {
      opacity: 0,
      y: 40,
      filter: 'blur(8px)',
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 60%' },
    });
  }, { scope: sectionRef });

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen bg-black text-white overflow-hidden px-6 py-24 md:px-16 md:py-28"
    >
      {/* Section label */}
      <div className="flex items-center gap-4 mb-10 md:mb-14">
        <span className="inline-block w-2 h-2 rounded-full bg-[#8000ff] animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">
          Usługi / Pricing
        </span>
        <div className="flex-1 h-[1px] bg-white/10" />
      </div>

      {/* Two halves: pricing (left 50%) · booking (right 50%) */}
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
        {/* ── Left 50%: Cennik (original design) ───────────────────── */}
        <div className="w-full lg:w-1/2">
          <h2
            ref={headingRef}
            className="text-[#8000ff] text-[16vw] md:text-[10vw] lg:text-[7vw] font-black uppercase tracking-tighter leading-[0.85] mb-12 md:mb-16 will-change-transform"
          >
            Cennik
          </h2>

          <div className="w-full">
            {SERVICES.map((s) => (
              <div
                key={s.id}
                className="price-row group border-t border-white/10 py-6 md:py-8 flex items-baseline justify-between gap-6 will-change-transform"
              >
                <div className="flex items-baseline gap-4 md:gap-8 min-w-0">
                  <span className="font-mono text-[11px] md:text-sm text-white/30 shrink-0">
                    {s.id}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xl md:text-4xl font-black uppercase tracking-tight leading-tight transition-colors duration-300 group-hover:text-[#8000ff]">
                      {s.name}
                    </h3>
                    {s.note && (
                      <p className="font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/40 mt-2">
                        {s.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-lg md:text-3xl font-black uppercase tracking-tight whitespace-nowrap">
                    {s.price}
                  </span>
                  {s.unit && (
                    <span className="text-sm md:text-xl font-black text-white/40">{s.unit}</span>
                  )}
                </div>
              </div>
            ))}
            <div className="border-t border-white/10" />
          </div>

          <p className="mt-10 md:mt-12 text-sm md:text-lg text-white/60 leading-relaxed border-l-2 border-[#8000ff] pl-5 md:pl-8">
            Możliwość rezerwacji studia na dowolną liczbę godzin i wybrany dzień —
            zaznacz termin obok.
          </p>
        </div>

        {/* ── Right 50%: Booking calendar ──────────────────────────── */}
        <div className="booking-col w-full lg:w-1/2 lg:sticky lg:top-20 will-change-transform">
          <Booking />
        </div>
      </div>
    </section>
  );
}
