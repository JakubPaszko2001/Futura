"use client";

import React, { useMemo, useState } from 'react';

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const WEEKDAY_LONG = ['Niedz.', 'Pon.', 'Wt.', 'Śr.', 'Czw.', 'Pt.', 'Sob.'];

const MIN_START = 8;   // studio opens 08:00
const MAX_END = 23;    // studio closes 23:00

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function Booking() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(null);
  const [startHour, setStartHour] = useState(12);
  const [hours, setHours] = useState(2);
  const [confirmed, setConfirmed] = useState(false);

  const maxHours = Math.max(1, MAX_END - startHour);
  const clampedHours = Math.min(hours, maxHours);
  const endHour = startHour + clampedHours;

  // Build the calendar grid (Monday-first)
  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7; // 0 = Monday
    const out: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const canGoPrev = view.getFullYear() > today.getFullYear() ||
    (view.getFullYear() === today.getFullYear() && view.getMonth() > today.getMonth());

  const changeMonth = (delta: number) => {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  const handleStartChange = (h: number) => {
    setStartHour(h);
    setConfirmed(false);
    if (hours > MAX_END - h) setHours(Math.max(1, MAX_END - h));
  };

  return (
    <div className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <span className="inline-block w-2 h-2 rounded-full bg-[#8000ff] animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">
          Rezerwacja studia
        </span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => changeMonth(-1)}
          disabled={!canGoPrev}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-white/15 text-white/70 transition-all hover:border-[#8000ff] hover:text-[#8000ff] disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-white/15 disabled:hover:text-white/70"
          aria-label="Poprzedni miesiąc"
        >
          ‹
        </button>
        <div className="text-center">
          <span className="text-base md:text-lg font-black uppercase tracking-tight">
            {MONTHS[view.getMonth()]}
          </span>
          <span className="font-mono text-xs text-white/40 ml-2">{view.getFullYear()}</span>
        </div>
        <button
          onClick={() => changeMonth(1)}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-white/15 text-white/70 transition-all hover:border-[#8000ff] hover:text-[#8000ff]"
          aria-label="Następny miesiąc"
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center font-mono text-[10px] uppercase tracking-widest text-white/30 py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />;
          const isPast = date < today;
          const isSelected = selected != null && date.getTime() === selected.getTime();
          const isToday = date.getTime() === today.getTime();
          return (
            <button
              key={date.toISOString()}
              disabled={isPast}
              onClick={() => { setSelected(date); setConfirmed(false); }}
              className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold transition-all
                ${isSelected
                  ? 'bg-[#8000ff] text-white shadow-[0_0_20px_rgba(128,0,255,0.5)]'
                  : isPast
                    ? 'text-white/15 cursor-not-allowed'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'}
                ${isToday && !isSelected ? 'ring-1 ring-[#8000ff]/50' : ''}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time + duration */}
      <div className="mt-8 space-y-6">
        {/* Start hour */}
        <div>
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
            <span>Godzina startu</span>
            <span className="text-[#8000ff]">{pad(startHour)}:00</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: MAX_END - MIN_START }, (_, k) => MIN_START + k).map((h) => (
              <button
                key={h}
                onClick={() => handleStartChange(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all
                  ${h === startHour
                    ? 'bg-[#8000ff] text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
              >
                {pad(h)}
              </button>
            ))}
          </div>
        </div>

        {/* Duration stepper */}
        <div>
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
            <span>Liczba godzin</span>
            <span className="text-[#8000ff]">{clampedHours} h</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setHours((h) => Math.max(1, h - 1)); setConfirmed(false); }}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/15 text-white/70 text-xl transition-all hover:border-[#8000ff] hover:text-[#8000ff]"
              aria-label="Mniej godzin"
            >
              −
            </button>
            <div className="flex-1 text-center text-2xl font-black tracking-tight">
              {clampedHours}<span className="text-white/40 text-base ml-1">h</span>
            </div>
            <button
              onClick={() => { setHours((h) => Math.min(maxHours, h + 1)); setConfirmed(false); }}
              disabled={clampedHours >= maxHours}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/15 text-white/70 text-xl transition-all hover:border-[#8000ff] hover:text-[#8000ff] disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label="Więcej godzin"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Summary + CTA */}
      <div className="mt-8 pt-6 border-t border-white/10">
        {selected ? (
          <div className="font-mono text-xs text-white/60 mb-5 leading-relaxed">
            <span className="text-white">
              {WEEKDAY_LONG[selected.getDay()]} {selected.getDate()} {MONTHS[selected.getMonth()].toLowerCase()} {selected.getFullYear()}
            </span>
            <br />
            {pad(startHour)}:00 – {pad(endHour)}:00 · {clampedHours} h · {clampedHours * 90} zł
          </div>
        ) : (
          <p className="font-mono text-xs text-white/30 mb-5">
            Wybierz dzień z kalendarza, aby zarezerwować.
          </p>
        )}

        <button
          onClick={() => selected && setConfirmed(true)}
          disabled={!selected}
          className="w-full py-4 rounded-full text-[11px] font-black uppercase tracking-[0.3em] transition-all active:scale-[0.98]
            bg-[#8000ff] text-white hover:shadow-[0_0_30px_rgba(128,0,255,0.5)]
            disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          {confirmed ? 'Zgłoszenie wysłane ✓' : 'Zarezerwuj termin'}
        </button>

        {confirmed && (
          <p className="font-mono text-[10px] text-white/40 mt-4 text-center leading-relaxed">
            Skontaktujemy się, aby potwierdzić rezerwację.
          </p>
        )}
      </div>
    </div>
  );
}
