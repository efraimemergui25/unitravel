'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence }                    from 'framer-motion';
import { AviationControl }                            from '@/components/zones/AviationControl';
import { AviationBento }                              from '@/components/results/AviationBento';
import type { SearchState }                           from '@/components/results/AviationBento';
import { useTravelEngine }                            from '@/store/useTravelEngine';
import type { BentoFlight }                           from '@/lib/amadeus';
import type { FlightSearchResponse }                  from '@/app/api/flights/route';

// ── IATA quick-lookup ─────────────────────────────────────────────────────────

const CITY_TO_IATA: Record<string, string> = {
  'Tel Aviv': 'TLV', 'Jerusalem': 'TLV', 'Eilat': 'ETH',
  'Mexico City': 'MEX', 'Tulum': 'CUN', 'Riviera Maya': 'CUN',
  'Cancun': 'CUN', 'Cabo San Lucas': 'SJD', 'Los Cabos': 'SJD',
  'New York': 'JFK', 'Los Angeles': 'LAX', 'Miami': 'MIA',
  'Chicago': 'ORD', 'London': 'LHR', 'Paris': 'CDG',
  'Rome': 'FCO', 'Barcelona': 'BCN', 'Madrid': 'MAD',
  'Tokyo': 'NRT', 'Bangkok': 'BKK', 'Singapore': 'SIN',
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

// ── NL query parser ───────────────────────────────────────────────────────────

interface ParsedQuery {
  origin?:      string;
  destination?: string;
  travelClass?: 'ECONOMY' | 'BUSINESS' | 'FIRST';
  date?:        string;
  adults?:      number;
}

function parseNLQuery(raw: string): ParsedQuery {
  const lower  = raw.toLowerCase();
  const result: ParsedQuery = {};

  // Cabin class
  if (/\b(first|first.class)\b/.test(lower))         result.travelClass = 'FIRST';
  else if (/\b(business|biz|business.class)\b/.test(lower)) result.travelClass = 'BUSINESS';
  else if (/\b(economy|coach|eco)\b/.test(lower))    result.travelClass = 'ECONOMY';

  // Adults count
  const paxMatch = lower.match(/\b(\d+)\s+(adult|pax|passenger|traveler)/);
  if (paxMatch) result.adults = parseInt(paxMatch[1]);

  // Destination: look for "to <city/IATA>"
  const toMatch = raw.match(/\bto\s+([A-Za-z\s]{3,20})/i);
  if (toMatch) {
    const candidate = toMatch[1].trim();
    const iata = cityToIata(candidate);
    if (iata) result.destination = candidate;
  }

  // Origin: look for "from <city/IATA>"
  const fromMatch = raw.match(/\bfrom\s+([A-Za-z\s]{3,20})/i);
  if (fromMatch) {
    const candidate = fromMatch[1].trim();
    const iata = cityToIata(candidate);
    if (iata) result.origin = candidate;
  }

  // IATA codes mentioned directly (3 uppercase letters)
  const iataCodes = raw.match(/\b[A-Z]{3}\b/g) ?? [];
  if (iataCodes.length >= 1 && !result.destination) result.destination = iataCodes[0];
  if (iataCodes.length >= 2 && !result.origin)      result.origin      = iataCodes[1];

  return result;
}

// ── Design constants ──────────────────────────────────────────────────────────

const COLOR  = '#007AFF';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlightsPage() {
  const trip       = useTravelEngine(s => s.trip);
  const days       = useTravelEngine(s => s.days);
  const dnaProfile = useTravelEngine(s => s.dnaProfile);

  const firstDest     = days[0]?.destination ?? '';
  const defaultOrigin = 'Tel Aviv';
  const defaultDest   = firstDest || 'Mexico City';
  const defaultDate   = trip.startDate ?? new Date().toISOString().split('T')[0];
  const defaultAdults = trip.travelers.length || 2;

  const [originCity,  setOriginCity]  = useState(defaultOrigin);
  const [destCity,    setDestCity]    = useState(defaultDest);
  const [depDate,     setDepDate]     = useState(defaultDate);
  const [adults,      setAdults]      = useState(defaultAdults);
  const [travelClass, setTravelClass] = useState<'ECONOMY' | 'BUSINESS' | 'FIRST'>(
    dnaProfile && dnaProfile.accommodationTier > 0.7 ? 'BUSINESS' : 'ECONOMY',
  );
  const [nlQuery,     setNlQuery]     = useState('');

  const [searchState,  setSearchState]  = useState<SearchState>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [engineCount,  setEngineCount]  = useState(0);
  const [results,      setResults]      = useState<BentoFlight[] | null>(null);
  const [apiStatus,    setApiStatus]    = useState<'ok' | 'needs_api_key' | 'error' | null>(null);
  const [apiMessage,   setApiMessage]   = useState<string | null>(null);

  useEffect(() => {
    if (firstDest) setDestCity(firstDest);
  }, [firstDest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply NL parse to structured state
  const applyNLQuery = useCallback((raw: string) => {
    const parsed = parseNLQuery(raw);
    if (parsed.destination) setDestCity(parsed.destination);
    if (parsed.origin)      setOriginCity(parsed.origin);
    if (parsed.travelClass) setTravelClass(parsed.travelClass);
    if (parsed.adults)      setAdults(parsed.adults);
  }, []);

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
      const originIata = cityToIata(originCity);
      const destIata   = cityToIata(destCity);

      const params = new URLSearchParams({
        origin:        originIata,
        destination:   destIata,
        departureDate: depDate,
        adults:        String(adults),
        travelClass,
        maxResults:    '10',
        engines:       engineIds.join(','),
      });

      const res  = await fetch(`/api/flights?${params.toString()}`);
      const data = (await res.json()) as FlightSearchResponse;

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
  }, [originCity, destCity, depDate, adults, travelClass]);

  const originIata = cityToIata(originCity);
  const destIata   = cityToIata(destCity);

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{
        background: [
          `radial-gradient(ellipse at 0% 0%, rgba(0,122,255,0.06) 0%, transparent 52%)`,
          `radial-gradient(ellipse at 100% 100%, rgba(94,92,230,0.04) 0%, transparent 48%)`,
          'transparent',
        ].join(', '),
      }}
    >
      {/* ══ 1. Aviation Matrix header ══════════════════════════════════════ */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.05 }}
        className="glass-panel mx-4 mt-4 flex-shrink-0"
        style={{ padding: '18px 20px 16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 22, lineHeight: 1 }}
              aria-hidden
            >
              ✈️
            </motion.span>
            <div>
              <motion.h2
                style={{
                  fontSize:      'clamp(18px, 2vw, 24px)',
                  fontWeight:    900,
                  color:         '#1D1D1F',
                  letterSpacing: '-0.03em',
                  lineHeight:    1.1,
                  margin:        0,
                }}
              >
                Aviation Matrix
              </motion.h2>
              <p style={{ fontSize: 11, color: '#6E6E73', marginBlockStart: 2, letterSpacing: '-0.01em' }}>
                30 global engines · AI-distilled results
              </p>
            </div>
          </div>

          {/* Status pill */}
          <AnimatePresence mode="wait">
            {searchState === 'loading' && (
              <ScanPill key="scan" progress={scanProgress} engineCount={engineCount} />
            )}
            {searchState === 'results' && apiStatus === 'ok' && (
              <StatusPill key="ok"  color="#30D158" label={`${results?.length ?? 0} flights found`} pulse />
            )}
            {searchState === 'results' && apiStatus === 'needs_api_key' && (
              <StatusPill key="key" color="#FF9F0A" label="Connect Amadeus API" />
            )}
            {searchState === 'results' && apiStatus === 'error' && (
              <StatusPill key="err" color="#FF453A" label="Search error" />
            )}
          </AnimatePresence>
        </div>

        {/* NL Search input */}
        <NLSearchBar
          value={nlQuery}
          onChange={setNlQuery}
          onApply={applyNLQuery}
        />
      </motion.header>

      {/* ══ 2. Engine selector (horizontal pill strip) ══════════════════════ */}
      <div className="mt-3 flex-shrink-0">
        <AviationControl onSearch={handleSearch} isSearching={searchState === 'loading'} />
      </div>

      {/* ══ 3. Structured search params bar ═════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.14 }}
        className="glass-panel mx-4 mt-3 flex-shrink-0"
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
        {/* Origin */}
        <RouteInput icon="✈️" value={originCity} placeholder="Origin" onChange={setOriginCity} iata={originIata} color={COLOR} />
        <span style={{ fontSize: 14, color: COLOR, fontWeight: 900, flexShrink: 0 }} aria-hidden>→</span>
        {/* Destination */}
        <RouteInput icon="🏁" value={destCity} placeholder="Destination" onChange={setDestCity} iata={destIata} color="#5E5CE6" />

        <div aria-hidden style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.09)', marginInline: 2 }} />

        {/* Date */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/[0.09] bg-black/[0.04]">
          <span style={{ fontSize: 11 }} aria-hidden>📅</span>
          <input
            type="date"
            value={depDate}
            onChange={e => setDepDate(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#3C3C43', fontFamily: 'inherit', cursor: 'pointer' }}
            aria-label="Departure date"
          />
        </div>

        {/* Adults */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/[0.09] bg-black/[0.04]">
          <span style={{ fontSize: 11 }} aria-hidden>👤</span>
          <select
            value={adults}
            onChange={e => setAdults(parseInt(e.target.value))}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#3C3C43', fontFamily: 'inherit', cursor: 'pointer' }}
            aria-label="Passengers"
          >
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} pax</option>)}
          </select>
        </div>

        {/* Cabin */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/[0.09] bg-black/[0.04]">
          <span style={{ fontSize: 11 }} aria-hidden>💺</span>
          <select
            value={travelClass}
            onChange={e => setTravelClass(e.target.value as 'ECONOMY' | 'BUSINESS' | 'FIRST')}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#3C3C43', fontFamily: 'inherit', cursor: 'pointer' }}
            aria-label="Cabin class"
          >
            <option value="ECONOMY">Economy</option>
            <option value="BUSINESS">Business</option>
            <option value="FIRST">First</option>
          </select>
        </div>
      </motion.div>

      {/* ══ 4. Results ══════════════════════════════════════════════════════ */}
      <div
        style={{
          flex:           1,
          minHeight:      0,
          overflowY:      'auto',
          overflowX:      'hidden',
          padding:        '16px 16px 32px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.10) transparent',
        }}
      >
        <AviationBento
          searchState={searchState}
          engineCount={engineCount}
          results={results}
          apiStatus={apiStatus}
          apiMessage={apiMessage}
          query={{ from: `${originCity} (${originIata})`, to: `${destCity} (${destIata})`, date: depDate, adults, travelClass }}
        />
      </div>
    </div>
  );
}

// ── NL Search Bar ─────────────────────────────────────────────────────────────

function NLSearchBar({
  value, onChange, onApply,
}: { value: string; onChange: (v: string) => void; onApply: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (value.trim()) { onApply(value.trim()); }
  };

  return (
    <motion.div
      animate={{
        boxShadow: focused
          ? `0 0 0 2px ${COLOR}30, 0 4px 16px rgba(0,122,255,0.10)`
          : '0 2px 8px rgba(0,0,0,0.04)',
      }}
      transition={{ duration: 0.2 }}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  10,
        paddingInline:        16,
        paddingBlock:         12,
        borderRadius:         14,
        background:           focused ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.50)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border:               `1px solid ${focused ? `${COLOR}28` : 'rgba(255,255,255,0.80)'}`,
      }}
    >
      <motion.span
        animate={{ color: focused ? COLOR : '#AEAEB2' }}
        transition={{ duration: 0.15 }}
        style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
        aria-hidden
      >
        ✦
      </motion.span>
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder='Ask naturally — e.g. "Business class from TLV to NYC, 2 adults"'
        style={{
          flex:          1,
          background:    'transparent',
          border:        'none',
          outline:       'none',
          fontSize:      12.5,
          fontWeight:    500,
          color:         '#1D1D1F',
          letterSpacing: '-0.01em',
          fontFamily:    'inherit',
        }}
        aria-label="Natural language flight search"
      />
      {value && (
        <motion.button
          onClick={handleSubmit}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 480, damping: 24 }}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          30,
            height:         30,
            borderRadius:   '50%',
            background:     `linear-gradient(135deg, ${COLOR}, #5E5CE6)`,
            border:         'none',
            cursor:         'pointer',
            flexShrink:     0,
            boxShadow:      `0 3px 10px ${COLOR}44`,
          }}
          aria-label="Apply query"
        >
          <span style={{ fontSize: 12, color: 'white' }} aria-hidden>→</span>
        </motion.button>
      )}
    </motion.div>
  );
}

// ── Route input ───────────────────────────────────────────────────────────────

function RouteInput({ icon, value, placeholder, onChange, iata, color }: {
  icon: string; value: string; placeholder: string;
  onChange: (v: string) => void; iata: string; color: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      paddingBlock: 5, paddingInline: 9, borderRadius: 9,
      background: `${color}0A`, border: `1px solid ${color}24`, flexShrink: 0,
    }}>
      <span style={{ fontSize: 12, flexShrink: 0 }} aria-hidden>{icon}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: 11.5, fontWeight: 700, color: '#1D1D1F',
          letterSpacing: '-0.01em', width: 120, fontFamily: 'inherit',
        }}
        aria-label={placeholder}
      />
      <span style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: '0.04em', flexShrink: 0 }}>{iata}</span>
    </div>
  );
}

// ── Status pills ──────────────────────────────────────────────────────────────

function StatusPill({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      transition={SPRING}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        paddingBlock: 6, paddingInline: 12,
        borderRadius: 999, background: `${color}12`,
        border: `1.5px solid ${color}30`,
        fontSize: 11, fontWeight: 700, color, flexShrink: 0,
      }}
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

function ScanPill({ progress, engineCount }: { progress: number; engineCount: number }) {
  const clamped = Math.min(100, Math.round(progress));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        paddingBlock: 7, paddingInline: 14,
        borderRadius: 999, background: `${COLOR}0C`,
        border: `1.5px solid ${COLOR}28`, flexShrink: 0,
      }}
    >
      <motion.span
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 11, color: COLOR, display: 'inline-block' }}
        aria-hidden
      >✦</motion.span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 130 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLOR, letterSpacing: '-0.01em' }}>
          Scanning {engineCount} engines
        </span>
        <div style={{ height: 3, borderRadius: 999, background: `${COLOR}18`, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${clamped}%` }}
            transition={{ ease: 'easeOut', duration: 0.28 }}
            style={{ height: '100%', background: `linear-gradient(90deg, ${COLOR}, #5E5CE6)`, borderRadius: 999 }}
          />
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: COLOR, minWidth: 28, textAlign: 'end' }}>{clamped}%</span>
    </motion.div>
  );
}
