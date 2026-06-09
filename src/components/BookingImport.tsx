'use client';

/**
 * BookingImport — paste a confirmation email, Claude extracts the booking
 * data, you preview it, then add it to the timeline in one click.
 */

import { useState, useCallback }        from 'react';
import { motion, AnimatePresence }       from 'framer-motion';
import { useTravelEngine }               from '@/store/useTravelEngine';
import type { ImportedSegment, BookingImportResponse } from '@/app/api/import-booking/route';
import {
  Clipboard, Sparkles, RefreshCw, CheckCircle2, AlertTriangle,
  Plane, Hotel, Car, Train, Compass, Plus, X, ArrowRight,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SP = { type: 'spring', stiffness: 380, damping: 28 } as const;

function segmentIcon(type: ImportedSegment['type']) {
  switch (type) {
    case 'flight':   return <Plane    size={13} color="#007AFF" strokeWidth={2} />;
    case 'hotel':    return <Hotel    size={13} color="#5E5CE6" strokeWidth={2} />;
    case 'car':      return <Car      size={13} color="#FF9F0A" strokeWidth={2} />;
    case 'rail':     return <Train    size={13} color="#BF5AF2" strokeWidth={2} />;
    case 'activity': return <Compass  size={13} color="#30D158" strokeWidth={2} />;
    default:         return <Compass  size={13} color="#8E8E93" strokeWidth={2} />;
  }
}

function segmentColor(type: ImportedSegment['type']): string {
  return { flight: '#007AFF', hotel: '#5E5CE6', car: '#FF9F0A', rail: '#BF5AF2', activity: '#30D158' }[type] ?? '#8E8E93';
}

function formatDate(d: string): string {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingImport({ onClose }: { onClose?: () => void }) {
  const [text,     setText]     = useState('');
  const [status,   setStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [segments, setSegments] = useState<ImportedSegment[]>([]);
  const [message,  setMessage]  = useState('');
  const [added,    setAdded]    = useState<Set<number>>(new Set());

  const days      = useTravelEngine(s => s.days);
  const placeEntity = useTravelEngine(s => s.placeEntity);

  const handleParse = useCallback(async () => {
    if (!text.trim() || status === 'loading') return;
    setStatus('loading');
    setSegments([]);
    setAdded(new Set());

    try {
      const res  = await fetch('/api/import-booking', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json() as BookingImportResponse;

      if (data.status === 'ok' && data.segments.length > 0) {
        setSegments(data.segments);
        setStatus('done');
      } else {
        setMessage(data.message ?? 'No travel segments found.');
        setStatus('error');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Parse failed');
      setStatus('error');
    }
  }, [text, status]);

  const addToTimeline = useCallback((seg: ImportedSegment, idx: number) => {
    const day = days.find(d => d.date === seg.date) ?? days[0];
    if (!day) return;

    const category =
      seg.type === 'flight'                     ? 'flight'    :
      seg.type === 'hotel'                      ? 'hotel'     :
      seg.type === 'car' || seg.type === 'rail' ? 'transport' :
      'activity';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    placeEntity(day.id, {
      id:           `imported-${Date.now()}-${idx}`,
      category: category as any,
      airline:      seg.title,
      route:        seg.destination ? `${seg.origin ?? ''} → ${seg.destination}` : seg.provider,
      price:        seg.price ?? 0,
      departure:    seg.time ?? '09:00',
      arrival:      seg.endTime ?? '11:00',
      durationMin:  0,
      durationLabel:'',
      stops:        0,
      class:        (seg.class === 'Business' ? 'Business' : seg.class === 'First' ? 'First' : seg.class === 'Premium Economy' ? 'Premium Economy' : 'Economy') as import('@/services/OmniAggregator').FlightClass,
      aiConfidence: 1,
      tags:         ['imported'],
      sourceCount:  1,
      sources:      [seg.provider],
      origin:       seg.origin ?? '',
      destination:  seg.destination ?? '',
      carbonKg:     0,
      carbonLabel:  '',
      carbonAlternative: '',
      priceRange:   [seg.price ?? 0, seg.price ?? 0],
      priceDropProbability: 0,
      seats:        seg.seats ? parseInt(seg.seats) : 1,
      refundable:   false,
      flightNumber: seg.flightNum ?? '',
    });

    setAdded(prev => new Set([...prev, idx]));
  }, [days, placeEntity]);

  const addAll = useCallback(() => {
    segments.forEach((seg, idx) => {
      if (!added.has(idx)) addToTimeline(seg, idx);
    });
  }, [segments, added, addToTimeline]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={SP}
      style={{
        borderRadius: 22,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(56px) saturate(200%)',
        WebkitBackdropFilter: 'blur(56px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.96)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px 14px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #007AFF, #5E5CE6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(0,122,255,0.28)',
          }}>
            <Clipboard size={13} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
              Import Booking
            </div>
            <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>
              Paste any confirmation email — AI extracts everything
            </div>
          </div>
        </div>
        {onClose && (
          <motion.button onClick={onClose} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={11} color="#6E6E73" strokeWidth={2.5} />
          </motion.button>
        )}
      </div>

      {/* Paste area */}
      <div style={{ padding: '14px 18px 0', flexShrink: 0 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your booking confirmation email here…&#10;&#10;Works with any airline, hotel, car rental, or activity confirmation."
          rows={6}
          style={{
            width: '100%', boxSizing: 'border-box',
            borderRadius: 14, padding: '12px 14px',
            background: 'rgba(248,248,252,0.92)',
            border: '1.5px solid rgba(0,0,0,0.07)',
            fontSize: 11.5, fontWeight: 500, color: '#1D1D1F',
            fontFamily: 'inherit', lineHeight: 1.6,
            resize: 'vertical', outline: 'none',
            letterSpacing: '-0.01em',
            transition: 'border-color 0.16s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(0,122,255,0.26)'}
          onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.07)'}
        />

        {/* Parse button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, marginBottom: 14 }}>
          <motion.button
            onClick={handleParse}
            disabled={!text.trim() || status === 'loading'}
            whileHover={text.trim() && status !== 'loading' ? { scale: 1.03, boxShadow: '0 6px 20px rgba(0,122,255,0.32)' } : {}}
            whileTap={text.trim() ? { scale: 0.97 } : {}}
            animate={{ opacity: text.trim() ? 1 : 0.45 }}
            transition={SP}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 22px', borderRadius: 12, background: text.trim() ? 'linear-gradient(135deg, #007AFF, #5E5CE6)' : 'rgba(0,0,0,0.08)',
              color: 'white', fontSize: 12.5, fontWeight: 800, letterSpacing: '-0.015em',
              cursor: text.trim() && status !== 'loading' ? 'pointer' : 'default',
              fontFamily: 'inherit',
              boxShadow: text.trim() ? '0 4px 16px rgba(0,122,255,0.28)' : 'none',
            }}
          >
            {status === 'loading' ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                  <RefreshCw size={12} color="white" strokeWidth={2.5} />
                </motion.div>
                Extracting…
              </>
            ) : (
              <>
                <Sparkles size={12} color="white" strokeWidth={2} />
                Extract Bookings
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {status === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ margin: '0 18px 14px', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,69,58,0.07)', border: '1px solid rgba(255,69,58,0.18)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={12} color="#FF453A" strokeWidth={2} />
            <span style={{ fontSize: 11.5, color: '#FF453A', fontWeight: 600 }}>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {status === 'done' && segments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'auto', borderTop: '1px solid rgba(0,0,0,0.05)' }}
          >
            {/* Summary bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CheckCircle2 size={13} color="#30D158" strokeWidth={2.5} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.015em' }}>
                  {segments.length} segment{segments.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {segments.length > 1 && added.size < segments.length && (
                <motion.button
                  onClick={addAll}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', borderRadius: 100, cursor: 'pointer',
                    background: 'rgba(0,122,255,0.10)', border: '1px solid rgba(0,122,255,0.22)',
                    fontSize: 11, fontWeight: 700, color: '#007AFF', fontFamily: 'inherit',
                  }}
                >
                  <Plus size={10} color="#007AFF" strokeWidth={2.5} />
                  Add all to timeline
                </motion.button>
              )}
            </div>

            {/* Segment cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px 18px' }}>
              {segments.map((seg, idx) => {
                const isAdded = added.has(idx);
                const color   = segmentColor(seg.type);

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SP, delay: idx * 0.04 }}
                    style={{
                      borderRadius: 16,
                      background: isAdded ? 'rgba(48,209,88,0.06)' : `${color}08`,
                      border: `1px solid ${isAdded ? 'rgba(48,209,88,0.22)' : `${color}22`}`,
                      padding: '12px 14px',
                      display: 'flex', alignItems: 'flex-start', gap: 11,
                      transition: 'background 0.24s, border-color 0.24s',
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: `${color}12`, border: `1px solid ${color}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {segmentIcon(seg.type)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.015em', marginBottom: 3 }}>
                        {seg.title}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
                        {/* Date */}
                        <span style={{ fontSize: 10, fontWeight: 600, color: color, background: `${color}10`, border: `1px solid ${color}20`, borderRadius: 6, padding: '2px 7px' }}>
                          {formatDate(seg.date)}{seg.time ? ` · ${seg.time}` : ''}
                        </span>
                        {/* End date */}
                        {seg.endDate && seg.endDate !== seg.date && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#8E8E93', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 6, padding: '2px 7px' }}>
                            → {formatDate(seg.endDate)}{seg.endTime ? ` · ${seg.endTime}` : ''}
                          </span>
                        )}
                        {/* Class */}
                        {seg.class && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#6E6E73', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 6, padding: '2px 7px' }}>
                            {seg.class}
                          </span>
                        )}
                        {/* PNR */}
                        {seg.pnr && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#5E5CE6', background: 'rgba(94,92,230,0.08)', border: '1px solid rgba(94,92,230,0.18)', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.06em' }}>
                            {seg.pnr}
                          </span>
                        )}
                        {/* Flight number */}
                        {seg.flightNum && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF', background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)', borderRadius: 6, padding: '2px 7px' }}>
                            {seg.flightNum}
                          </span>
                        )}
                        {/* Price */}
                        {seg.price != null && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#1D1D1F', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 6, padding: '2px 7px' }}>
                            {seg.currency ?? '$'}{seg.price.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Provider + seats */}
                      <div style={{ fontSize: 10.5, color: '#6E6E73', fontWeight: 500 }}>
                        {seg.provider}{seg.seats ? ` · Seats: ${seg.seats}` : ''}
                        {seg.notes ? ` · ${seg.notes}` : ''}
                      </div>
                    </div>

                    {/* Add button */}
                    <motion.button
                      onClick={() => addToTimeline(seg, idx)}
                      disabled={isAdded}
                      whileHover={!isAdded ? { scale: 1.08 } : {}}
                      whileTap={!isAdded ? { scale: 0.92 } : {}}
                      style={{
                        width: 30, height: 30, borderRadius: '50%', cursor: isAdded ? 'default' : 'pointer', flexShrink: 0,
                        background: isAdded ? 'rgba(48,209,88,0.12)' : `${color}12`,
                        border: `1px solid ${isAdded ? 'rgba(48,209,88,0.28)' : `${color}28`}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isAdded
                        ? <CheckCircle2 size={13} color="#30D158" strokeWidth={2.5} />
                        : <Plus        size={13} color={color} strokeWidth={2.5} />
                      }
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
