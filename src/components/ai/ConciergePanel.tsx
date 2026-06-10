'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence }                   from 'framer-motion';
import { useChat }                                   from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage, type DynamicToolUIPart } from 'ai';
import { useRouter }                                 from 'next/navigation';
import { useLocaleEngine }                           from '@/store/useLocaleEngine';
import { useTravelEngine, inferChatCategory }        from '@/store/useTravelEngine';
import { useZoneStore }                              from '@/store/useZoneStore';
import {
  getChatPlaceholder, getSuggestedPrompts,
  getAIIntroMessage, getPersonaLabel,
} from '@/utils/CulturalContextInjector';
import { ExecutionPill }        from './ExecutionPill';
import { ChatHistoryAccordion } from './ChatHistoryAccordion';
import {
  Sparkles, Send, Square, History, ChevronDown,
  GripVertical, Plus, ArrowRight,
  Plane, Hotel, UtensilsCrossed, Compass,
} from 'lucide-react';
import { LocaleToggleCompact } from '@/components/ui/LocaleToggle';
import { PriceWatchPanel }    from '@/components/PriceWatch';

// ── Map tool state ────────────────────────────────────────────────────────────

function toExecState(state: string): 'executing' | 'done' | 'error' {
  if (state === 'output-available')                              return 'done';
  if (state === 'output-error' || state === 'output-denied')    return 'error';
  return 'executing';
}

// ── Types for inline AI search results ───────────────────────────────────────

type SuggestedEntity = {
  title: string; subtitle: string; price: number;
  category: string; dayId: string; reason: string; sourceId?: string;
};

type InlineFlightResult = {
  id: string; airline: string; price: number; pricePerPax: number;
  departure: string; arrival: string; duration: string; stops: string;
  cabin: string; co2?: string; bookingUrl?: string; source: string;
};

type InlineHotelResult = {
  id: string; name: string; pricePerNight: number; totalPrice: number;
  stars: number; address: string; topAmenities: string[]; bookingUrl?: string;
};

type TripDay = { id: string; dayNumber?: number; destination?: string; date?: string };

// ── Day picker dropdown ───────────────────────────────────────────────────────

function DayPickerDropdown({
  days, accentColor, onSelect, onClose,
}: {
  days: TripDay[]; accentColor: string;
  onSelect: (dayId: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 440, damping: 26 }}
      style={{
        position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
        background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(48px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
        border: `1px solid ${accentColor}22`,
        borderRadius: 16, padding: '6px',
        boxShadow: `0 16px 48px rgba(0,0,0,0.16), inset 0 1.5px 0 rgba(255,255,255,1)`,
        zIndex: 300, minWidth: 168,
      }}
    >
      <div style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 700, padding: '4px 11px 7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Add to day
      </div>
      {days.slice(0, 8).map(day => (
        <button
          key={day.id}
          onClick={() => { onSelect(day.id); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', width: '100%', padding: '8px 11px',
            borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 11.5, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit',
            textAlign: 'left', gap: 6,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}0d`; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 10, fontWeight: 800, color: accentColor, minWidth: 44 }}>Day {day.dayNumber ?? ''}</span>
          {day.destination && <span style={{ color: '#AEAEB2', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {day.destination.slice(0, 16)}</span>}
        </button>
      ))}
    </motion.div>
  );
}

// ── Inline flight result card ─────────────────────────────────────────────────

function InlineFlightCard({
  result, index, days, onAddToDay, origin, dest,
}: {
  result: InlineFlightResult; index: number; days: TripDay[];
  onAddToDay: (r: InlineFlightResult, dayId: string) => void;
  origin?: string; dest?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [pickerOpen]);

  const stopsLabel = (['0', 'nonstop', 'direct'].includes(String(result.stops).toLowerCase())) ? 'Nonstop' : result.stops;
  const depTime = result.departure?.match(/\d{2}:\d{2}/)?.[0] ?? result.departure ?? '--';
  const arrTime = result.arrival?.match(/\d{2}:\d{2}/)?.[0] ?? result.arrival ?? '--';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, delay: index * 0.07 }}
      drag dragElastic={0.10} dragMomentum={false}
      whileDrag={{ scale: 1.04, boxShadow: '0 24px 64px rgba(0,122,255,0.24)', zIndex: 999, cursor: 'grabbing' }}
      style={{
        position: 'relative', borderRadius: 18,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(48px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
        border: '1px solid rgba(0,122,255,0.12)',
        boxShadow: '0 4px 28px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
        padding: '14px 15px 11px',
        overflow: 'visible', cursor: 'grab',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2.5, background: 'linear-gradient(90deg, #007AFF, #5E5CE6)', borderRadius: '0 0 3px 3px', opacity: 0.85 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>{result.airline}</span>
            <span style={{ fontSize: 8.5, fontWeight: 600, color: '#C7C7CC', background: 'rgba(0,0,0,0.04)', borderRadius: 4, padding: '1px 5px' }}>{result.source}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
            <div style={{ textAlign: 'center', minWidth: 40 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.035em', lineHeight: 1 }}>{depTime}</div>
              <div style={{ fontSize: 8.5, color: '#AEAEB2', marginTop: 2, fontWeight: 600 }}>{origin ?? ''}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <div style={{ fontSize: 8.5, color: '#6E6E73', fontWeight: 600 }}>{result.duration}</div>
              <div style={{ width: '100%', height: 1.5, background: 'linear-gradient(90deg, rgba(0,122,255,0.15), rgba(0,122,255,0.55), rgba(0,122,255,0.15))', borderRadius: 4, position: 'relative' }}>
                <div style={{ position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)', fontSize: 11, opacity: 0.45 }}>✈</div>
              </div>
              <div style={{ fontSize: 8, fontWeight: 700, color: stopsLabel === 'Nonstop' ? '#30D158' : '#FF9F0A' }}>{stopsLabel}</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: 40 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.035em', lineHeight: 1 }}>{arrTime}</div>
              <div style={{ fontSize: 8.5, color: '#AEAEB2', marginTop: 2, fontWeight: 600 }}>{dest ?? ''}</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, paddingInlineStart: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#007AFF', letterSpacing: '-0.045em', lineHeight: 1 }}>
            ${result.price?.toLocaleString() ?? '—'}
          </div>
          {result.pricePerPax !== result.price && (
            <div style={{ fontSize: 9, color: '#AEAEB2', marginTop: 2 }}>${result.pricePerPax?.toLocaleString()}/pax</div>
          )}
          <div style={{ fontSize: 8.5, color: '#AEAEB2', marginTop: 1 }}>{result.cabin}</div>
          {result.co2 && <div style={{ fontSize: 8, color: '#30D158', fontWeight: 700, marginTop: 3 }}>🌿 {result.co2}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, paddingTop: 9, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
          <GripVertical size={9} color="#C7C7CC" />
          <span style={{ fontSize: 8.5, color: '#C7C7CC', fontWeight: 500 }}>Drag or</span>
        </div>

        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
            onClick={() => setPickerOpen(v => !v)}
            style={{
              fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.20)',
              color: '#007AFF', fontFamily: 'inherit', letterSpacing: '-0.01em',
            }}
          >
            + Add to Day
          </motion.button>
          <AnimatePresence>
            {pickerOpen && <DayPickerDropdown days={days} accentColor="#007AFF" onSelect={id => onAddToDay(result, id)} onClose={() => setPickerOpen(false)} />}
          </AnimatePresence>
        </div>

        {result.bookingUrl && (
          <a href={result.bookingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #007AFF, #5E5CE6)', color: '#fff', textDecoration: 'none', letterSpacing: '-0.01em', boxShadow: '0 3px 12px rgba(0,122,255,0.30)' }}>
            Book →
          </a>
        )}
      </div>
    </motion.div>
  );
}

function InlineFlightCards({ output, days, onAddToDay }: {
  output: { status: string; origin?: string; destination?: string; results?: InlineFlightResult[] };
  days: TripDay[]; onAddToDay: (r: InlineFlightResult, dayId: string) => void;
}) {
  const results = output.results?.slice(0, 5) ?? [];
  if (!results.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingInlineStart: 2 }}>
        <Plane size={10} color="#007AFF" strokeWidth={2.5} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF', letterSpacing: '-0.01em' }}>
          {results.length} flights · {output.origin ?? ''} → {output.destination ?? ''}
        </span>
      </div>
      {results.map((r, i) => (
        <InlineFlightCard key={r.id} result={r} index={i} days={days} onAddToDay={onAddToDay} origin={output.origin} dest={output.destination} />
      ))}
    </div>
  );
}

// ── Inline hotel result card ──────────────────────────────────────────────────

function InlineHotelCard({
  result, index, days, onAddToDay, checkIn, checkOut,
}: {
  result: InlineHotelResult; index: number; days: TripDay[];
  onAddToDay: (r: InlineHotelResult, dayId: string) => void;
  checkIn?: string; checkOut?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [pickerOpen]);

  const stars = Math.min(5, Math.max(1, result.stars ?? 0));

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, delay: index * 0.07 }}
      drag dragElastic={0.10} dragMomentum={false}
      whileDrag={{ scale: 1.04, boxShadow: '0 24px 64px rgba(94,92,230,0.24)', zIndex: 999, cursor: 'grabbing' }}
      style={{
        position: 'relative', borderRadius: 18,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(48px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
        border: '1px solid rgba(94,92,230,0.12)',
        boxShadow: '0 4px 28px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
        padding: '14px 15px 11px',
        overflow: 'visible', cursor: 'grab',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2.5, background: 'linear-gradient(90deg, #5E5CE6, #BF5AF2)', borderRadius: '0 0 3px 3px', opacity: 0.85 }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: '#FF9F0A', letterSpacing: '-0.01em', fontWeight: 700, lineHeight: 1 }}>{'★'.repeat(stars)}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em', marginTop: 3, lineHeight: 1.25 }}>{result.name}</div>
          {result.address && <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {result.address}</div>}
          {result.topAmenities?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
              {result.topAmenities.slice(0, 5).map((a, ai) => (
                <span key={ai} style={{ fontSize: 8.5, fontWeight: 600, color: '#5E5CE6', background: 'rgba(94,92,230,0.07)', border: '1px solid rgba(94,92,230,0.16)', borderRadius: 6, padding: '2px 7px' }}>{a}</span>
              ))}
            </div>
          )}
          {(checkIn || checkOut) && (
            <div style={{ marginTop: 7, fontSize: 9, color: '#6E6E73', background: 'rgba(94,92,230,0.05)', borderRadius: 7, padding: '4px 9px', display: 'inline-flex', gap: 7 }}>
              {checkIn && <span>In {checkIn}</span>}{checkIn && checkOut && <span>·</span>}{checkOut && <span>Out {checkOut}</span>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, paddingInlineStart: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#5E5CE6', letterSpacing: '-0.045em', lineHeight: 1 }}>
            ${result.pricePerNight?.toLocaleString() ?? '—'}
          </div>
          <div style={{ fontSize: 8.5, color: '#AEAEB2', marginTop: 2 }}>/ night</div>
          {result.totalPrice > result.pricePerNight && (
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#1D1D1F', marginTop: 4 }}>${result.totalPrice?.toLocaleString()} total</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, paddingTop: 9, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
          <GripVertical size={9} color="#C7C7CC" />
          <span style={{ fontSize: 8.5, color: '#C7C7CC', fontWeight: 500 }}>Drag or</span>
        </div>

        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
            onClick={() => setPickerOpen(v => !v)}
            style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 10, cursor: 'pointer', background: 'rgba(94,92,230,0.07)', border: '1px solid rgba(94,92,230,0.20)', color: '#5E5CE6', fontFamily: 'inherit', letterSpacing: '-0.01em' }}
          >
            + Add to Day
          </motion.button>
          <AnimatePresence>
            {pickerOpen && <DayPickerDropdown days={days} accentColor="#5E5CE6" onSelect={id => onAddToDay(result, id)} onClose={() => setPickerOpen(false)} />}
          </AnimatePresence>
        </div>

        {result.bookingUrl && (
          <a href={result.bookingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #5E5CE6, #BF5AF2)', color: '#fff', textDecoration: 'none', letterSpacing: '-0.01em', boxShadow: '0 3px 12px rgba(94,92,230,0.30)' }}>
            Book →
          </a>
        )}
      </div>
    </motion.div>
  );
}

function InlineHotelCards({ output, days, onAddToDay }: {
  output: { status: string; cityCode?: string; checkIn?: string; checkOut?: string; results?: InlineHotelResult[] };
  days: TripDay[]; onAddToDay: (r: InlineHotelResult, dayId: string) => void;
}) {
  const results = output.results?.slice(0, 5) ?? [];
  if (!results.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingInlineStart: 2 }}>
        <Hotel size={10} color="#5E5CE6" strokeWidth={2.5} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#5E5CE6', letterSpacing: '-0.01em' }}>
          {results.length} hotels{output.cityCode ? ` · ${output.cityCode}` : ''}{(output.checkIn && output.checkOut) ? ` · ${output.checkIn}–${output.checkOut}` : ''}
        </span>
      </div>
      {results.map((r, i) => (
        <InlineHotelCard key={r.id} result={r} index={i} days={days} onAddToDay={onAddToDay} checkIn={output.checkIn} checkOut={output.checkOut} />
      ))}
    </div>
  );
}

// ── Commit success card ───────────────────────────────────────────────────────

function CommitSuccessCard({ title, subtitle, dayId, category, price }: {
  title: string; subtitle?: string; dayId?: string; category?: string; price?: number;
}) {
  const icon = category === 'hotel' ? <Hotel size={14} color="#30D158" strokeWidth={2} />
             : category === 'restaurant' ? <UtensilsCrossed size={14} color="#30D158" strokeWidth={2} />
             : category === 'activity' ? <Compass size={14} color="#30D158" strokeWidth={2} />
             : <Plane size={14} color="#30D158" strokeWidth={2} />;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 460, damping: 24 }}
      style={{
        borderRadius: 16, maxWidth: '88%',
        background: 'linear-gradient(135deg, rgba(48,209,88,0.08) 0%, rgba(0,199,190,0.05) 100%)',
        border: '1.5px solid rgba(48,209,88,0.24)',
        boxShadow: '0 4px 22px rgba(48,209,88,0.14), inset 0 1.5px 0 rgba(255,255,255,0.95)',
        padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: 11,
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 11, background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#30D158', letterSpacing: '-0.01em' }}>✓ Added to timeline</span>
          {dayId && <span style={{ fontSize: 9, color: '#6E6E73', background: 'rgba(0,0,0,0.05)', borderRadius: 5, padding: '1px 6px' }}>Day {dayId.replace(/[^0-9]/g, '')}</span>}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.015em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 1 }}>{subtitle}</div>}
        {price !== undefined && price > 0 && <div style={{ fontSize: 10.5, fontWeight: 800, color: '#30D158', marginTop: 3, letterSpacing: '-0.02em' }}>${price?.toLocaleString()}</div>}
      </div>
    </motion.div>
  );
}

// ── Draggable entity card (legacy — from mutateTimeline) ──────────────────────

function DraggableEntityCard({ entity, onPlace }: { entity: SuggestedEntity; onPlace: (e: SuggestedEntity) => void }) {
  const catColor = entity.category === 'hotel' ? '#5E5CE6' : entity.category === 'restaurant' ? '#FF9F0A' : entity.category === 'activity' ? '#30D158' : '#007AFF';
  return (
    <motion.div
      drag dragElastic={0.13} dragMomentum={false}
      whileDrag={{ scale: 1.04, boxShadow: `0 18px 52px ${catColor}33`, zIndex: 999 }}
      onDragEnd={() => onPlace(entity)}
      style={{
        padding: '12px 14px', borderRadius: 16,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        border: `1px solid ${catColor}1a`,
        boxShadow: `0 4px 22px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,1)`,
        cursor: 'grab', maxWidth: '92%', position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 2, background: `linear-gradient(90deg, ${catColor}, ${catColor}88)`, borderRadius: '0 0 3px 3px', opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
        <GripVertical size={11} color="#C7C7CC" style={{ flexShrink: 0 }} />
        <div style={{ width: 30, height: 30, borderRadius: 10, background: `${catColor}12`, border: `1px solid ${catColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {entity.category === 'hotel'      ? <Hotel size={13} color="#5E5CE6" strokeWidth={2} />
         : entity.category === 'restaurant' ? <UtensilsCrossed size={13} color="#FF9F0A" strokeWidth={2} />
         : entity.category === 'activity'   ? <Compass size={13} color="#30D158" strokeWidth={2} />
         :                                    <Plane size={13} color="#007AFF" strokeWidth={2} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity.title}</div>
          <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 1.5 }}>{entity.subtitle}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: catColor, flexShrink: 0, letterSpacing: '-0.03em' }}>${entity.price.toLocaleString()}</div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <span style={{ fontSize: 9, color: '#C7C7CC', flex: 1 }}>Drag to plan or</span>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
          onClick={() => onPlace(entity)}
          style={{ fontSize: 9.5, fontWeight: 700, padding: '4px 11px', borderRadius: 9, cursor: 'pointer', background: `${catColor}0f`, border: `1px solid ${catColor}28`, color: catColor, fontFamily: 'inherit', letterSpacing: '-0.01em' }}
        >
          Add to Day {entity.dayId.replace('day-', '')}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function renderRichText(text: string, isUser: boolean): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    // Bold: **text**
    const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = boldParts.map((part, pi) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pi} style={{ fontWeight: 800, color: isUser ? 'rgba(255,255,255,0.96)' : '#1D1D1F' }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={pi}>{part}</span>;
    });
    // Bullet point lines
    const isBullet = line.match(/^[-•*]\s+/);
    const isNumbered = line.match(/^\d+\.\s+/);
    if (isBullet) {
      const content = line.replace(/^[-•*]\s+/, '');
      const contentParts = content.split(/(\*\*[^*]+\*\*)/g).map((p, pi) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={pi} style={{ fontWeight: 800 }}>{p.slice(2, -2)}</strong>
          : <span key={pi}>{p}</span>
      );
      return (
        <div key={li} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBlock: '3px' }}>
          <span style={{ flexShrink: 0, marginTop: 2, fontSize: 8, opacity: 0.55 }}>●</span>
          <span>{contentParts}</span>
        </div>
      );
    }
    if (isNumbered) {
      const match = line.match(/^(\d+)\.\s+(.*)/);
      const num = match?.[1]; const rest = match?.[2] ?? '';
      const restParts = rest.split(/(\*\*[^*]+\*\*)/g).map((p, pi) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={pi} style={{ fontWeight: 800 }}>{p.slice(2, -2)}</strong>
          : <span key={pi}>{p}</span>
      );
      return (
        <div key={li} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBlock: '3px' }}>
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, opacity: 0.6, minWidth: 16 }}>{num}.</span>
          <span>{restParts}</span>
        </div>
      );
    }
    return (
      <span key={li}>
        {li > 0 && <br />}
        {rendered}
      </span>
    );
  });
}

function MessageBubble({ text, isUser, isHe }: { text: string; isUser: boolean; isHe: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      style={{
        maxWidth: '90%',
        padding: isUser ? '11px 15px' : '12px 15px',
        borderRadius: isUser ? '20px 20px 6px 20px' : '6px 20px 20px 20px',
        position: 'relative',
        ...(isUser ? {
          background: 'linear-gradient(142deg, #007AFF 0%, #5E5CE6 58%, #7B78F0 100%)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 6px 24px rgba(0,122,255,0.40), 0 2px 6px rgba(0,122,255,0.18), inset 0 1.5px 0 rgba(255,255,255,0.24)',
        } : {
          background: 'linear-gradient(158deg, rgba(255,255,255,0.94) 0%, rgba(246,248,255,0.90) 100%)',
          backdropFilter: 'blur(40px) saturate(1.9)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
          border: '1px solid rgba(255,255,255,0.90)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
        }),
        fontSize: 12.5,
        lineHeight: 1.7,
        fontWeight: isUser ? 500 : 450,
        color: isUser ? '#fff' : '#1D1D1F',
        letterSpacing: '-0.01em',
        direction: isHe ? 'rtl' : 'ltr',
      }}
    >
      {/* Specular shimmer on AI bubbles */}
      {!isUser && (
        <div style={{
          position: 'absolute', left: '8%', right: '8%', top: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
          borderRadius: '999px', pointerEvents: 'none',
        }} />
      )}
      {/* User message sparkle top-right */}
      {isUser && (
        <div style={{
          position: 'absolute', insetInlineEnd: 10, top: 8, opacity: 0.22, pointerEvents: 'none',
          fontSize: 10,
        }}>✦</div>
      )}
      {renderRichText(text, isUser)}
    </motion.div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingInlineStart: 2 }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ y: [0, -5, 0], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 0.75, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,122,255,0.45)' }}
        />
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

const AZURE  = '#007AFF';
const SPRING = { type: 'spring', stiffness: 280, damping: 28 } as const;

export function ConciergePanel({ fitParent = false, currentZone }: { fitParent?: boolean; currentZone?: string }) {
  const router           = useRouter();
  const { profile }      = useLocaleEngine();
  const locale           = profile.locale;
  const isHe             = locale === 'he-IL';
  const [inputVal, setInputVal]           = useState('');
  const [focused, setFocused]             = useState(false);
  const [historyOpen, setHistoryOpen]     = useState(false);
  const messagesEndRef                    = useRef<HTMLDivElement>(null);
  const navigatedRef                      = useRef(new Set<string>());
  const syncedMsgIds                      = useRef(new Set<string>());
  const appliedToolCalls                  = useRef(new Set<string>());
  const addChatMessage                    = useTravelEngine(s => s.addChatMessage);
  const placeEntity                       = useTravelEngine(s => s.placeEntity);
  const calculatePredictiveBudget         = useTravelEngine(s => s.calculatePredictiveBudget);
  const patchDNA                          = useTravelEngine(s => s.patchDNA);
  const trip                              = useTravelEngine(s => s.trip);
  const budget                            = useTravelEngine(s => s.budget);
  const dnaProfile                        = useTravelEngine(s => s.dnaProfile);
  const activeDay                         = useTravelEngine(s => s.activeDay);
  const zoneSelectedIds                   = useZoneStore(s => s.selectedIds);
  const days                              = useTravelEngine(s => s.days);

  const uniqueDestinations = [...new Set(days.map(d => d.destination))].filter(Boolean);
  const tripContext = {
    tripTitle:   trip.title || 'New Trip',
    travelers:   trip.travelers,
    destination: uniqueDestinations[0] ?? '',
    startDate:   trip.startDate,
    endDate:     trip.endDate,
    budget:      { total: budget.total, spent: budget.spent, burnRate: budget.burnRate, projected: budget.projected, overBudgetBy: budget.overBudgetBy },
    dnaProfile,
    activeDay,
    locale,
    currentZone,
    // Live engine selections from useZoneStore — concierge searches exactly these
    selectedEngines: {
      flights:     zoneSelectedIds('flights'),
      hotels:      zoneSelectedIds('lodging'),
      dining:      zoneSelectedIds('dining'),
      attractions: zoneSelectedIds('attractions'),
      transit:     zoneSelectedIds('transit'),
    },
  };

  const placeholder  = getChatPlaceholder(locale);
  const introMessage = getAIIntroMessage(locale);
  const persona      = getPersonaLabel(locale);

  // Dynamic prompts based on actual trip state
  const suggestedPrompts = useMemo(() => {
    const dest = uniqueDestinations[0] ?? trip.title;
    const totalEntities = days.reduce((s, d) => s + d.entities.length, 0);
    const bookedEntities = days.flatMap(d => d.entities).filter(e => e.booked).length;

    if (!dest) {
      return isHe
        ? ['איפה כדאי לנסוע בקיץ?', 'עזור לי לתכנן טיול', 'מה הטיסות הזולות ביותר?']
        : ['Where should I travel this summer?', 'Help me plan a trip', 'Cheapest flights this month'];
    }
    if (totalEntities === 0) {
      return isHe
        ? [`מצא טיסות ל${dest}`, `מלונות מומלצים ב${dest}`, `מה חובה לעשות ב${dest}?`]
        : [`Find flights to ${dest}`, `Best hotels in ${dest}`, `Top things to do in ${dest}`];
    }
    if (bookedEntities < totalEntities) {
      return isHe
        ? [`מה עוד חסר לי ב${dest}?`, 'אילו פריטים כדאי להזמין עכשיו?', 'האם אני בתוך התקציב?']
        : [`What am I missing in ${dest}?`, 'What should I book now?', 'Am I within budget?'];
    }
    return isHe
      ? [`מה ההמלצות האחרונות ל${dest}?`, 'כמה יצא הטיול?', 'הכן לי רשימת אריזה']
      : [`Latest tips for ${dest}`, 'How much will this trip cost?', 'Build me a packing list'];
  }, [uniqueDestinations, trip.title, days, isHe]);

  const { messages, sendMessage, status, stop } = useChat<UIMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat', body: { context: tripContext } }),
    messages: [{
      id:    'aria-intro',
      role:  'assistant' as const,
      parts: [{ type: 'text' as const, text: introMessage }],
    }] as UIMessage[],
  });

  const isGenerating = status === 'streaming' || status === 'submitted';

  // Navigate from AI tool calls
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'dynamic-tool') continue;
        const dp = part as DynamicToolUIPart;
        if (dp.toolName === 'navigateWorkspace' && dp.state === 'output-available' && !navigatedRef.current.has(dp.toolCallId)) {
          navigatedRef.current.add(dp.toolCallId);
          const output = dp.output as { zoneId: string };
          setTimeout(() => router.push(`/zone/${output.zoneId}`), 400);
        }
      }
    }
  }, [messages, router]);

  // Apply AI tool results to store
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'dynamic-tool') continue;
        const dp = part as DynamicToolUIPart;
        if (dp.state !== 'output-available') continue;
        if (appliedToolCalls.current.has(dp.toolCallId)) continue;
        appliedToolCalls.current.add(dp.toolCallId);
        if (dp.toolName === 'adjustFinancialModel') calculatePredictiveBudget();
        if (dp.toolName === 'adjustDNA') {
          const output = dp.output as { field: string; value: number } | undefined;
          if (output?.field && typeof output.value === 'number') patchDNA(output.field, output.value);
        }
        // commitToTimeline — generic entity placement
        if (dp.toolName === 'commitToTimeline') {
          const out = dp.output as { committed: boolean; targetDayId: string; category: string; title: string; subtitle: string; price: number; time?: string; duration?: string; reason: string } | undefined;
          if (out?.committed && out.targetDayId) {
            const base = { id: `ai-commit-${Date.now()}`, sources: ['AI Concierge'], sourceCount: 1, aiConfidence: 0.95, tags: [] as string[], destination: '' };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let source: any;
            if (out.category === 'hotel') {
              source = { ...base, category: 'hotel', name: out.title, location: out.subtitle, tier: 'Ultra-Luxury', roomType: 'Standard', pricePerNight: out.price, totalPrice: out.price, nights: 1, rating: 4.8, reviewCount: 0, sentiment: { positive: 0.9, neutral: 0.08, negative: 0.02, compound: 0.88 }, amenities: [] as string[], aiHighlight: out.reason };
            } else if (out.category === 'restaurant') {
              source = { ...base, category: 'restaurant', name: out.title, cuisine: out.subtitle, location: '', pricePerPerson: out.price, rating: 4.8, sentiment: { positive: 0.9, neutral: 0.08, negative: 0.02, compound: 0.88 }, reservationWindow: 'Same day', uberMinutes: 10, uberCost: 15, aiHighlight: out.reason };
            } else if (out.category === 'activity' || out.category === 'transport') {
              source = { ...base, category: 'activity', title: out.title, location: out.subtitle, type: out.category, durationHours: 2, pricePerPerson: out.price, rating: 4.8, difficulty: 'easy', bestTimeOfDay: 'morning', aiHighlight: out.reason };
            } else {
              source = { ...base, category: 'flight', airline: out.title, route: out.subtitle, origin: '', flightNumber: '', departure: out.time ?? '10:00', arrival: '12:00', durationMin: 120, durationLabel: out.duration ?? '2h', stops: 0, class: 'Economy', price: out.price, priceRange: [out.price, out.price] as [number, number], carbonKg: 0, carbonLabel: '', carbonAlternative: out.reason, priceDropProbability: 0, seats: 5, refundable: false };
            }
            placeEntity(out.targetDayId, source);
          }
        }
        // commitLodgingToTimeline — hotel-specific placement
        if (dp.toolName === 'commitLodgingToTimeline') {
          const out = dp.output as { committed: boolean; category: string; hotelName: string; price: number; targetDay: string; roomType?: string; nights?: number; totalPrice: number; reason: string } | undefined;
          if (out?.committed && out.targetDay) {
            const nights = out.nights ?? 1;
            const source = {
              id: `ai-hotel-${Date.now()}`, category: 'hotel' as const,
              name: out.hotelName, location: '', tier: 'Ultra-Luxury' as const,
              roomType: out.roomType ?? 'Standard',
              pricePerNight: out.price, totalPrice: out.totalPrice ?? out.price * nights,
              nights, rating: 4.9, reviewCount: 0,
              sentiment: { positive: 0.92, neutral: 0.06, negative: 0.02, compound: 0.90 },
              amenities: [] as string[], aiHighlight: out.reason,
              sources: ['AI Concierge'], sourceCount: 1, aiConfidence: 0.95,
              tags: [] as string[], destination: '',
            };
            placeEntity(out.targetDay, source);
          }
        }
      }
    }
  }, [messages, calculatePredictiveBudget, patchDNA, placeEntity]);

  const handlePlace = useCallback((entity: SuggestedEntity) => {
    const storeState = useTravelEngine.getState();
    if (!storeState.days.some(d => d.id === entity.dayId)) return;
    const base = {
      id: entity.sourceId ?? `ai-placed-${Date.now()}`,
      sources: ['AI Concierge'], sourceCount: 1, aiConfidence: 0.9, tags: [] as string[], destination: '',
    };
    const cat = entity.category;
    // Build a shape that matches what placeEntity expects for each category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let syntheticSource: any;
    if (cat === 'hotel') {
      syntheticSource = {
        ...base, category: 'hotel', name: entity.title, location: entity.subtitle,
        tier: 'Ultra-Luxury', roomType: 'Standard', pricePerNight: entity.price,
        totalPrice: entity.price, nights: 1, rating: 4.5, reviewCount: 0,
        sentiment: { positive: 0.8, neutral: 0.15, negative: 0.05, compound: 0.75 },
        amenities: [] as string[], aiHighlight: entity.reason,
      };
    } else if (cat === 'restaurant') {
      syntheticSource = {
        ...base, category: 'restaurant', name: entity.title, cuisine: entity.subtitle,
        location: '', pricePerPerson: entity.price, rating: 4.5,
        sentiment: { positive: 0.8, neutral: 0.15, negative: 0.05, compound: 0.75 },
        reservationWindow: 'Same day', uberMinutes: 10, uberCost: 15, aiHighlight: entity.reason,
      };
    } else if (cat === 'activity' || cat === 'transport') {
      syntheticSource = {
        ...base, category: 'activity', title: entity.title, location: entity.subtitle,
        type: cat === 'transport' ? 'transport' : 'activity', durationHours: 2,
        pricePerPerson: entity.price, rating: 4.5, difficulty: 'easy',
        bestTimeOfDay: 'morning', aiHighlight: entity.reason,
      };
    } else {
      syntheticSource = {
        ...base, category: 'flight', airline: entity.title, route: entity.subtitle,
        origin: '', flightNumber: '', departure: '10:00', arrival: '12:00',
        durationMin: 0, durationLabel: '', stops: 0, class: 'Economy', price: entity.price,
        priceRange: [entity.price, entity.price], carbonKg: 0, carbonLabel: '',
        carbonAlternative: entity.reason, priceDropProbability: 0, seats: 0, refundable: false,
      };
    }
    placeEntity(entity.dayId, syntheticSource as Parameters<typeof placeEntity>[1]);
  }, [placeEntity]);

  // Add inline flight to timeline
  const handleAddFlightToDay = useCallback((result: InlineFlightResult, dayId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source: any = {
      id: `ai-flight-${result.id ?? Date.now()}`,
      category: 'flight',
      airline: result.airline,
      route: `${result.departure ?? ''} → ${result.arrival ?? ''}`,
      origin: '', flightNumber: '',
      departure: result.departure?.match(/\d{2}:\d{2}/)?.[0] ?? '10:00',
      arrival: result.arrival?.match(/\d{2}:\d{2}/)?.[0] ?? '12:00',
      durationMin: 0, durationLabel: result.duration ?? '',
      stops: isNaN(Number(result.stops)) ? 0 : Number(result.stops),
      class: result.cabin ?? 'Economy',
      price: result.price, priceRange: [result.price, result.price] as [number, number],
      carbonKg: 0, carbonLabel: result.co2 ?? '', carbonAlternative: '',
      priceDropProbability: 0, seats: 5, refundable: false,
      sources: [result.source ?? 'AI Search'], sourceCount: 1, aiConfidence: 0.9,
      tags: [] as string[], destination: '',
    };
    placeEntity(dayId, source as Parameters<typeof placeEntity>[1]);
  }, [placeEntity]);

  // Add inline hotel to timeline
  const handleAddHotelToDay = useCallback((result: InlineHotelResult, dayId: string) => {
    const tier = result.stars >= 5 ? 'Ultra-Luxury' as const
               : result.stars >= 4 ? '4★' as const
               : result.stars >= 3 ? '3★' as const
               : '3★' as const;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source: any = {
      id: `ai-hotel-${result.id ?? Date.now()}`,
      category: 'hotel',
      name: result.name, location: result.address ?? '',
      tier, roomType: 'Standard',
      pricePerNight: result.pricePerNight, totalPrice: result.totalPrice ?? result.pricePerNight,
      nights: Math.max(1, Math.round((result.totalPrice ?? result.pricePerNight) / (result.pricePerNight || 1))),
      rating: result.stars ?? 4, reviewCount: 0,
      sentiment: { positive: 0.88, neutral: 0.09, negative: 0.03, compound: 0.85 },
      amenities: result.topAmenities ?? [] as string[],
      aiHighlight: `${result.stars}★ hotel · ${result.address ?? ''}`,
      sources: ['AI Search'], sourceCount: 1, aiConfidence: 0.9,
      tags: [] as string[], destination: '',
    };
    placeEntity(dayId, source as Parameters<typeof placeEntity>[1]);
  }, [placeEntity]);

  // Typed days for inline card components
  const tripDays: TripDay[] = useMemo(() =>
    days.map((d, i) => ({ id: d.id, dayNumber: i + 1, destination: d.destination, date: d.date })),
    [days]
  );

  // Sync chat to store
  useEffect(() => {
    for (const msg of messages) {
      if (msg.id === 'aria-intro' || syncedMsgIds.current.has(msg.id)) continue;
      if (msg.role !== 'user' && msg.role !== 'assistant') continue;
      const text = msg.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join(' ').trim();
      if (!text) continue;
      const toolsUsed = msg.role === 'assistant' ? msg.parts.filter((p): p is DynamicToolUIPart => p.type === 'dynamic-tool').map(p => (p as DynamicToolUIPart).toolName) : [];
      syncedMsgIds.current.add(msg.id);
      addChatMessage({ id: msg.id, sessionId: 'session-' + Date.now().toString(36), role: msg.role as 'user' | 'assistant', text, category: inferChatCategory(text, toolsUsed), toolsUsed: toolsUsed.length ? toolsUsed : undefined });
    }
  }, [messages, addChatMessage]);

  // Auto-scroll
  useEffect(() => {
    if (!historyOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, historyOpen]);

  // Pick up AI prompt injected from other components (e.g. AI Gap Filler)
  useEffect(() => {
    const injected = sessionStorage.getItem('unitravel-ai-prompt');
    if (injected && !isGenerating) {
      sessionStorage.removeItem('unitravel-ai-prompt');
      setTimeout(() => {
        sendMessage({ text: injected });
      }, 600);
    }
  }, []); // eslint-disable-line

  const onSend = useCallback(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || isGenerating) return;
    sendMessage({ text: trimmed });
    setInputVal('');
  }, [inputVal, isGenerating, sendMessage]);

  return (
    <div
      style={{
        flex:          fitParent ? '1 1 auto' : undefined,
        width:         fitParent ? undefined : '100%',
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflow:      'hidden',
        position:      'relative',
      }}
    >
      {/* ── Specular top line ─────────────────────────────────────── */}
      <div aria-hidden style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.9) 60%, transparent 95%)',
        zIndex: 2,
      }} />

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{
        padding:      '14px 16px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.045)',
        flexShrink:   0,
        background:   'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.10) 100%)',
        position:     'relative',
      }}>
        {/* Header ambient glow */}
        <div aria-hidden style={{
          position:   'absolute',
          top:        0,
          left:       '10%',
          right:      '10%',
          height:     '40%',
          background: 'radial-gradient(ellipse, rgba(0,122,255,0.07) 0%, transparent 70%)',
          pointerEvents:'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {/* AI avatar — premium orb */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {/* Outer pulse ring */}
              <motion.div
                style={{
                  position:    'absolute',
                  inset:       -5,
                  borderRadius: '50%',
                  border:      '1.5px solid rgba(0,122,255,0.22)',
                }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                animate={isGenerating ? {
                  boxShadow: [
                    '0 4px 20px rgba(0,122,255,0.38), inset 0 1.5px 0 rgba(255,255,255,0.35)',
                    '0 6px 32px rgba(94,92,230,0.50), inset 0 1.5px 0 rgba(255,255,255,0.35)',
                    '0 4px 20px rgba(191,90,242,0.38), inset 0 1.5px 0 rgba(255,255,255,0.35)',
                    '0 4px 20px rgba(0,122,255,0.38), inset 0 1.5px 0 rgba(255,255,255,0.35)',
                  ],
                } : {
                  boxShadow: '0 4px 18px rgba(0,122,255,0.34), inset 0 1.5px 0 rgba(255,255,255,0.30)',
                }}
                transition={{ duration: 2.8, repeat: isGenerating ? Infinity : 0 }}
                style={{
                  width:          44,
                  height:         44,
                  borderRadius:   14,
                  background:     'linear-gradient(138deg, #007AFF 0%, #5E5CE6 52%, #BF5AF2 100%)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  border:         '1px solid rgba(255,255,255,0.28)',
                  position:       'relative',
                  overflow:       'hidden',
                }}
              >
                {/* Specular shimmer — shimmer-x translates the element left→right */}
                <div style={{
                  position:   'absolute',
                  top:        0,
                  left:       0,
                  width:      '55%',
                  height:     '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)',
                  animation:  'shimmer-x 3.8s ease-in-out infinite',
                  animationDelay: '1.4s',
                  pointerEvents: 'none',
                }} />
                {/* Corner refraction */}
                <div style={{
                  position:   'absolute',
                  top:        0,
                  left:       0,
                  width:      '50%',
                  height:     '50%',
                  background: 'radial-gradient(ellipse at 0% 0%, rgba(255,255,255,0.22) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }} />
                <Sparkles size={19} color="#fff" strokeWidth={1.8} style={{ position: 'relative', zIndex: 1 }} />
              </motion.div>

              {/* Status dot */}
              <motion.div
                style={{
                  position:   'absolute',
                  bottom:     -1,
                  right:      -1,
                  width:      11,
                  height:     11,
                  borderRadius: '50%',
                  background: isGenerating ? '#FF9F0A' : '#30D158',
                  border:     '2px solid rgba(255,255,255,0.95)',
                  boxShadow:  `0 0 8px ${isGenerating ? 'rgba(255,159,10,0.60)' : 'rgba(48,209,88,0.50)'}`,
                }}
                animate={{ scale: isGenerating ? [1, 1.25, 1] : 1 }}
                transition={{ duration: 0.8, repeat: isGenerating ? Infinity : 0 }}
              />
            </div>

            <div>
              <div style={{
                fontSize:      14,
                fontWeight:    800,
                letterSpacing: '-0.028em',
                background:    'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}>
                {persona.name}
              </div>
              <div style={{ fontSize: 10, color: '#AEAEB2', fontWeight: 500, marginTop: 1.5, letterSpacing: '-0.01em' }}>
                {persona.tagline}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* History toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
              onClick={() => setHistoryOpen(v => !v)}
              title="Chat history"
              aria-label="Chat history"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                background:    historyOpen ? 'rgba(0,122,255,0.09)' : 'rgba(0,0,0,0.04)',
                border:        historyOpen ? '1px solid rgba(0,122,255,0.22)' : '1px solid rgba(0,0,0,0.07)',
                color:         historyOpen ? AZURE : '#6E6E73',
                fontSize:      10, fontWeight: 700, letterSpacing: '-0.01em',
                fontFamily:    'inherit', transition: 'all 0.18s ease',
              }}
            >
              <History size={11} strokeWidth={2} />
              History
            </motion.button>

            {/* Locale toggle */}
            <LocaleToggleCompact />

            {/* Live status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div className="pulse-dot" />
              <span style={{ fontSize: 10, fontWeight: 600, color: '#30D158', letterSpacing: '-0.01em' }}>Live</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── History accordion ──────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {historyOpen && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <ChatHistoryAccordion />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Price Watch panel ─────────────────────────────────────── */}
      {!historyOpen && (
        <div style={{
          borderRadius: 12, margin: '0 8px 4px',
          background: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,0,0,0.06)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <PriceWatchPanel />
        </div>
      )}

      {/* ── Message thread ─────────────────────────────────────────── */}
      <div
        className="scroll-fade"
        style={{
          flex:       historyOpen ? 0 : 1,
          display:    historyOpen ? 'none' : 'flex',
          flexDirection: 'column',
          overflowY:  'auto',
          padding:    '12px 14px',
          gap:        10,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.08) transparent',
        }}
      >
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
              gap: 6,
            }}>
              {msg.parts.map((part, pi) => {
                if (part.type === 'text') {
                  return <MessageBubble key={pi} text={part.text} isUser={isUser} isHe={isHe} />;
                }
                if (part.type === 'dynamic-tool') {
                  const dp    = part as DynamicToolUIPart;
                  const state = toExecState(dp.state);

                  // ── Inline flight search results ──────────────────────
                  if (dp.toolName === 'searchFlightsInline' && state === 'done') {
                    const out = dp.output as { status: string; origin?: string; destination?: string; results?: InlineFlightResult[] } | undefined;
                    if (out?.results && out.results.length > 0) {
                      return (
                        <div key={dp.toolCallId} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                          <ExecutionPill toolName={dp.toolName} args={(dp.input ?? {}) as Record<string, unknown>} state={state} result={dp.output} />
                          <InlineFlightCards output={out} days={tripDays} onAddToDay={handleAddFlightToDay} />
                        </div>
                      );
                    }
                  }

                  // ── Inline hotel search results ───────────────────────
                  if (dp.toolName === 'searchHotelsInline' && state === 'done') {
                    const out = dp.output as { status: string; cityCode?: string; checkIn?: string; checkOut?: string; results?: InlineHotelResult[] } | undefined;
                    if (out?.results && out.results.length > 0) {
                      return (
                        <div key={dp.toolCallId} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                          <ExecutionPill toolName={dp.toolName} args={(dp.input ?? {}) as Record<string, unknown>} state={state} result={dp.output} />
                          <InlineHotelCards output={out} days={tripDays} onAddToDay={handleAddHotelToDay} />
                        </div>
                      );
                    }
                  }

                  // ── Commit success confirmation ────────────────────────
                  if ((dp.toolName === 'commitToTimeline' || dp.toolName === 'commitLodgingToTimeline') && state === 'done') {
                    const out = dp.output as { committed?: boolean; title?: string; hotelName?: string; subtitle?: string; targetDayId?: string; targetDay?: string; category?: string; price?: number; reason?: string } | undefined;
                    if (out?.committed) {
                      const title = out.title ?? out.hotelName ?? '';
                      const dayId = out.targetDayId ?? out.targetDay ?? '';
                      return (
                        <div key={dp.toolCallId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <ExecutionPill toolName={dp.toolName} args={(dp.input ?? {}) as Record<string, unknown>} state={state} result={dp.output} />
                          <CommitSuccessCard title={title} subtitle={out.subtitle ?? out.reason} dayId={dayId} category={out.category} price={out.price} />
                        </div>
                      );
                    }
                  }

                  // ── mutateTimeline with DnD card ──────────────────────
                  if (dp.toolName === 'mutateTimeline' && state === 'done') {
                    const res = dp.output as { requiresConfirmation: boolean; entity: SuggestedEntity } | undefined;
                    if (res?.requiresConfirmation && res.entity) {
                      return (
                        <div key={dp.toolCallId} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <ExecutionPill toolName={dp.toolName} args={(dp.input ?? {}) as Record<string, unknown>} state={state} result={dp.output} />
                          <DraggableEntityCard entity={res.entity} onPlace={handlePlace} />
                        </div>
                      );
                    }
                  }

                  // ── Default: execution pill ───────────────────────────
                  return (
                    <ExecutionPill
                      key={dp.toolCallId}
                      toolName={dp.toolName}
                      args={(dp.input ?? {}) as Record<string, unknown>}
                      state={state}
                      result={state === 'done' ? dp.output : undefined}
                    />
                  );
                }
                return null;
              })}
            </div>
          );
        })}

        <AnimatePresence>
          {isGenerating && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px 18px', borderTop: '1px solid rgba(0,0,0,0.04)', flexShrink: 0 }}>
        <motion.div
          animate={{
            boxShadow: focused
              ? `0 0 0 2.5px rgba(0,122,255,0.16), 0 4px 20px rgba(0,122,255,0.10)`
              : '0 2px 8px rgba(0,0,0,0.04)',
            borderColor: focused ? 'rgba(0,122,255,0.22)' : 'rgba(0,0,0,0.08)',
          }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(248,248,252,0.92)',
            border: '1.5px solid rgba(0,0,0,0.08)',
            borderRadius: 16, padding: '10px 12px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            placeholder={placeholder}
            disabled={isGenerating}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 12.5, fontWeight: 500, color: '#1D1D1F',
              letterSpacing: '-0.01em', direction: isHe ? 'rtl' : 'ltr',
              fontFamily: 'inherit',
            }}
          />

          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.button
                key="stop"
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={stop}
                title="Stop generating"
                aria-label="Stop generating"
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(255,59,48,0.09)', border: '1.5px solid rgba(255,59,48,0.22)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FF3B30', flexShrink: 0,
                }}
              >
                <Square size={10} strokeWidth={2.5} fill="#FF3B30" />
              </motion.button>
            ) : (
              <motion.button
                key="send"
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                onClick={onSend}
                aria-label="Send message"
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: inputVal.trim() ? 'linear-gradient(135deg, #007AFF, #5E5CE6)' : 'rgba(0,0,0,0.07)',
                  border: 'none', cursor: inputVal.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.2s ease',
                  boxShadow: inputVal.trim() ? '0 3px 10px rgba(0,122,255,0.30)' : 'none',
                }}
              >
                <ArrowRight size={12} color={inputVal.trim() ? '#fff' : '#AEAEB2'} strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Suggested prompts */}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          {suggestedPrompts.map(prompt => (
            <motion.button
              key={prompt}
              whileHover={{ scale: 1.03, background: 'rgba(0,122,255,0.12)', borderColor: 'rgba(0,122,255,0.26)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setInputVal(prompt);
                setTimeout(() => {
                  if (!isGenerating) sendMessage({ text: prompt });
                  setInputVal('');
                }, 10);
              }}
              style={{
                fontSize: 10.5, fontWeight: 600, color: AZURE,
                background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.18)',
                borderRadius: 100, padding: '5px 12px',
                cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                fontFamily: 'inherit', letterSpacing: '-0.012em',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <ArrowRight size={9} color={AZURE} strokeWidth={2.5} />
              {prompt}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
