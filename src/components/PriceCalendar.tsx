'use client';

/**
 * PriceCalendar — real multi-date flight price grid.
 * Queries /api/flights for every day in the selected month, runs them in
 * batches of 7 to avoid rate-limiting, and renders a colour-coded month
 * view where the cheapest days glow green and the expensive ones sit in red.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence }                   from 'framer-motion';
import { RefreshCw, TrendingDown, Calendar, X }      from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceCalendarProps {
  origin:        string;
  destination:   string;
  adults:        number;
  travelClass:   'ECONOMY' | 'BUSINESS' | 'FIRST';
  /** Called when the user taps a date */
  onSelectDate:  (date: string) => void;
  /** Initial selected date YYYY-MM-DD */
  selectedDate?: string;
  onClose?:      () => void;
}

interface DayData {
  date:    string;
  price:   number | null;
  loading: boolean;
  error:   boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function today(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_INITIALS = ['S','M','T','W','T','F','S'];

// ── Price colour helpers ───────────────────────────────────────────────────────

function priceColor(price: number, min: number, max: number): string {
  if (max === min) return '#30D158';
  const t = (price - min) / (max - min); // 0 = cheapest, 1 = most expensive
  if (t < 0.25) return '#30D158';        // green
  if (t < 0.50) return '#A8D84A';        // yellow-green
  if (t < 0.75) return '#FF9F0A';        // amber
  return '#FF453A';                       // red
}

function priceBg(price: number, min: number, max: number): string {
  const c = priceColor(price, min, max);
  return `${c}18`;
}

function formatPrice(p: number): string {
  return p >= 1000 ? `$${(p / 1000).toFixed(1)}k` : `$${p}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PriceCalendar({
  origin, destination, adults, travelClass,
  onSelectDate, selectedDate, onClose,
}: PriceCalendarProps) {
  const { year: todayYear, month: todayMonth } = today();
  const [viewYear,  setViewYear]  = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const [days,      setDays]      = useState<DayData[]>([]);
  const [fetching,  setFetching]  = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const canSearch = origin.trim().length >= 3 && destination.trim().length >= 3;

  // ── Build empty skeleton for the month ─────────────────────────────────────

  const buildSkeleton = useCallback(() => {
    const count = daysInMonth(viewYear, viewMonth);
    const today_ = new Date().toISOString().split('T')[0];
    const skeleton: DayData[] = Array.from({ length: count }, (_, i) => {
      const date = formatYMD(viewYear, viewMonth, i + 1);
      return { date, price: null, loading: date >= today_, error: false };
    });
    setDays(skeleton);
    return skeleton;
  }, [viewYear, viewMonth]);

  // ── Fetch prices for this month ────────────────────────────────────────────

  const fetchPrices = useCallback(async () => {
    if (!canSearch) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setFetching(true);
    const skeleton = buildSkeleton();

    const today_ = new Date().toISOString().split('T')[0];
    const futureDays = skeleton.filter(d => d.date >= today_);

    // Batch into groups of 7 — fetch each batch in parallel within, sequentially across
    const BATCH = 7;
    const batches: DayData[][] = [];
    for (let i = 0; i < futureDays.length; i += BATCH) {
      batches.push(futureDays.slice(i, i + BATCH));
    }

    for (const batch of batches) {
      if (ctrl.signal.aborted) break;

      await Promise.all(batch.map(async (dayData) => {
        try {
          const params = new URLSearchParams({
            origin:        origin.trim().toUpperCase().slice(0, 3),
            destination:   destination.trim().toUpperCase().slice(0, 3),
            departureDate: dayData.date,
            adults:        String(adults),
            travelClass,
            maxResults:    '1',
            engines:       'duffel',
          });
          const res  = await fetch(`/api/flights?${params}`, { signal: ctrl.signal });
          const data = await res.json();
          const price = data.results?.[0]?.price ?? null;
          setDays(prev => prev.map(d =>
            d.date === dayData.date ? { ...d, price, loading: false, error: price === null && data.status === 'error' } : d,
          ));
        } catch {
          if (!ctrl.signal.aborted) {
            setDays(prev => prev.map(d =>
              d.date === dayData.date ? { ...d, loading: false, error: true } : d,
            ));
          }
        }
      }));

      // Small pause between batches to be polite to the API
      if (!ctrl.signal.aborted) await new Promise(r => setTimeout(r, 300));
    }

    if (!ctrl.signal.aborted) setFetching(false);
  }, [canSearch, origin, destination, adults, travelClass, buildSkeleton]);

  useEffect(() => {
    buildSkeleton();
    if (canSearch) fetchPrices();
    return () => abortRef.current?.abort();
  }, [viewYear, viewMonth, canSearch]); // eslint-disable-line

  // ── Price range for colour scale ───────────────────────────────────────────

  const prices = days.map(d => d.price).filter((p): p is number => p !== null);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  // ── Nav ────────────────────────────────────────────────────────────────────

  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const firstDow = firstDayOfWeek(viewYear, viewMonth);
  const today_ = new Date().toISOString().split('T')[0];

  const cheapestDate = prices.length
    ? days.find(d => d.price === minPrice)?.date
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{
        borderRadius: 22,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(56px) saturate(200%)',
        WebkitBackdropFilter: 'blur(56px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.96)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.05), inset 0 1.5px 0 rgba(255,255,255,1)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #007AFF, #5E5CE6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(0,122,255,0.28)',
          }}>
            <Calendar size={14} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
              Price Calendar
            </div>
            <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500, letterSpacing: '-0.01em' }}>
              {origin} → {destination} · {travelClass.toLowerCase()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Cheapest badge */}
          {cheapestDate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 100,
                background: 'rgba(48,209,88,0.09)', border: '1px solid rgba(48,209,88,0.22)',
              }}
            >
              <TrendingDown size={9} color="#30D158" strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#30D158' }}>
                From {formatPrice(minPrice)}
              </span>
            </motion.div>
          )}

          {/* Refresh */}
          {canSearch && (
            <motion.button
              onClick={fetchPrices}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              style={{
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.16)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <motion.div animate={fetching ? { rotate: 360 } : {}} transition={{ duration: 0.9, repeat: fetching ? Infinity : 0, ease: 'linear' }}>
                <RefreshCw size={11} color="#007AFF" strokeWidth={2.5} />
              </motion.div>
            </motion.button>
          )}

          {onClose && (
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              style={{
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={11} color="#6E6E73" strokeWidth={2.5} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Month navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px 6px',
      }}>
        <motion.button
          onClick={goPrev}
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          style={{
            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#3C3C43',
          }}
        >‹</motion.button>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>

        <motion.button
          onClick={goNext}
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          style={{
            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#3C3C43',
          }}
        >›</motion.button>
      </div>

      {/* Day-of-week headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        paddingInline: 12, gap: 3,
      }}>
        {DAY_INITIALS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 9.5, fontWeight: 700,
            color: i === 0 || i === 6 ? '#BF5AF2' : '#AEAEB2',
            paddingBottom: 4, letterSpacing: '0.02em',
          }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        padding: '0 12px 16px', gap: 3,
      }}>
        {/* Empty cells before month starts */}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`empty-${i}`} style={{ height: 52 }} />
        ))}

        {days.map((day) => {
          const dayNum   = parseInt(day.date.split('-')[2]);
          const isPast   = day.date < today_;
          const isToday  = day.date === today_;
          const isSel    = day.date === selectedDate;
          const isCheap  = day.date === cheapestDate;
          const dow      = new Date(day.date + 'T12:00:00').getDay();
          const isWeekend = dow === 0 || dow === 6;

          const hasPrice = day.price !== null && !isPast;
          const bgColor  = hasPrice ? priceBg(day.price!, minPrice, maxPrice) : 'transparent';
          const txtColor = hasPrice ? priceColor(day.price!, minPrice, maxPrice) : '#AEAEB2';

          return (
            <motion.button
              key={day.date}
              onClick={() => !isPast && onSelectDate(day.date)}
              whileHover={!isPast ? { scale: 1.06 } : {}}
              whileTap={!isPast ? { scale: 0.94 } : {}}
              style={{
                height: 52, borderRadius: 12, cursor: isPast ? 'default' : 'pointer',
                background: isSel
                  ? 'linear-gradient(135deg, #007AFF, #5E5CE6)'
                  : isToday
                  ? 'rgba(0,122,255,0.08)'
                  : bgColor,
                border: isSel
                  ? '1.5px solid rgba(0,122,255,0.5)'
                  : isToday
                  ? '1.5px solid rgba(0,122,255,0.22)'
                  : isCheap && hasPrice
                  ? '1.5px solid rgba(48,209,88,0.35)'
                  : '1.5px solid transparent',
                opacity: isPast ? 0.28 : 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 1,
                position: 'relative',
                transition: 'background 0.18s, border-color 0.18s',
                boxShadow: isCheap && hasPrice && !isSel
                  ? '0 2px 10px rgba(48,209,88,0.18)'
                  : 'none',
              }}
            >
              {/* Cheapest crown dot */}
              {isCheap && hasPrice && !isSel && (
                <div style={{
                  position: 'absolute', top: 5, right: 5,
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#30D158',
                  boxShadow: '0 0 6px rgba(48,209,88,0.7)',
                }} />
              )}

              <span style={{
                fontSize: 13, fontWeight: isSel ? 800 : 600,
                color: isSel ? '#fff' : isWeekend ? '#BF5AF2' : '#1D1D1F',
                lineHeight: 1,
              }}>
                {dayNum}
              </span>

              {/* Price or loading */}
              {day.loading && !isPast ? (
                <motion.div
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{ width: 24, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.08)' }}
                />
              ) : hasPrice ? (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: isSel ? 'rgba(255,255,255,0.88)' : txtColor,
                  letterSpacing: '-0.01em',
                }}>
                  {formatPrice(day.price!)}
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </div>

      {/* Legend */}
      {!canSearch && (
        <div style={{
          padding: '0 18px 14px',
          fontSize: 10.5, color: '#8E8E93', fontWeight: 500, textAlign: 'center',
        }}>
          Enter origin and destination to load prices
        </div>
      )}

      {canSearch && prices.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: '0 18px 14px',
        }}>
          {[
            { color: '#30D158', label: 'Cheap' },
            { color: '#FF9F0A', label: 'Average' },
            { color: '#FF453A', label: 'Expensive' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, opacity: 0.8 }} />
              <span style={{ fontSize: 9.5, color: '#8E8E93', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
