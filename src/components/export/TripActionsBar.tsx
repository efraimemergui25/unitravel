'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTravelEngine }         from '@/store/useTravelEngine';
import { downloadICS }             from '@/utils/icsExport';
import { useToast }                from '@/components/ui/Toast';
import {
  Share2, Download, FileText, Calendar, X, Sparkles,
  Plane, Hotel, CheckCircle2, AlertCircle, Mail, MessageCircle,
} from 'lucide-react';
import type { EngineDay } from '@/store/useTravelEngine';

const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

// ── Booking parser ────────────────────────────────────────────────────────────

type ParsedBooking = {
  type:     'flight' | 'hotel' | 'unknown';
  title:    string;
  date?:    string;
  price?:   number;
  ref?:     string;
  detail:   string;
};

function parseBookingText(raw: string): ParsedBooking[] {
  const text   = raw.trim();
  const lower  = text.toLowerCase();
  const results: ParsedBooking[] = [];

  // Flight detection
  const flightMatch = text.match(/\b([A-Z]{2}\d{3,4})\b/g);
  const priceMatch  = text.match(/\$\s*([0-9,]+(?:\.[0-9]{2})?)/);
  const dateMatch   = text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{4})\b/i);
  const refMatch    = text.match(/\b(?:confirmation|booking|ref(?:erence)?|pnr|code)[:\s#]+([A-Z0-9]{4,10})\b/i);
  const routeMatch  = text.match(/([A-Z]{3})\s*[-→→to]+\s*([A-Z]{3})/i);

  if (flightMatch || routeMatch) {
    const from = routeMatch?.[1] ?? '';
    const to   = routeMatch?.[2] ?? '';
    results.push({
      type:   'flight',
      title:  flightMatch ? `Flight ${flightMatch[0]}` : `Flight ${from} → ${to}`,
      date:   dateMatch?.[0],
      price:  priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : undefined,
      ref:    refMatch?.[1],
      detail: `${from && to ? `${from} → ${to}` : ''}${flightMatch ? ` · ${flightMatch.join(', ')}` : ''}`.trim(),
    });
  }

  // Hotel detection
  if (lower.includes('hotel') || lower.includes('check-in') || lower.includes('check in') || lower.includes('reservation') || lower.includes('room')) {
    const hotelName = text.match(/(?:at|at the|hotel|resort|inn)\s+([A-Z][a-zA-Z\s&']{3,40})/)?.[1]?.trim();
    results.push({
      type:   'hotel',
      title:  hotelName ? `Hotel: ${hotelName}` : 'Hotel Reservation',
      date:   dateMatch?.[0],
      price:  priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : undefined,
      ref:    refMatch?.[1],
      detail: `${dateMatch?.[0] ? `Check-in: ${dateMatch[0]}` : ''}${refMatch ? ` · Ref: ${refMatch[1]}` : ''}`.trim(),
    });
  }

  if (results.length === 0) {
    results.push({
      type:   'unknown',
      title:  'Unknown booking',
      detail: 'Could not detect booking type — check flight number or hotel keywords',
    });
  }

  return results;
}

function BookingParserModal({ onClose }: { onClose: () => void }) {
  const [text,    setText]    = useState('');
  const [parsed,  setParsed]  = useState<ParsedBooking[] | null>(null);
  const [added,   setAdded]   = useState(false);
  const days = useTravelEngine(s => s.days);
  const addManualExpense = useTravelEngine(s => s.addManualExpense);

  const parse = useCallback(() => {
    if (!text.trim()) return;
    setParsed(parseBookingText(text));
  }, [text]);

  const addToTrip = useCallback((booking: ParsedBooking) => {
    const targetDay = days[0];
    if (!targetDay) return;
    const cat = booking.type === 'flight' ? 'flight' as const : booking.type === 'hotel' ? 'hotel' as const : 'activity' as const;
    addManualExpense(targetDay.id, booking.title, booking.price ?? 0, cat, booking.detail);
    setAdded(true);
    setTimeout(onClose, 1200);
  }, [days, addManualExpense, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(10px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 16 }}
        onClick={e => e.stopPropagation()}
        style={{
          width:        440,
          maxHeight:    '80vh',
          borderRadius: 26,
          background:   'rgba(255,255,255,0.96)',
          border:       '1px solid rgba(255,255,255,0.95)',
          boxShadow:    '0 24px 70px rgba(0,0,0,0.16), inset 0 1.5px 0 rgba(255,255,255,1)',
          overflow:     'hidden',
          display:      'flex',
          flexDirection:'column',
        }}
      >
        {/* Specular */}
        <div style={{ position: 'absolute', left: '5%', right: '5%', top: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 40%, rgba(255,255,255,1) 60%, transparent)', borderRadius: '999px' }} />

        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #007AFF, #5E5CE6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(0,122,255,0.32)',
            }}>
              <FileText size={16} color="#fff" strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.028em' }}>Booking Parser</div>
              <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500, marginTop: 1 }}>Paste any booking confirmation to import</div>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={12} strokeWidth={2.5} color="#6E6E73" />
          </motion.button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 22px 20px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setParsed(null); setAdded(false); }}
            placeholder="Paste booking confirmation text here…&#10;&#10;e.g. 'Your flight AA123 JFK → LHR on July 12 is confirmed. Confirmation code: ABC123. Total: $892.'"
            rows={6}
            style={{
              width: '100%', resize: 'none', boxSizing: 'border-box',
              padding: '12px 14px', borderRadius: 14,
              background: 'rgba(0,0,0,0.03)', border: '1.5px solid rgba(0,0,0,0.09)',
              fontSize: 12.5, color: '#1D1D1F', fontFamily: 'inherit',
              lineHeight: 1.65, outline: 'none', letterSpacing: '-0.01em',
            }}
          />

          <motion.button
            whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={parse}
            disabled={!text.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px', borderRadius: 14, cursor: text.trim() ? 'pointer' : 'default',
              background: text.trim() ? 'linear-gradient(135deg, #007AFF, #5E5CE6)' : 'rgba(0,0,0,0.08)',
              border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
              color: text.trim() ? '#fff' : '#AEAEB2',
              boxShadow: text.trim() ? '0 4px 14px rgba(0,122,255,0.30)' : 'none',
              transition: 'all 0.18s ease',
            }}
          >
            <Sparkles size={14} strokeWidth={2} />
            Parse Booking
          </motion.button>

          {/* Results */}
          <AnimatePresence>
            {parsed && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {parsed.map((b, i) => {
                  const isUnknown = b.type === 'unknown';
                  const Icon = b.type === 'flight' ? Plane : b.type === 'hotel' ? Hotel : AlertCircle;
                  const color = b.type === 'flight' ? '#007AFF' : b.type === 'hotel' ? '#5AC8FA' : '#FF9F0A';
                  return (
                    <div key={i} style={{
                      padding: '13px 15px', borderRadius: 16,
                      background: isUnknown ? 'rgba(255,159,10,0.06)' : `${color}08`,
                      border: `1px solid ${isUnknown ? 'rgba(255,159,10,0.22)' : `${color}22`}`,
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                        background: `${color}12`, border: `1px solid ${color}22`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={15} color={color} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{b.title}</div>
                        <div style={{ fontSize: 10.5, color: '#6E6E73', marginTop: 2, letterSpacing: '-0.01em' }}>
                          {b.detail || 'No additional details detected'}
                          {b.price ? ` · $${b.price.toLocaleString()}` : ''}
                          {b.ref ? ` · Ref: ${b.ref}` : ''}
                        </div>
                      </div>
                      {!isUnknown && !added && (
                        <motion.button
                          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}
                          onClick={() => addToTrip(b)}
                          style={{
                            fontSize: 10.5, fontWeight: 700, color,
                            background: `${color}12`, border: `1px solid ${color}22`,
                            borderRadius: 100, padding: '5px 12px', cursor: 'pointer',
                            fontFamily: 'inherit', letterSpacing: '-0.01em', flexShrink: 0,
                          }}
                        >
                          Add to trip
                        </motion.button>
                      )}
                      {added && <CheckCircle2 size={18} color="#30D158" />}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Trip summary formatter (used by email, WhatsApp, GCal) ───────────────────

function buildTripText(
  trip: { title: string; startDate: string; endDate: string; nights: number; travelers: string[] },
  days: EngineDay[],
): string {
  const lines: string[] = [];
  lines.push(`✈ ${trip.title || 'My Trip'}`);
  if (trip.startDate && trip.endDate) {
    const start = new Date(trip.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end   = new Date(trip.endDate   + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    lines.push(`${start} – ${end}${trip.nights ? ` (${trip.nights} nights)` : ''}`);
  }
  if (trip.travelers.length > 0) {
    lines.push(`${trip.travelers.length} traveler${trip.travelers.length !== 1 ? 's' : ''}`);
  }
  lines.push('');

  const daysWithItems = days.filter(d => d.entities.length > 0);
  daysWithItems.forEach(day => {
    const d = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    lines.push(`Day ${day.dayNumber} — ${d}`);
    day.entities.forEach(e => {
      lines.push(`  • ${e.title}${e.price > 0 ? ` ($${e.price.toLocaleString()})` : ''}`);
    });
    lines.push('');
  });

  if (daysWithItems.length === 0) lines.push('No items planned yet.');
  lines.push('Planned with Unitravel');
  return lines.join('\n');
}

// ── Trip Actions Bar ──────────────────────────────────────────────────────────

export function TripActionsBar() {
  const trip    = useTravelEngine(s => s.trip);
  const days    = useTravelEngine(s => s.days);
  const { success, info } = useToast();
  const [parserOpen, setParserOpen] = useState(false);
  const [copied,     setCopied]     = useState(false);

  const handleICS = useCallback(() => {
    if (days.length === 0) { info('Add some days to your trip first'); return; }
    downloadICS(days, trip.title || 'My Trip');
    success(`Calendar exported — ${days.length} day${days.length !== 1 ? 's' : ''} downloaded as .ics`);
  }, [days, trip.title, success, info]);

  const handleShare = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2200);
    });
  }, [success]);

  const handleEmail = useCallback(() => {
    const subject = encodeURIComponent(`My ${trip.title || 'Trip'} Plans`);
    const body    = encodeURIComponent(buildTripText(trip, days));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    success('Email draft opened');
  }, [trip, days, success]);

  const handleWhatsApp = useCallback(() => {
    const text = encodeURIComponent(buildTripText(trip, days));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [trip, days]);

  const handleGoogleCal = useCallback(() => {
    if (!trip.startDate || !trip.endDate) { info('Set trip dates first'); return; }
    const start   = trip.startDate.replace(/-/g, '');
    // Google Calendar end date is exclusive (add 1 day)
    const endDt   = new Date(trip.endDate + 'T12:00:00');
    endDt.setDate(endDt.getDate() + 1);
    const end     = endDt.toISOString().split('T')[0].replace(/-/g, '');
    const title   = encodeURIComponent(trip.title || 'My Trip');
    const details = encodeURIComponent(buildTripText(trip, days));
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
    window.open(url, '_blank');
    success('Opening Google Calendar…');
  }, [trip, days, success, info]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Parse booking */}
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setParserOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
            background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)',
            fontSize: 10.5, fontWeight: 700, color: '#007AFF', letterSpacing: '-0.01em',
          }}
          title="Paste booking confirmation to import"
        >
          <FileText size={10} strokeWidth={2.5} />
          Import
        </motion.button>

        {/* Export ICS */}
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleICS}
          disabled={days.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 100, cursor: days.length > 0 ? 'pointer' : 'default', fontFamily: 'inherit',
            background: 'rgba(191,90,242,0.08)', border: '1px solid rgba(191,90,242,0.18)',
            fontSize: 10.5, fontWeight: 700, color: '#BF5AF2', letterSpacing: '-0.01em',
            opacity: days.length === 0 ? 0.4 : 1,
          }}
          title="Export to calendar (.ics)"
        >
          <Calendar size={10} strokeWidth={2.5} />
          .ics
        </motion.button>

        {/* Email */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleEmail}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
            background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)',
            fontSize: 10.5, fontWeight: 700, color: '#007AFF', letterSpacing: '-0.01em',
          }}
          title="Email trip summary"
        >
          <Mail size={10} strokeWidth={2.5} />
          Email
        </motion.button>

        {/* WhatsApp */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleWhatsApp}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
            background: 'rgba(37,211,102,0.09)', border: '1px solid rgba(37,211,102,0.22)',
            fontSize: 10.5, fontWeight: 700, color: '#1DA851', letterSpacing: '-0.01em',
          }}
          title="Share via WhatsApp"
        >
          <MessageCircle size={10} strokeWidth={2.5} />
          WhatsApp
        </motion.button>

        {/* Google Calendar */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleGoogleCal}
          disabled={!trip.startDate}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 100, fontFamily: 'inherit',
            cursor: trip.startDate ? 'pointer' : 'default',
            background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.18)',
            fontSize: 10.5, fontWeight: 700, color: '#EA4335', letterSpacing: '-0.01em',
            opacity: trip.startDate ? 1 : 0.4,
          }}
          title="Add to Google Calendar"
        >
          <Calendar size={10} strokeWidth={2.5} />
          GCal
        </motion.button>

        {/* Share */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleShare}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
            background: copied ? 'rgba(48,209,88,0.10)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${copied ? 'rgba(48,209,88,0.25)' : 'rgba(0,0,0,0.09)'}`,
            fontSize: 10.5, fontWeight: 700, color: copied ? '#30D158' : '#3C3C43',
            letterSpacing: '-0.01em', transition: 'all 0.2s ease',
          }}
          title="Copy share link"
        >
          <Share2 size={10} strokeWidth={2.5} />
          {copied ? 'Copied!' : 'Share'}
        </motion.button>
      </div>

      <AnimatePresence>
        {parserOpen && <BookingParserModal onClose={() => setParserOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
