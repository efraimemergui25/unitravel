'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Calendar, Users }                    from 'lucide-react';
import { ZoneShell, ZoneParamChip, ZoneEngineDrawer } from '@/components/zones/ZoneShell';
import { LodgingBento }                       from '@/components/results/LodgingBento';
import type { LodgingSearchState }            from '@/components/results/LodgingBento';
import { useTravelEngine }                    from '@/store/useTravelEngine';
import { ZONE_ENGINES, resolveStatus }        from '@/lib/zoneEngines';
import type { BentoHotel }                    from '@/app/api/hotels/route';
import type { HotelSearchResponse, HotelEngineStatus } from '@/app/api/hotels/route';
import { EngineStatusStrip }                  from '@/components/results/EngineStatusStrip';

const LODGING_AI_PICKS = new Set([
  'google-hotels', 'amadeus-hotels', 'booking', 'airbnb', 'hotels-com', 'expedia-h',
  'marriott', 'four-seasons', 'rosewood', 'one-only', 'mr-mrs-smith', 'design-hotels',
]);
const LODGING_ENGINES = ZONE_ENGINES['lodging'];

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
  const [results,      setResults]      = useState<BentoHotel[] | null>(null);
  const [apiStatus,    setApiStatus]    = useState<'ok' | 'needs_api_key' | 'error' | null>(null);
  const [apiMessage,   setApiMessage]   = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<HotelEngineStatus[] | null>(null);

  // Engine state
  const [selectedEngines, setSelectedEngines] = useState<Set<string>>(new Set(LODGING_AI_PICKS));
  const [enginesOpen,     setEnginesOpen]     = useState(false);

  // NL search state
  const [nlQuery,   setNlQuery]   = useState('');
  const [nlFocused, setNlFocused] = useState(false);

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
    // Auto-submit when city is resolvable
    const city = parsed.city ?? cityName;
    if (city.trim().length > 0) {
      setTimeout(() => handleSearchRef.current([...selectedEngines]), 80);
    }
  }, [nlQuery, cityName, selectedEngines]);

  const handleSearch = useCallback(async (engineIds?: string[]) => {
    const ids = engineIds ?? [...selectedEngines];
    setEngineCount(ids.length);
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
        engines:      ids.join(','),
      });

      const res  = await fetch(`/api/hotels?${params.toString()}`);
      const data = (await res.json()) as HotelSearchResponse;

      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);
      setApiStatus(data.status);
      setApiMessage(data.setupMessage ?? null);
      setEngineStatus(data.engineStatus ?? null);

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
  }, [selectedEngines, cityName, checkIn, checkOut, adults]); // eslint-disable-line

  const cityCode = cityToIata(cityName);
  // Bridge: OmniSelectorConsole Launch → handleSearch
  const handleSearchRef = useRef(handleSearch);
  useEffect(() => { handleSearchRef.current = handleSearch; });
  useEffect(() => {
    const handler = (e: Event) => {
      const { zone, engineIds } = (e as CustomEvent<{ zone: string; engineIds: string[] }>).detail;
      if (zone !== 'lodging') return;
      handleSearchRef.current(engineIds);
    };
    document.addEventListener('unitravel:zone-search', handler);
    return () => document.removeEventListener('unitravel:zone-search', handler);
  }, []);

  const canSearch = cityName.trim().length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>

      {/* ── Unified search card ─────────────────────────────────── */}
      <ZoneShell
        color="#5AC8FA"
        gradient="linear-gradient(135deg, #5AC8FA 0%, #007AFF 100%)"
        nlPlaceholder='Where to stay? — "5-star hotel in Rome Oct 5–10 for 2" or "boutique villa Bali"'
        nlValue={nlQuery}
        onNLChange={setNlQuery}
        onNLApply={applyNLQuery}
        nlFocused={nlFocused}
        onNLFocus={() => setNlFocused(true)}
        onNLBlur={() => setNlFocused(false)}
        paramsRow={<>
          {/* Destination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 100, background: 'rgba(90,200,250,0.08)', border: '1px solid rgba(90,200,250,0.20)', flexShrink: 0 }}>
            <span style={{ fontSize: 11 }}>🏙</span>
            <input value={cityName} onChange={e => setCityName(e.target.value)} placeholder="City"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em', width: 120, fontFamily: 'inherit' }} />
            {cityName.trim() && (
              <span style={{ fontSize: 9.5, fontWeight: 800, color: '#5AC8FA', letterSpacing: '0.04em' }}>{cityCode}</span>
            )}
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

          <ZoneParamChip icon={<Calendar size={11} color="#6E6E73" strokeWidth={2} />}>
            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer', width: 108 }} />
          </ZoneParamChip>
          <ZoneParamChip icon={<Calendar size={11} color="#BF5AF2" strokeWidth={2} />}>
            <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer', width: 108 }} />
          </ZoneParamChip>

          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

          <ZoneParamChip icon={<Users size={11} color="#6E6E73" strokeWidth={2} />}>
            <select value={adults} onChange={e => setAdults(parseInt(e.target.value))}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer' }}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n} adult{n !== 1 ? 's' : ''}</option>)}
            </select>
          </ZoneParamChip>

          <ZoneParamChip>
            <select value={roomType} onChange={e => setRoomType(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer' }}>
              {['Standard','Deluxe','Suite','Villa'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </ZoneParamChip>
        </>}
        engineCount={selectedEngines.size}
        engineLabel={`AI · ${selectedEngines.size} engines`}
        enginesOpen={enginesOpen}
        onEnginesToggle={() => setEnginesOpen(v => !v)}
        engineDrawer={
          <ZoneEngineDrawer
            engines={LODGING_ENGINES.map(e => ({ id: e.id, name: e.name, icon: e.icon, status: resolveStatus(e) }))}
            selected={selectedEngines}
            onToggle={id => setSelectedEngines(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onAIPick={() => setSelectedEngines(new Set(LODGING_AI_PICKS))}
            onSelectAll={() => setSelectedEngines(new Set(LODGING_ENGINES.map(e => e.id)))}
            onClear={() => setSelectedEngines(new Set())}
            aiPicks={LODGING_AI_PICKS}
            color="#5AC8FA"
          />
        }
        canSearch={canSearch}
        onSearch={() => handleSearch()}
        isSearching={searchState === 'loading'}
        scanProgress={scanProgress}
        apiStatus={apiStatus}
        resultCount={results?.length}
      />

      {/* ── Engine status strip ────────────────────────────────────── */}
      {searchState === 'results' && engineStatus && engineStatus.length > 0 && (
        <EngineStatusStrip engines={engineStatus} accentColor="#5AC8FA" />
      )}

      {/* ── Results ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        padding: '8px 12px 24px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.07) transparent',
      }}>
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

