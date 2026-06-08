'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence }                  from 'framer-motion';
import { LodgingControl }                           from '@/components/zones/LodgingControl';
import { LodgingBento }                             from '@/components/results/LodgingBento';
import type { LodgingSearchState }                  from '@/components/results/LodgingBento';
import { useTravelEngine }                          from '@/store/useTravelEngine';
import type { BentoHotel }                          from '@/app/api/hotels/route';
import type { HotelSearchResponse }                 from '@/app/api/hotels/route';

// ── IATA city code lookup ─────────────────────────────────────────────────────

const CITY_TO_IATA: Record<string, string> = {
  'Tel Aviv': 'TLV', 'Jerusalem': 'TLV', 'Eilat': 'ETH',
  'Mexico City': 'MEX', 'Tulum': 'CUN', 'Cancun': 'CUN',
  'Cabo San Lucas': 'SJD', 'Riviera Maya': 'CUN',
  'New York': 'NYC', 'Los Angeles': 'LAX', 'Miami': 'MIA',
  'Chicago': 'CHI', 'London': 'LON', 'Paris': 'PAR',
  'Rome': 'ROM', 'Barcelona': 'BCN', 'Madrid': 'MAD',
  'Tokyo': 'TYO', 'Bangkok': 'BKK', 'Singapore': 'SIN',
  'Dubai': 'DXB', 'Amsterdam': 'AMS', 'Frankfurt': 'FRA',
  'Lisbon': 'LIS', 'Athens': 'ATH', 'Prague': 'PRG',
};

function cityToIata(city: string): string {
  for (const [name, iata] of Object.entries(CITY_TO_IATA)) {
    if (city.toLowerCase().includes(name.toLowerCase())) return iata;
  }
  if (/^[A-Z]{3}$/.test(city.trim().toUpperCase())) return city.trim().toUpperCase();
  return city.toUpperCase().slice(0, 3);
}

// ── NL query parser for lodging ───────────────────────────────────────────────

interface ParsedLodgingQuery {
  city?:     string;
  checkIn?:  string;
  checkOut?: string;
  adults?:   number;
  roomType?: string;
  nights?:   number;
}

const MONTHS: Record<string, string> = {
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
};

function toIso(monthStr: string, dayStr: string, year = '2026'): string {
  const m = MONTHS[monthStr.slice(0, 3).toLowerCase()] ?? '01';
  return `${year}-${m}-${dayStr.padStart(2, '0')}`;
}

function parseNLLodgingQuery(raw: string): ParsedLodgingQuery {
  const q: ParsedLodgingQuery = {};
  const l = raw.toLowerCase();

  // Room type
  if (/suite/.test(l))              q.roomType = 'Suite';
  else if (/villa/.test(l))         q.roomType = 'Villa';
  else if (/deluxe/.test(l))        q.roomType = 'Deluxe';
  else if (/superior/.test(l))      q.roomType = 'Superior';

  // Adults
  const adultsMatch = l.match(/(\d)\s*(?:adults?|guests?|people|pax|persons?)/);
  if (adultsMatch) q.adults = parseInt(adultsMatch[1]);

  // Nights
  const nightsMatch = l.match(/(\d+)\s*nights?/);
  if (nightsMatch) q.nights = parseInt(nightsMatch[1]);

  // Date patterns: "oct 5", "october 5", "oct 5-10"
  const dateRange = l.match(/(\w+)\s+(\d{1,2})\s*[-–to]+\s*(\w+\s+)?(\d{1,2})/);
  if (dateRange) {
    q.checkIn  = toIso(dateRange[1], dateRange[2]);
    const outMonth = dateRange[3] ? dateRange[3].trim() : dateRange[1];
    q.checkOut = toIso(outMonth, dateRange[4]);
  } else {
    const singleDate = l.match(/(\w+)\s+(\d{1,2})/);
    if (singleDate && MONTHS[singleDate[1].slice(0, 3).toLowerCase()]) {
      q.checkIn = toIso(singleDate[1], singleDate[2]);
    }
  }

  // If we have check-in + nights but no check-out, compute it
  if (q.checkIn && q.nights && !q.checkOut) {
    const d = new Date(q.checkIn);
    d.setDate(d.getDate() + q.nights);
    q.checkOut = d.toISOString().split('T')[0];
  }

  // City — known city names
  for (const name of Object.keys(CITY_TO_IATA)) {
    if (l.includes(name.toLowerCase())) { q.city = name; break; }
  }

  return q;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR  = '#00C7BE';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LodgingPage() {
  const trip = useTravelEngine(s => s.trip);
  const days = useTravelEngine(s => s.days);

  const uniqueDests  = [...new Set(days.map(d => d.destination))].filter(Boolean);
  const defaultCity  = uniqueDests[0] ?? '';
  const defaultIn    = trip.startDate ?? new Date().toISOString().split('T')[0];
  const defaultOut   = trip.endDate   ?? '';
  const defaultAdults = trip.travelers.length || 2;

  const [cityName,    setCityName]    = useState(defaultCity);
  const [checkIn,     setCheckIn]     = useState(defaultIn);
  const [checkOut,    setCheckOut]    = useState(defaultOut);
  const [adults,      setAdults]      = useState(defaultAdults);
  const [roomType,    setRoomType]    = useState('Standard');
  const [searchState, setSearchState] = useState<LodgingSearchState>('idle');
  const [engineCount, setEngineCount] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [results,     setResults]     = useState<BentoHotel[] | null>(null);
  const [apiStatus,   setApiStatus]   = useState<'ok' | 'needs_api_key' | 'error' | null>(null);
  const [apiMessage,  setApiMessage]  = useState<string | null>(null);

  // NL search state
  const [nlQuery, setNlQuery] = useState('');
  const nlRef = useRef<HTMLInputElement>(null);

  // Sync store destination on mount
  useEffect(() => {
    if (uniqueDests[0]) setCityName(uniqueDests[0]);
  }, [uniqueDests[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyNLQuery = useCallback(() => {
    if (!nlQuery.trim()) return;
    const parsed = parseNLLodgingQuery(nlQuery);
    if (parsed.city)     setCityName(parsed.city);
    if (parsed.checkIn)  setCheckIn(parsed.checkIn);
    if (parsed.checkOut) setCheckOut(parsed.checkOut);
    if (parsed.adults)   setAdults(parsed.adults);
    if (parsed.roomType) setRoomType(parsed.roomType);
    setNlQuery('');
  }, [nlQuery]);

  const handleSearch = useCallback(async (engineIds: string[]) => {
    setEngineCount(engineIds.length);
    setSearchState('loading');
    setScanProgress(0);
    setResults(null);
    setApiStatus(null);

    const progressRaf = { id: 0, start: Date.now() };
    const animateProgress = () => { const t = Math.min(82, 82 * (1 - Math.exp(-(Date.now() - progressRaf.start) / 5000))); setScanProgress(Math.floor(t)); if (t < 81.9) progressRaf.id = requestAnimationFrame(animateProgress); };
    progressRaf.id = requestAnimationFrame(animateProgress);

    try {
      const cityCode = cityToIata(cityName);
      const params   = new URLSearchParams({
        cityCode,
        checkInDate:  checkIn,
        checkOutDate: checkOut,
        adults:       String(adults),
        maxResults:   '10',
        engines:      engineIds.join(','),
      });

      const res  = await fetch(`/api/hotels?${params.toString()}`);
      const data = (await res.json()) as HotelSearchResponse;

      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);
      setApiStatus(data.status);
      setApiMessage(data.setupMessage ?? null);

      if (data.status === 'ok') {
        setResults(data.results);
        setTimeout(() => setSearchState('results'), 200);
      } else {
        setTimeout(() => setSearchState('results'), 200);
      }
    } catch (err) {
      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);
      setApiStatus('error');
      setApiMessage(err instanceof Error ? err.message : 'Network error');
      setTimeout(() => setSearchState('results'), 200);
    }
  }, [cityName, checkIn, checkOut, adults]);

  const cityCode = cityToIata(cityName);

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        width:         '100%',
        overflow:      'hidden',
        gap:           12,
      }}
    >
      {/* ── 1. Hospitality Matrix header + NL search ──────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.04 }}
        className="glass-panel mx-4 flex-shrink-0"
        style={{ paddingInline: 20, paddingBlock: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBlockEnd: 12 }}>
          <motion.span
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}
            aria-hidden
          >
            🏨
          </motion.span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <motion.h2
              style={{
                margin: 0, fontSize: 'clamp(1rem, 1.8vw, 1.35rem)',
                fontWeight: 900, letterSpacing: '-0.04em',
                color: 'var(--text-primary)', lineHeight: 1.15,
              }}
            >
              Hospitality Matrix
            </motion.h2>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBlockStart: 2, letterSpacing: '-0.01em' }}>
              30 global engines · AI dedup · hidden fee transparency
            </p>
          </div>

          {/* Status pill */}
          <AnimatePresence mode="wait">
            {searchState === 'loading' && (
              <ScanProgressPill key="progress" progress={scanProgress} engineCount={engineCount} />
            )}
            {searchState === 'results' && apiStatus === 'ok' && (
              <StatusPill key="done" color={COLOR} label={`${results?.length ?? 0} hotels`} pulse />
            )}
            {searchState === 'results' && apiStatus === 'needs_api_key' && (
              <StatusPill key="key" color="#FF9F0A" label="Connect API" />
            )}
            {searchState === 'results' && apiStatus === 'error' && (
              <StatusPill key="err" color="#FF453A" label="Error" />
            )}
          </AnimatePresence>
        </div>

        {/* NL search input */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            paddingBlock:   8,
            paddingInline:  14,
            borderRadius:   12,
            background:     `${COLOR}08`,
            border:         `1.5px solid ${COLOR}28`,
          }}
        >
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{ fontSize: 13, flexShrink: 0 }}
            aria-hidden
          >
            ✦
          </motion.span>
          <input
            ref={nlRef}
            value={nlQuery}
            onChange={e => setNlQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyNLQuery()}
            placeholder='e.g. "Tulum suite oct 5-10 for 2" or "Paris villa 3 nights"'
            style={{
              flex:        1,
              background:  'transparent',
              border:      'none',
              outline:     'none',
              fontSize:    12,
              fontWeight:  500,
              color:       'var(--text-primary)',
              fontFamily:  'inherit',
              letterSpacing: '-0.01em',
            }}
          />
          {nlQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={applyNLQuery}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              style={{
                paddingBlock: 5, paddingInline: 12, borderRadius: 8,
                background:  COLOR, color: 'white', border: 'none',
                fontSize: 11, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit', flexShrink: 0, letterSpacing: '-0.01em',
              }}
            >
              Apply →
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ── 2. Engine selector (horizontal strip) ─────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <LodgingControl onSearch={handleSearch} isSearching={searchState === 'loading'} />
      </div>

      {/* ── 3. Structured search bar ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.12 }}
        className="glass-panel mx-4 flex-shrink-0"
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         8,
          paddingInline: 16,
          paddingBlock:  10,
          flexWrap:    'wrap',
          rowGap:      8,
        }}
      >
        {/* City */}
        <SearchInput
          icon="🌍"
          value={cityName}
          placeholder="City (e.g. Tulum)"
          onChange={setCityName}
          badge={cityCode}
          color={COLOR}
        />

        <span style={{ fontSize: 13, color: COLOR, fontWeight: 700, flexShrink: 0 }} aria-hidden>→</span>

        {/* Check-in */}
        <DateInput label="Check-in" value={checkIn} onChange={setCheckIn} />

        {/* Check-out */}
        <DateInput label="Check-out" value={checkOut} onChange={setCheckOut} />

        <div aria-hidden style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.09)', marginInline: 2, flexShrink: 0 }} />

        {/* Adults */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          paddingBlock: 5, paddingInline: 9, borderRadius: 8,
          background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)',
        }}>
          <span style={{ fontSize: 11 }} aria-hidden>👤</span>
          <select
            value={adults}
            onChange={e => setAdults(parseInt(e.target.value))}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, fontWeight: 600, color: '#3C3C43', fontFamily: 'inherit', cursor: 'pointer' }}
            aria-label="Adults"
          >
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} Adult{n !== 1 ? 's' : ''}</option>)}
          </select>
        </div>

        {/* Room type */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          paddingBlock: 5, paddingInline: 9, borderRadius: 8,
          background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)',
        }}>
          <span style={{ fontSize: 11 }} aria-hidden>🛏</span>
          <select
            value={roomType}
            onChange={e => setRoomType(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, fontWeight: 600, color: '#3C3C43', fontFamily: 'inherit', cursor: 'pointer' }}
            aria-label="Room type"
          >
            {['Standard', 'Superior', 'Deluxe', 'Suite', 'Villa'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* ── 4. Results ────────────────────────────────────────────── */}
      <div
        style={{
          flex:           1,
          minHeight:      0,
          overflowY:      'auto',
          overflowX:      'hidden',
          padding:        '4px 20px 32px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.12) transparent',
        }}
      >
        <LodgingBento
          searchState={searchState}
          engineCount={engineCount}
          results={results}
          apiStatus={apiStatus}
          apiMessage={apiMessage}
          query={{ city: `${cityName} (${cityCode})`, checkIn, checkOut, adults, roomType }}
        />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SearchInput({ icon, value, placeholder, onChange, badge, color }: {
  icon: string; value: string; placeholder: string;
  onChange: (v: string) => void; badge: string; color: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      paddingBlock: 5, paddingInline: 9, borderRadius: 10,
      background: `${color}0C`, border: `1px solid ${color}28`, flexShrink: 0,
    }}>
      <span style={{ fontSize: 13 }} aria-hidden>{icon}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em', width: 140, fontFamily: 'inherit' }}
      />
      <span style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: '0.02em', flexShrink: 0 }}>{badge}</span>
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      paddingBlock: 5, paddingInline: 9, borderRadius: 8,
      background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)', flexShrink: 0,
    }}>
      <span style={{ fontSize: 11 }} aria-hidden>📅</span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, fontWeight: 600, color: '#3C3C43', fontFamily: 'inherit', cursor: 'pointer' }}
        aria-label={label}
      />
    </div>
  );
}

function StatusPill({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      transition={SPRING}
      style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBlock: 6, paddingInline: 12, borderRadius: 999, background: `${color}12`, border: `1.5px solid ${color}30`, fontSize: 11.5, fontWeight: 700, color, flexShrink: 0 }}
    >
      {pulse && (
        <motion.span
          animate={{ scale: [1, 1.35, 1] }}
          transition={{ duration: 1.9, repeat: Infinity }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
          aria-hidden
        />
      )}
      {label}
    </motion.div>
  );
}

function ScanProgressPill({ progress, engineCount }: { progress: number; engineCount: number }) {
  const clamped = Math.min(100, Math.round(progress));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING}
      style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 7, paddingInline: 14, borderRadius: 999, background: `${COLOR}0D`, border: `1.5px solid ${COLOR}28`, flexShrink: 0 }}
    >
      <motion.span
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 11, color: COLOR, display: 'inline-block' }}
        aria-hidden
      >✦</motion.span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 120 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLOR, letterSpacing: '-0.01em' }}>
          Scanning {engineCount} hotel engines
        </span>
        <div style={{ height: 3, borderRadius: 999, background: `${COLOR}1C`, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${clamped}%` }}
            transition={{ ease: 'easeOut', duration: 0.28 }}
            style={{ height: '100%', background: `linear-gradient(90deg, ${COLOR}, #007AFF)`, borderRadius: 999 }}
          />
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: COLOR, minWidth: 28, textAlign: 'end' }}>{clamped}%</span>
    </motion.div>
  );
}
