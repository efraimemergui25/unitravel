'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import { Calendar, Users, UtensilsCrossed }  from 'lucide-react';
import { ZoneShell, ZoneParamChip, ZoneEngineDrawer } from '@/components/zones/ZoneShell';
import { DiningBento }                       from '@/components/results/DiningBento';
import type { DiningSearchState }            from '@/components/results/DiningBento';
import { useTravelEngine }                   from '@/store/useTravelEngine';
import { ZONE_ENGINES, resolveStatus }       from '@/lib/zoneEngines';
import type { MergedRestaurant }             from '@/app/api/dining/route';

const DINING_AI_PICKS = new Set([
  'michelin', 'opentable', 'resy', 'worlds50best', 'infatuation',
  'eater', 'tock', 'zagat', 'tripadvisor-d',
]);
const DINING_ENGINES = ZONE_ENGINES['dining'];

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR  = '#FF9F0A';
const SPRING = { type: 'spring', stiffness: 380, damping: 28 } as const;

// ── NL query parser ───────────────────────────────────────────────────────────

interface ParsedDiningQuery {
  destination?: string;
  date?:        string;
  adults?:      number;
  vibes?:       string[];
  diets?:       string[];
}

function parseNLDiningQuery(text: string): ParsedDiningQuery {
  const lower = text.toLowerCase();
  const result: ParsedDiningQuery = {};

  // Destination — common dining destinations
  const destMatch = lower.match(
    /\bin\s+([a-z\s]+?)(?:\s+(?:on|for|with|,|$))/
  ) ?? lower.match(/\b(tulum|cabo|cdmx|mexico\s+city|miami|cancun|playa del carmen|new york|paris|tokyo|london)\b/);
  if (destMatch) result.destination = destMatch[1].trim();

  // Date — "tonight", "tomorrow", weekday, or explicit date
  const tonight   = /\btonight\b/.test(lower);
  const tomorrow  = /\btomorrow\b/.test(lower);
  const dateMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/);

  if (tonight || tomorrow) {
    const d = new Date();
    if (tomorrow) d.setDate(d.getDate() + 1);
    result.date = d.toISOString().split('T')[0];
  } else if (dateMatch) {
    const MONTHS: Record<string, string> = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06',
      jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
      oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
    };
    const mon = MONTHS[dateMatch[1].toLowerCase()];
    const day = dateMatch[2].padStart(2, '0');
    result.date = `${new Date().getFullYear()}-${mon}-${day}`;
  }

  // Party size
  const partyMatch = lower.match(/\b(\d+)\s+(?:people|guests?|adults?|of\s+us|pax)\b/) ??
                     lower.match(/\btable\s+for\s+(\d+)\b/);
  if (partyMatch) result.adults = parseInt(partyMatch[1]);

  // Vibes
  const vibeMap: Record<string, string> = {
    romantic:   'honeymoon-romantic',
    honeymoon:  'honeymoon-romantic',
    'fine dining': 'fine-dining',
    omakase:    'fine-dining',
    tasting:    'fine-dining',
    party:      'high-energy-party',
    'high energy': 'high-energy-party',
    beach:      'sunset-beachside',
    sunset:     'sunset-beachside',
    culinary:   'culinary-experience',
    business:   'business-lunch',
    lunch:      'business-lunch',
    wellness:   'wellness-clean',
    healthy:    'wellness-clean',
    celebration:'celebration',
    birthday:   'celebration',
    anniversary:'honeymoon-romantic',
  };
  const vibes = new Set<string>();
  for (const [kw, id] of Object.entries(vibeMap)) {
    if (lower.includes(kw)) vibes.add(id);
  }
  if (vibes.size > 0) result.vibes = [...vibes];

  // Dietary
  const dietMap: Record<string, string> = {
    vegan:        'vegan',
    vegetarian:   'vegetarian',
    pescatarian:  'pescatarian',
    kosher:       'kosher',
    halal:        'halal',
    'gluten free': 'gluten-free',
    'nut free':   'nut-free',
  };
  const diets = new Set<string>();
  for (const [kw, id] of Object.entries(dietMap)) {
    if (lower.includes(kw)) diets.add(id);
  }
  if (diets.size > 0) result.diets = [...diets];

  return result;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiningPage() {
  const trip = useTravelEngine(s => s.trip);
  const days = useTravelEngine(s => s.days);

  const uniqueDests   = [...new Set(days.map(d => d.destination))].filter(Boolean);
  const defaultDest   = uniqueDests.join(', ') || '';
  const defaultDate   = trip.startDate ?? new Date().toISOString().split('T')[0];
  const defaultAdults = trip.travelers.length || 2;

  const [nlQuery,       setNlQuery]       = useState('');
  const [destination,   setDestination]   = useState(defaultDest);
  const [date,          setDate]          = useState(defaultDate);
  const [adults,        setAdults]        = useState(defaultAdults);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<string[]>(['omnivore']);
  const [searchState,   setSearchState]   = useState<DiningSearchState>('idle');
  const [engineCount,   setEngineCount]   = useState(0);
  const [scanProgress,  setScanProgress]  = useState(0);
  const [results,       setResults]       = useState<MergedRestaurant[] | null>(null);
  const [apiStatus,     setApiStatus]     = useState<'ok' | 'needs_api_key' | 'error' | null>(null);
  const [apiMessage,    setApiMessage]    = useState<string | null>(null);
  const [nlFocused,     setNlFocused]     = useState(false);
  const [selectedEngines, setSelectedEngines] = useState<Set<string>>(new Set(DINING_AI_PICKS));
  const [enginesOpen,     setEnginesOpen]     = useState(false);

  useEffect(() => {
    const dest = [...new Set(days.map(d => d.destination))].filter(Boolean).join(', ');
    if (dest) setDestination(dest);
  }, [days]);

  const applyNlQuery = useCallback(() => {
    if (!nlQuery.trim()) return;
    const parsed = parseNLDiningQuery(nlQuery);
    if (parsed.destination) setDestination(parsed.destination);
    if (parsed.date)        setDate(parsed.date);
    if (parsed.adults)      setAdults(parsed.adults);
    if (parsed.vibes)       setSelectedVibes(parsed.vibes);
    if (parsed.diets)       setSelectedDiets(parsed.diets);
    setNlQuery('');
  }, [nlQuery]);

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
      const res  = await fetch('/api/dining', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          destination: destination || 'New York',
          date,
          adults,
          vibes:     selectedVibes,
          diets:     selectedDiets,
          engineIds: ids,
          tier:      'luxury',
        }),
      });

      const data = await res.json();

      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);
      setApiStatus(data.status);
      setApiMessage(data.setupMessage ?? null);

      if (data.status === 'ok') {
        setResults(data.restaurants ?? []);
      }
      setTimeout(() => setSearchState('results'), 200);
    } catch (err) {
      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);
      setApiStatus('error');
      setApiMessage(err instanceof Error ? err.message : 'Network error');
      setTimeout(() => setSearchState('results'), 200);
    }
  }, [selectedEngines, destination, date, adults, selectedVibes, selectedDiets]); // eslint-disable-line

  const canSearch = destination.trim().length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>

      {/* ── Unified search card ────────────────────────────────────── */}
      <ZoneShell
        color="#FF9F0A"
        gradient="linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%)"
        nlPlaceholder='What are you craving? — "Michelin dinner for 2 in Rome, vegan" or "rooftop bar Tokyo"'
        nlValue={nlQuery}
        onNLChange={setNlQuery}
        onNLApply={applyNlQuery}
        nlFocused={nlFocused}
        onNLFocus={() => setNlFocused(true)}
        onNLBlur={() => setNlFocused(false)}
        paramsRow={<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 100, background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.20)', flexShrink: 0 }}>
            <UtensilsCrossed size={11} color="#FF9F0A" strokeWidth={2} />
            <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="City or destination"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em', width: 140, fontFamily: 'inherit' }} />
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

          <ZoneParamChip icon={<Calendar size={11} color="#6E6E73" strokeWidth={2} />}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer', width: 108 }} />
          </ZoneParamChip>

          <ZoneParamChip icon={<Users size={11} color="#6E6E73" strokeWidth={2} />}>
            <select value={adults} onChange={e => setAdults(parseInt(e.target.value))}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer' }}>
              {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n} {n !== 1 ? 'guests' : 'guest'}</option>)}
            </select>
          </ZoneParamChip>
        </>}
        engineCount={selectedEngines.size}
        engineLabel={`AI · ${selectedEngines.size} engines`}
        enginesOpen={enginesOpen}
        onEnginesToggle={() => setEnginesOpen(v => !v)}
        engineDrawer={
          <ZoneEngineDrawer
            engines={DINING_ENGINES.map(e => ({ id: e.id, name: e.name, icon: e.icon, status: resolveStatus(e) }))}
            selected={selectedEngines}
            onToggle={id => setSelectedEngines(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onAIPick={() => setSelectedEngines(new Set(DINING_AI_PICKS))}
            onSelectAll={() => setSelectedEngines(new Set(DINING_ENGINES.map(e => e.id)))}
            onClear={() => setSelectedEngines(new Set())}
            aiPicks={DINING_AI_PICKS}
            color="#FF9F0A"
          />
        }
        canSearch={canSearch}
        onSearch={() => handleSearch()}
        isSearching={searchState === 'loading'}
        scanProgress={scanProgress}
        apiStatus={apiStatus}
        resultCount={results?.length}
      />

      {/* ── Results ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        padding: '8px 12px 24px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.07) transparent',
      }}>
        <DiningBento
          searchState={searchState}
          engineCount={engineCount}
          results={results}
          apiStatus={apiStatus}
          apiMessage={apiMessage}
          query={{ destination, date, adults }}
        />
      </div>
    </div>
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
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           10,
        paddingBlock:  6,
        paddingInline: 12,
        borderRadius:  999,
        background:    `${COLOR}0D`,
        border:        `1.5px solid ${COLOR}28`,
        flexShrink:    0,
      }}
    >
      <motion.span
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 10, color: COLOR, display: 'inline-block' }}
        aria-hidden
      >✦</motion.span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 120 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: COLOR, letterSpacing: '-0.01em' }}>
          Merging {engineCount} culinary engines
        </span>
        <div style={{ height: 3, borderRadius: 999, background: `${COLOR}1C`, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${clamped}%` }}
            transition={{ ease: 'easeOut', duration: 0.28 }}
            style={{ height: '100%', background: `linear-gradient(90deg, ${COLOR}, #FF453A)`, borderRadius: 999 }}
          />
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: COLOR, minWidth: 28, textAlign: 'end' }}>
        {clamped}%
      </span>
    </motion.div>
  );
}
