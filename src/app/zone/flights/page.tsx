'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import { AviationBento }                     from '@/components/results/AviationBento';
import type { SearchState }                  from '@/components/results/AviationBento';
import { useTravelEngine }                   from '@/store/useTravelEngine';
import type { BentoFlight }                  from '@/lib/amadeus';
import type { FlightSearchResponse }         from '@/app/api/flights/route';
import { ZONE_ENGINES, resolveStatus }       from '@/lib/zoneEngines';
import {
  Sparkles, PlaneTakeoff, PlaneLanding, Calendar, Users, Armchair,
  ArrowLeftRight, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, ArrowRight,
} from 'lucide-react';
import { WatchButton }         from '@/components/PriceWatch';
import { PriceCalendar }      from '@/components/PriceCalendar';
import { DestinationIntel, lookupDest } from '@/components/DestinationIntel';

// ── IATA lookup ───────────────────────────────────────────────────────────────

const CITY_TO_IATA: Record<string, string> = {
  'New York': 'JFK', 'NYC': 'JFK', 'Los Angeles': 'LAX', 'Miami': 'MIA',
  'Chicago': 'ORD', 'San Francisco': 'SFO', 'Boston': 'BOS', 'Seattle': 'SEA',
  'London': 'LHR', 'Paris': 'CDG', 'Amsterdam': 'AMS', 'Frankfurt': 'FRA',
  'Rome': 'FCO', 'Barcelona': 'BCN', 'Madrid': 'MAD', 'Lisbon': 'LIS',
  'Athens': 'ATH', 'Prague': 'PRG', 'Vienna': 'VIE', 'Zurich': 'ZRH',
  'Dubai': 'DXB', 'Singapore': 'SIN', 'Bangkok': 'BKK', 'Tokyo': 'NRT',
  'Sydney': 'SYD', 'Seoul': 'ICN', 'Hong Kong': 'HKG', 'Mumbai': 'BOM',
  'Istanbul': 'IST', 'Cairo': 'CAI', 'Cape Town': 'CPT', 'Nairobi': 'NBO',
  'Tel Aviv': 'TLV', 'Jerusalem': 'TLV', 'Mexico City': 'MEX', 'Cancun': 'CUN',
  'Toronto': 'YYZ', 'Vancouver': 'YVR', 'Montreal': 'YUL',
};

function cityToIata(city: string): string {
  const t = city.trim();
  if (/^[A-Z]{3}$/.test(t)) return t;
  for (const [name, iata] of Object.entries(CITY_TO_IATA)) {
    if (t.toLowerCase().includes(name.toLowerCase())) return iata;
  }
  return t.toUpperCase().slice(0, 3);
}

// ── NL parser ─────────────────────────────────────────────────────────────────

function parseNL(raw: string) {
  const lower = raw.toLowerCase();
  const r: { origin?: string; destination?: string; travelClass?: 'ECONOMY'|'BUSINESS'|'FIRST'; adults?: number } = {};
  if (/\b(first|first.class)\b/.test(lower))               r.travelClass = 'FIRST';
  else if (/\b(business|biz|business.class)\b/.test(lower)) r.travelClass = 'BUSINESS';
  else if (/\b(economy|eco|coach)\b/.test(lower))           r.travelClass = 'ECONOMY';
  const pm = lower.match(/\b(\d+)\s+(adult|pax|passenger)/);
  if (pm) r.adults = parseInt(pm[1]);
  const to   = raw.match(/\bto\s+([A-Za-z\s]{3,22})/i);
  const from = raw.match(/\bfrom\s+([A-Za-z\s]{3,22})/i);
  if (to)   r.destination = to[1].trim();
  if (from) r.origin      = from[1].trim();
  const codes = raw.match(/\b[A-Z]{3}\b/g) ?? [];
  if (codes.length >= 1 && !r.destination) r.destination = codes[0];
  if (codes.length >= 2 && !r.origin)      r.origin      = codes[1];
  return r;
}

// ── Engine data ───────────────────────────────────────────────────────────────

const ENGINES = ZONE_ENGINES['flights'];
const AI_PICKS = new Set([
  'amadeus', 'google-flights', 'kayak', 'skyscanner', 'kiwi',
  'aeromexico', 'united', 'american', 'copa', 'latam', 'expedia-f',
]);

// ── Spring presets ────────────────────────────────────────────────────────────

const SP = { type: 'spring', stiffness: 420, damping: 30 } as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlightsPage() {
  const trip       = useTravelEngine(s => s.trip);
  const days       = useTravelEngine(s => s.days);
  const dnaProfile = useTravelEngine(s => s.dnaProfile);

  const firstDest     = days[0]?.destination ?? '';
  const defaultAdults = trip.travelers.length || 2;

  const [originCity,  setOriginCity]  = useState('');
  const [destCity,    setDestCity]    = useState(firstDest);
  const [depDate,     setDepDate]     = useState(trip.startDate ?? '');
  const [retDate,     setRetDate]     = useState(trip.endDate ?? '');
  const [adults,      setAdults]      = useState(defaultAdults);
  const [travelClass, setTravelClass] = useState<'ECONOMY'|'BUSINESS'|'FIRST'>(
    dnaProfile && dnaProfile.accommodationTier > 0.7 ? 'BUSINESS' : 'ECONOMY',
  );
  const [tripType,    setTripType]    = useState<'one-way'|'round-trip'>('round-trip');
  const [nlQuery,     setNlQuery]     = useState('');
  const [nlFocused,   setNlFocused]   = useState(false);

  // Engine state
  const [enginesOpen,   setEnginesOpen]   = useState(false);
  const [selectedEngines, setSelected]    = useState<Set<string>>(new Set(AI_PICKS));

  // Search state
  const [searchState,  setSearchState]  = useState<SearchState>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [engineCount,  setEngineCount]  = useState(0);
  const [results,      setResults]      = useState<BentoFlight[] | null>(null);
  const [apiStatus,    setApiStatus]    = useState<'ok'|'needs_api_key'|'error'|null>(null);
  const [apiMessage,   setApiMessage]   = useState<string|null>(null);
  const [engineStatus, setEngineStatus] = useState<import('@/app/api/flights/route').EngineStatus[] | null>(null);
  const [calendarOpen,  setCalendarOpen]  = useState(false);
  const [intelOpen,     setIntelOpen]     = useState(false);
  const destIntelData = lookupDest(destCity);

  useEffect(() => { if (firstDest && !destCity) setDestCity(firstDest); }, [firstDest]); // eslint-disable-line

  const applyNL = useCallback((raw: string) => {
    const p = parseNL(raw);
    if (p.destination) setDestCity(p.destination);
    if (p.origin)      setOriginCity(p.origin);
    if (p.travelClass) setTravelClass(p.travelClass);
    if (p.adults)      setAdults(p.adults);
  }, []);

  const toggleEngine = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const canSearch = originCity.trim().length > 0 && destCity.trim().length > 0;
  const originIata = cityToIata(originCity);
  const destIata   = cityToIata(destCity);

  const handleSearch = useCallback(async () => {
    if (!canSearch) return;
    const ids = [...selectedEngines];
    setEngineCount(ids.length);
    setSearchState('loading');
    setScanProgress(0);
    setResults(null);
    setApiStatus(null);
    setEnginesOpen(false);

    const raf = { id: 0, start: Date.now() };
    const tick = () => {
      const t = Math.min(82, 82 * (1 - Math.exp(-(Date.now() - raf.start) / 5000)));
      setScanProgress(Math.floor(t));
      if (t < 81.9) raf.id = requestAnimationFrame(tick);
    };
    raf.id = requestAnimationFrame(tick);

    try {
      const params = new URLSearchParams({
        origin: cityToIata(originCity), destination: cityToIata(destCity),
        departureDate: depDate, adults: String(adults), travelClass,
        maxResults: '10', engines: ids.join(','),
      });
      const res  = await fetch(`/api/flights?${params}`);
      const data = (await res.json()) as FlightSearchResponse;
      cancelAnimationFrame(raf.id);
      setScanProgress(100);
      setApiStatus(data.status);
      setApiMessage(data.setupMessage ?? null);
      setEngineStatus(data.engineStatus ?? null);
      if (data.status === 'ok') setResults(data.results);
      setTimeout(() => setSearchState('results'), 200);
    } catch (err) {
      cancelAnimationFrame(raf.id);
      setScanProgress(100);
      setApiStatus('error');
      setApiMessage(err instanceof Error ? err.message : 'Network error');
      setTimeout(() => setSearchState('results'), 200);
    }
  }, [canSearch, selectedEngines, originCity, destCity, depDate, adults, travelClass]);

  const swapRoutes = useCallback(() => {
    const prev = originCity;
    setOriginCity(destCity);
    setDestCity(prev);
  }, [originCity, destCity]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ══ Unified search card ═══════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SP, delay: 0.04 }}
        style={{
          margin: '0 12px',
          flexShrink: 0,
          position: 'relative',
          borderRadius: 22,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(56px) saturate(200%)',
          WebkitBackdropFilter: 'blur(56px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.96)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
          overflow: 'hidden',
        }}
      >
        {/* Specular top line */}
        <div aria-hidden style={{
          position: 'absolute', left: '4%', right: '4%', top: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 25%, rgba(255,255,255,1) 75%, transparent)',
          pointerEvents: 'none', zIndex: 4,
        }} />

        {/* ── Section 1: NL Hero Input ─────────────────────────────────────── */}
        <div style={{ padding: '18px 18px 14px' }}>
          <NLHeroBar
            value={nlQuery}
            onChange={setNlQuery}
            onApply={applyNL}
            focused={nlFocused}
            onFocus={() => setNlFocused(true)}
            onBlur={() => setNlFocused(false)}
            searchState={searchState}
            scanProgress={scanProgress}
            engineCount={engineCount}
            apiStatus={apiStatus}
            results={results}
          />
        </div>

        {/* ── Divider ──────────────────────────────────────────────────────── */}
        <div style={{ height: 1, background: 'rgba(0,0,0,0.045)', marginInline: 18 }} />

        {/* ── Section 2: Route + Parameters ────────────────────────────────── */}
        <div style={{ padding: '12px 18px 0', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', rowGap: 6 }}>

          {/* Trip type toggle */}
          <TripTypeToggle value={tripType} onChange={setTripType} />

          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

          {/* Origin */}
          <RouteInput
            icon={<PlaneTakeoff size={12} color="#007AFF" strokeWidth={2} />}
            value={originCity}
            onChange={setOriginCity}
            iata={originIata}
            color="#007AFF"
            placeholder="From"
          />

          {/* Swap */}
          <motion.button
            whileHover={{ rotate: 180, scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            onClick={swapRoutes}
            transition={{ duration: 0.26 }}
            style={{
              width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
              background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ArrowLeftRight size={11} color="#007AFF" strokeWidth={2.5} />
          </motion.button>

          {/* Destination */}
          <RouteInput
            icon={<PlaneLanding size={12} color="#5E5CE6" strokeWidth={2} />}
            value={destCity}
            onChange={setDestCity}
            iata={destIata}
            color="#5E5CE6"
            placeholder="To"
          />

          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

          {/* Depart */}
          <ParamChip icon={<Calendar size={11} color="#6E6E73" strokeWidth={2} />} label="Depart">
            <input type="date" value={depDate} onChange={e => setDepDate(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer', width: 108 }} />
          </ParamChip>

          {/* Return */}
          {tripType === 'round-trip' && (
            <ParamChip icon={<Calendar size={11} color="#BF5AF2" strokeWidth={2} />} label="Return">
              <input type="date" value={retDate} onChange={e => setRetDate(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer', width: 108 }} />
            </ParamChip>
          )}

          {/* Pax */}
          <ParamChip icon={<Users size={11} color="#6E6E73" strokeWidth={2} />}>
            <select value={adults} onChange={e => setAdults(parseInt(e.target.value))}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer' }}>
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} pax</option>)}
            </select>
          </ParamChip>

          {/* Cabin */}
          <ParamChip icon={<Armchair size={11} color="#6E6E73" strokeWidth={2} />}>
            <select value={travelClass} onChange={e => setTravelClass(e.target.value as any)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer' }}>
              <option value="ECONOMY">Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </ParamChip>

          {/* Price Watch — only after real results, price from cheapest result */}
          {canSearch && results && results.length > 0 && (
            <WatchButton
              category="flight"
              label={`${originCity} → ${destCity} · ${travelClass} · ${adults} pax`}
              price={Math.min(...results.map(r => r.totalPrice))}
            />
          )}

          {/* Price Calendar toggle */}
          {canSearch && (
            <motion.button
              onClick={() => setCalendarOpen(v => !v)}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 100,
                background: calendarOpen ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${calendarOpen ? 'rgba(0,122,255,0.24)' : 'rgba(0,0,0,0.07)'}`,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.16s, border-color 0.16s', flexShrink: 0,
              }}
            >
              <Calendar size={11} color={calendarOpen ? '#007AFF' : '#6E6E73'} strokeWidth={2} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: calendarOpen ? '#007AFF' : '#3C3C43', letterSpacing: '-0.01em' }}>
                Calendar
              </span>
            </motion.button>
          )}

          {/* Destination Intel toggle */}
          {destIntelData && (
            <motion.button
              onClick={() => setIntelOpen(v => !v)}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 100,
                background: intelOpen ? 'rgba(94,92,230,0.10)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${intelOpen ? 'rgba(94,92,230,0.24)' : 'rgba(0,0,0,0.07)'}`,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.16s, border-color 0.16s', flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11 }}>{destIntelData.flag}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: intelOpen ? '#5E5CE6' : '#3C3C43', letterSpacing: '-0.01em' }}>
                Intel
              </span>
            </motion.button>
          )}
        </div>

        {/* ── Section 3: Engine selector + Search CTA ──────────────────────── */}
        <div style={{ padding: '12px 18px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Engine summary pill — expands on click */}
          <motion.button
            onClick={() => setEnginesOpen(v => !v)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={SP}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 100, cursor: 'pointer',
              background: enginesOpen ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${enginesOpen ? 'rgba(0,122,255,0.24)' : 'rgba(0,0,0,0.08)'}`,
              fontFamily: 'inherit', flexShrink: 0, transition: 'background 0.18s, border-color 0.18s',
            }}
          >
            <Sparkles size={11} color={enginesOpen ? '#007AFF' : '#6E6E73'} strokeWidth={2} />
            <span style={{ fontSize: 11, fontWeight: 700, color: enginesOpen ? '#007AFF' : '#3C3C43', letterSpacing: '-0.01em' }}>
              AI · {selectedEngines.size} engines
            </span>
            <motion.div animate={{ rotate: enginesOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={11} color={enginesOpen ? '#007AFF' : '#8E8E93'} strokeWidth={2.5} />
            </motion.div>
          </motion.button>

          <div style={{ flex: 1 }} />

          {/* Search CTA */}
          <motion.button
            onClick={handleSearch}
            disabled={!canSearch || searchState === 'loading'}
            whileHover={canSearch && searchState !== 'loading' ? { scale: 1.03, boxShadow: '0 8px 28px rgba(0,122,255,0.38)' } : {}}
            whileTap={canSearch ? { scale: 0.97 } : {}}
            animate={{ opacity: canSearch ? 1 : 0.44 }}
            transition={SP}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 26px', borderRadius: 14, border: 'none',
              background: canSearch ? 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)' : 'rgba(0,0,0,0.10)',
              color: 'white', fontSize: 13, fontWeight: 800, letterSpacing: '-0.015em',
              cursor: canSearch && searchState !== 'loading' ? 'pointer' : 'default',
              boxShadow: canSearch ? '0 4px 18px rgba(0,122,255,0.32), inset 0 1px 0 rgba(255,255,255,0.22)' : 'none',
              fontFamily: 'inherit', flexShrink: 0, transition: 'background 0.24s, box-shadow 0.24s',
            }}
          >
            {searchState === 'loading' ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                  <RefreshCw size={13} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
                </motion.div>
                <span>Scanning {engineCount}…</span>
                <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.82 }}>{Math.min(100, scanProgress)}%</span>
              </>
            ) : (
              <>
                <span>{canSearch ? `Search ${selectedEngines.size}` : 'Add route'}</span>
                <ArrowRight size={13} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
              </>
            )}
          </motion.button>
        </div>

        {/* ── Engine drawer — expands below search row ──────────────────────── */}
        <AnimatePresence>
          {enginesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden', borderTop: '1px solid rgba(0,0,0,0.045)' }}
            >
              <EngineDrawer
                selected={selectedEngines}
                onToggle={toggleEngine}
                onAIPick={() => setSelected(new Set(AI_PICKS))}
                onSelectAll={() => setSelected(new Set(ENGINES.map(e => e.id)))}
                onClear={() => setSelected(new Set())}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ══ Status bar — appears when searched ═══════════════════════════════ */}
      <AnimatePresence>
        {searchState === 'results' && apiStatus && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 0' }}
          >
            <SearchStatusChip apiStatus={apiStatus} count={results?.length ?? 0} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Price Calendar ════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {calendarOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', paddingInline: 12, paddingTop: 8, flexShrink: 0 }}
          >
            <PriceCalendar
              origin={originIata}
              destination={destIata}
              adults={adults}
              travelClass={travelClass}
              selectedDate={depDate}
              onSelectDate={(date) => { setDepDate(date); setCalendarOpen(false); }}
              onClose={() => setCalendarOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Destination Intel Panel ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {intelOpen && destIntelData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', paddingInline: 12, paddingTop: 8, flexShrink: 0 }}
          >
            <DestinationIntel city={destCity} onClose={() => setIntelOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Results ═══════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        padding: '8px 12px 24px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.07) transparent',
      }}>
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

// ── NL Hero Bar ───────────────────────────────────────────────────────────────

function NLHeroBar({
  value, onChange, onApply, focused, onFocus, onBlur,
  searchState, scanProgress, engineCount, apiStatus, results,
}: {
  value: string; onChange: (v: string) => void; onApply: (v: string) => void;
  focused: boolean; onFocus: () => void; onBlur: () => void;
  searchState: SearchState; scanProgress: number; engineCount: number;
  apiStatus: 'ok'|'needs_api_key'|'error'|null; results: any[] | null;
}) {
  return (
    <motion.div
      animate={{
        boxShadow: focused
          ? '0 0 0 2px rgba(0,122,255,0.20), 0 4px 20px rgba(0,122,255,0.12)'
          : '0 2px 10px rgba(0,0,0,0.05)',
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '12px 16px', borderRadius: 16,
        background: focused ? 'rgba(252,252,255,0.96)' : 'rgba(248,248,252,0.90)',
        border: `1.5px solid ${focused ? 'rgba(0,122,255,0.28)' : 'rgba(0,0,0,0.07)'}`,
        transition: 'background 0.18s, border-color 0.18s',
      }}
    >
      <motion.div
        animate={{ color: focused ? '#007AFF' : '#AEAEB2', scale: focused ? 1 : 0.9 }}
        transition={{ duration: 0.16 }}
        style={{ flexShrink: 0 }}
      >
        <Sparkles size={16} strokeWidth={2} style={{ display: 'block' }} />
      </motion.div>

      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onApply(value.trim()); }}
        placeholder='Where to? — "Business to Tokyo, 2 people, cheapest this month"'
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          fontSize: 13, fontWeight: 500, color: '#1D1D1F',
          letterSpacing: '-0.015em', fontFamily: 'inherit',
        }}
      />

      {/* Status indicators on the right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <AnimatePresence mode="wait">
          {searchState === 'loading' && (
            <motion.div key="scan" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                <RefreshCw size={9} color="#007AFF" strokeWidth={2.5} />
              </motion.div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF' }}>{Math.min(100, scanProgress)}%</span>
            </motion.div>
          )}
          {searchState === 'results' && apiStatus === 'ok' && (
            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 100, background: 'rgba(48,209,88,0.09)', border: '1px solid rgba(48,209,88,0.22)' }}>
              <CheckCircle2 size={9} color="#30D158" strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#30D158' }}>{results?.length ?? 0} flights</span>
            </motion.div>
          )}
          {searchState === 'results' && apiStatus === 'needs_api_key' && (
            <motion.div key="key" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 100, background: 'rgba(255,159,10,0.09)', border: '1px solid rgba(255,159,10,0.22)' }}>
              <AlertTriangle size={9} color="#FF9F0A" strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FF9F0A' }}>API key needed</span>
            </motion.div>
          )}
          {searchState === 'results' && apiStatus === 'error' && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 100, background: 'rgba(255,69,58,0.09)', border: '1px solid rgba(255,69,58,0.22)' }}>
              <XCircle size={9} color="#FF453A" strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FF453A' }}>Error</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Apply NL */}
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => onApply(value.trim())}
              style={{
                width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #007AFF, #5E5CE6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(0,122,255,0.34)', flexShrink: 0,
              }}
            >
              <ArrowRight size={11} color="#fff" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Trip type toggle ──────────────────────────────────────────────────────────

function TripTypeToggle({ value, onChange }: { value: 'one-way'|'round-trip'; onChange: (v: 'one-way'|'round-trip') => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      {(['one-way', 'round-trip'] as const).map(type => (
        <button
          key={type}
          onClick={() => onChange(type)}
          style={{
            padding: '4px 10px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
            background: value === type ? 'rgba(0,122,255,0.10)' : 'transparent',
            border: `1px solid ${value === type ? 'rgba(0,122,255,0.24)' : 'rgba(0,0,0,0.07)'}`,
            fontSize: 10.5, fontWeight: value === type ? 700 : 500,
            color: value === type ? '#007AFF' : '#6E6E73',
            transition: 'all 0.16s ease',
          }}
        >
          {type === 'one-way' ? 'One-way' : 'Round-trip'}
        </button>
      ))}
    </div>
  );
}

// ── Route input ───────────────────────────────────────────────────────────────

function RouteInput({ icon, value, onChange, iata, color, placeholder }: {
  icon: React.ReactNode; value: string; onChange: (v: string) => void;
  iata: string; color: string; placeholder: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px',
      borderRadius: 100, background: `${color}08`, border: `1px solid ${color}1e`, flexShrink: 0,
    }}>
      {icon}
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em', width: 110, fontFamily: 'inherit' }}
      />
      {value && iata && value.length >= 3 && (
        <span style={{ fontSize: 9.5, fontWeight: 800, color, letterSpacing: '0.04em', flexShrink: 0, opacity: 0.8 }}>{iata}</span>
      )}
    </div>
  );
}

// ── Param chip ────────────────────────────────────────────────────────────────

function ParamChip({ icon, label, children }: { icon: React.ReactNode; label?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
      borderRadius: 100, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', flexShrink: 0,
    }}>
      {icon}
      {children}
    </div>
  );
}

// ── Engine drawer ─────────────────────────────────────────────────────────────

function EngineDrawer({
  selected, onToggle, onAIPick, onSelectAll, onClear,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAIPick: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const count = selected.size;
  return (
    <div style={{ padding: '14px 18px 16px' }}>
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap', rowGap: 6 }}>
        <button onClick={onAIPick} style={drawerBtnStyle('#007AFF')}>✦ AI Pick</button>
        <button onClick={onSelectAll} style={drawerBtnStyle('#3C3C43', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.08)')}>All 30</button>
        <button onClick={onClear} style={drawerBtnStyle(count > 0 ? '#FF3B30' : '#AEAEB2', count > 0 ? 'rgba(255,59,48,0.07)' : 'transparent', count > 0 ? 'rgba(255,59,48,0.16)' : 'rgba(0,0,0,0.07)')}>Clear</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: '#8E8E93', fontWeight: 500 }}>
          {count > 0 ? `${count} of 30 selected` : 'Select engines'}
        </span>
      </div>

      {/* Engine pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ENGINES.map(engine => {
          const isActive = selected.has(engine.id);
          const isAI     = AI_PICKS.has(engine.id);
          const status   = resolveStatus(engine);
          const isUiOnly = status === 'ui-only';
          const dotColor = status === 'live' ? '#30D158' : status === 'needs-key' ? '#FF9F0A' : status === 'aggregated' ? '#5AC8FA' : '#C7C7CC';
          return (
            <motion.button
              key={engine.id}
              onClick={() => onToggle(engine.id)}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.93 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px 5px 9px', borderRadius: 100, cursor: 'pointer',
                background: isActive ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.38)',
                border: `1px solid ${isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.52)'}`,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                boxShadow: isActive ? '0 3px 14px rgba(0,122,255,0.14), inset 0 0 10px rgba(255,255,255,0.7)' : 'none',
                fontSize: 10.5, fontWeight: isActive ? 700 : 500,
                color: isActive ? '#007AFF' : isUiOnly ? '#8E8E93' : '#3C3C43',
                fontFamily: 'inherit', opacity: isUiOnly && !isActive ? 0.68 : 1,
                transition: 'background 0.16s, border-color 0.16s, color 0.16s',
              }}
            >
              {isAI && <span style={{ fontSize: 7, color: isActive ? '#007AFF' : '#AEAEB2' }}>✦</span>}
              <span style={{ fontSize: 12 }}>{engine.icon}</span>
              <span>{engine.name}</span>
              {status !== 'ui-only' && (
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: `0 0 4px ${dotColor}88` }} />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        {[{ dot: '#30D158', label: 'Live' }, { dot: '#FF9F0A', label: 'Needs key' }, { dot: '#5AC8FA', label: 'Aggregated' }].map(({ dot, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: dot, boxShadow: `0 0 4px ${dot}88` }} />
            <span style={{ fontSize: 9, color: '#8E8E93', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function drawerBtnStyle(color: string, bg = `${color}0A`, border = `${color}22`) {
  return {
    padding: '5px 12px', borderRadius: 8, border: `1px solid ${border}`,
    background: bg, color, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s ease',
  } as const;
}

// ── Search status chip ────────────────────────────────────────────────────────

function SearchStatusChip({ apiStatus, count }: { apiStatus: string; count: number }) {
  if (apiStatus === 'ok') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.20)' }}>
      <CheckCircle2 size={10} color="#30D158" strokeWidth={2} />
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#30D158' }}>{count} flights found</span>
    </div>
  );
  if (apiStatus === 'needs_api_key') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.20)' }}>
      <AlertTriangle size={10} color="#FF9F0A" strokeWidth={2} />
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#FF9F0A' }}>Connect Amadeus API to search flights</span>
    </div>
  );
  return null;
}
