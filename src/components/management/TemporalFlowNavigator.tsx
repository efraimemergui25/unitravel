'use client';

import { useRef, useCallback } from 'react';
import { motion }              from 'framer-motion';
import { useTravelEngine }     from '@/store/useTravelEngine';
import { Plane, Hotel, UtensilsCrossed, Compass, Car } from 'lucide-react';

const AZURE   = '#007AFF';
const EMERALD = '#30D158';
const AMBER   = '#FF9F0A';
const VIOLET  = '#5E5CE6';
const TEAL    = '#00C7BE';

const CAT_COLORS: Record<string, string> = {
  flight: AZURE, hotel: VIOLET, restaurant: AMBER, activity: EMERALD, transport: TEAL,
};
type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const CAT_ICONS: Record<string, LucideIcon> = {
  flight: Plane, hotel: Hotel, restaurant: UtensilsCrossed, activity: Compass, transport: Car,
};

const DEST_GRADIENTS: Record<string, [string, string]> = {
  Paris:          ['#007AFF', '#5E5CE6'],
  Rome:           ['#30D158', '#007AFF'],
  'Riviera Maya': ['#FF9F0A', '#FF453A'],
  'Cabo San Lucas': ['#5E5CE6', '#BF5AF2'],
};

export function TemporalFlowNavigator() {
  const days         = useTravelEngine(s => s.days);
  const activeDay    = useTravelEngine(s => s.activeDay);
  const setActiveDay = useTravelEngine(s => s.setActiveDay);
  const scrollRef    = useRef<HTMLDivElement>(null);

  const scrollToActive = useCallback((id: string) => {
    setActiveDay(id);
    // scroll the active card into center
    const el = scrollRef.current?.querySelector(`[data-day-id="${id}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [setActiveDay]);

  if (days.length < 2) return null;

  const maxEntities = Math.max(...days.map(d => d.entities.length), 1);

  return (
    <div style={{
      position: 'relative', marginBottom: 14,
      borderRadius: 18, overflow: 'hidden',
      background: 'rgba(255,255,255,0.70)',
      backdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: '0 3px 16px rgba(0,0,0,0.04)',
    }}>
      {/* Section title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 6px' }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>Trip Flow</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#8E8E93' }}>{days.length} days</span>
      </div>

      {/* Horizontal scroll rail */}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{
          display: 'flex', gap: 6, overflowX: 'auto', padding: '0 12px 12px',
          scrollSnapType: 'x mandatory',
        }}
      >
        {days.map((day, idx) => {
          const isActive   = activeDay === day.id;
          const destColors = DEST_GRADIENTS[day.destination] ?? [AZURE, VIOLET];
          const fill       = Math.max(0, Math.min(1, day.entities.length / maxEntities));
          const hasMissing = day.entities.length > 0 && !day.entities.some(e => e.category === 'hotel');
          const hasConflict = false; // simplified
          const glowColor  = hasMissing ? AMBER : hasConflict ? '#FF453A' : isActive ? destColors[0] : 'transparent';

          return (
            <motion.div
              key={day.id}
              data-day-id={day.id}
              onClick={() => scrollToActive(day.id)}
              layout
              animate={{
                boxShadow: isActive
                  ? `0 0 0 2px ${destColors[0]}60, 0 6px 20px ${destColors[0]}20`
                  : hasMissing
                  ? `0 0 0 1.5px ${AMBER}40`
                  : '0 2px 8px rgba(0,0,0,0.04)',
                scale: isActive ? 1.04 : 1,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                flexShrink: 0, width: 72, cursor: 'pointer',
                borderRadius: 14, overflow: 'hidden',
                background: isActive
                  ? `linear-gradient(160deg, ${destColors[0]}18, ${destColors[1]}10)`
                  : 'rgba(255,255,255,0.60)',
                border: `1.5px solid ${isActive ? destColors[0] + '40' : 'rgba(255,255,255,0.50)'}`,
                scrollSnapAlign: 'start',
              }}
            >
              {/* Destination color stripe */}
              <div style={{
                height: 3,
                background: `linear-gradient(90deg, ${destColors[0]}, ${destColors[1]})`,
                opacity: isActive ? 1 : 0.40,
              }} />

              <div style={{ padding: '7px 7px 8px' }}>
                {/* Day number */}
                <div style={{
                  fontSize: 16, fontWeight: 900, color: isActive ? destColors[0] : '#1D1D1F',
                  letterSpacing: '-0.04em', lineHeight: 1,
                }}>
                  {day.dayNumber}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.03em', marginTop: 1 }}>
                  {new Date(day.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                </div>

                {/* Fill bar */}
                <div style={{ height: 3, borderRadius: 100, background: 'rgba(0,0,0,0.07)', marginTop: 6, overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${fill * 100}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      height: '100%', borderRadius: 100,
                      background: fill === 0 ? 'transparent' : `linear-gradient(90deg, ${destColors[0]}, ${destColors[1]})`,
                    }}
                  />
                </div>

                {/* Category dots */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 6 }}>
                  {day.entities.slice(0, 6).map(e => {
                    const Icon = (CAT_ICONS[e.category] ?? Compass) as LucideIcon;
                    const col  = CAT_COLORS[e.category] ?? AZURE;
                    return (
                      <div key={e.id} style={{
                        width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                        background: `${col}16`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={8} color={col} strokeWidth={2} />
                      </div>
                    );
                  })}
                  {day.entities.length === 0 && (
                    <div style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 500, fontStyle: 'italic' }}>empty</div>
                  )}
                </div>

                {/* Weather */}
                {(day.weather?.temp ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 4 }}>
                    <span style={{ fontSize: 9 }}>{day.weather.icon}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#6E6E73' }}>{day.weather.temp}°</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Left/right fade gradients */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(to right, rgba(255,255,255,0.70), transparent)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(to left, rgba(255,255,255,0.70), transparent)', pointerEvents: 'none' }} />
    </div>
  );
}
