'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import { CulinaryControl }                   from '@/components/zones/CulinaryControl';
import { VibeFilter }                        from '@/components/zones/VibeFilter';
import { DiningBento }                       from '@/components/results/DiningBento';
import type { DiningSearchState }            from '@/components/results/DiningBento';
import { useTravelEngine }                   from '@/store/useTravelEngine';
import type { MergedRestaurant }             from '@/app/api/dining/route';

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
      const res  = await fetch('/api/dining', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          destination: destination || 'New York',
          date,
          adults,
          vibes:     selectedVibes,
          diets:     selectedDiets,
          engineIds,
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
  }, [destination, date, adults, selectedVibes, selectedDiets]);

  return (
    <div style={{
      position:  'relative',
      height:    '100%',
      width:     '100%',
      overflow:  'hidden',
      display:   'flex',
      flexDirection: 'column',
      background: [
        `radial-gradient(ellipse at 0% 0%, ${COLOR}09 0%, transparent 52%)`,
        'radial-gradient(ellipse at 100% 100%, rgba(255,69,58,0.04) 0%, transparent 48%)',
        '#F2F2F7',
      ].join(', '),
    }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.04 }}
        className="glass-panel mx-4 mt-4 flex-shrink-0"
        style={{ padding: '16px 18px 14px' }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              margin: 0, fontSize: 'clamp(1.1rem,1.8vw,1.45rem)',
              fontWeight: 900, letterSpacing: '-0.04em',
              color: 'var(--text-primary)', lineHeight: 1.1,
            }}
          >
            Culinary & Dining Matrix
          </motion.h2>
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{ fontSize: 12, color: COLOR }}
            aria-hidden
          >
            ✦
          </motion.span>
          <AnimatePresence mode="wait">
            {searchState === 'loading' && (
              <ScanProgressPill key="progress" progress={scanProgress} engineCount={engineCount} />
            )}
            {searchState === 'results' && apiStatus === 'ok' && (
              <StatusPill key="done" color={COLOR} label={`${results?.length ?? 0} restaurants`} pulse />
            )}
            {searchState === 'results' && apiStatus === 'needs_api_key' && (
              <StatusPill key="key" color="#FF9F0A" label="Connect Dining API" />
            )}
            {searchState === 'results' && apiStatus === 'error' && (
              <StatusPill key="err" color="#FF453A" label="Search error" />
            )}
          </AnimatePresence>
        </div>

        {/* NL search row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex:                 1,
            display:              'flex',
            alignItems:           'center',
            gap:                  8,
            paddingBlock:         9,
            paddingInline:        14,
            borderRadius:         12,
            background:           'rgba(0,0,0,0.035)',
            border:               '1px solid rgba(0,0,0,0.07)',
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden>🔍</span>
            <input
              value={nlQuery}
              onChange={e => setNlQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyNlQuery()}
              placeholder="e.g. romantic dinner for 2 in Tulum on Oct 12, vegan friendly…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                fontFamily: 'inherit', letterSpacing: '-0.01em',
              }}
            />
          </div>
          <motion.button
            onClick={applyNlQuery}
            whileHover={{ scale: 1.04, boxShadow: `0 6px 18px ${COLOR}40` }}
            whileTap={{ scale: 0.97 }}
            animate={{ opacity: nlQuery.trim() ? 1 : 0.42 }}
            transition={SPRING}
            style={{
              paddingBlock:  9,
              paddingInline: 18,
              borderRadius:  12,
              border:        'none',
              background:    `linear-gradient(135deg, ${COLOR} 0%, #FF453A 100%)`,
              color:         '#fff',
              fontSize:      12,
              fontWeight:    800,
              letterSpacing: '-0.01em',
              cursor:        nlQuery.trim() ? 'pointer' : 'default',
              fontFamily:    'inherit',
              flexShrink:    0,
              boxShadow:     `0 3px 10px ${COLOR}30`,
            }}
          >
            Apply
          </motion.button>
        </div>
      </motion.div>

      {/* ── Engine control strip ──────────────────────────────────────────── */}
      <div style={{ paddingBlock: '8px 0' }}>
        <CulinaryControl onSearch={handleSearch} isSearching={searchState === 'loading'} />
      </div>

      {/* ── Vibe & Diet filter ────────────────────────────────────────────── */}
      <div style={{ paddingBlock: '6px 0' }}>
        <VibeFilter
          selectedVibes={selectedVibes}
          selectedDiets={selectedDiets}
          onVibesChange={setSelectedVibes}
          onDietsChange={setSelectedDiets}
        />
      </div>

      {/* ── Structured search bar ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.14 }}
        style={{
          display:              'flex',
          alignItems:           'center',
          gap:                  10,
          paddingInline:        16,
          paddingBlock:         10,
          flexShrink:           0,
          flexWrap:             'wrap',
          rowGap:               6,
        }}
      >
        {/* Destination */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingBlock: 6, paddingInline: 10, borderRadius: 10,
          background: `${COLOR}0C`, border: `1px solid ${COLOR}26`, flexShrink: 0,
        }}>
          <span style={{ fontSize: 12 }} aria-hidden>🍽️</span>
          <input
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="City or destination"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, fontWeight: 700, color: '#1D1D1F',
              letterSpacing: '-0.01em', width: 160, fontFamily: 'inherit',
            }}
          />
        </div>

        <div aria-hidden style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

        {/* Date */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          paddingBlock: 6, paddingInline: 10, borderRadius: 8,
          background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11 }} aria-hidden>📅</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 11.5, fontWeight: 600, color: '#3C3C43',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
            aria-label="Dining date"
          />
        </div>

        {/* Adults */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          paddingBlock: 6, paddingInline: 10, borderRadius: 8,
          background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11 }} aria-hidden>👤</span>
          <select
            value={adults}
            onChange={e => setAdults(parseInt(e.target.value))}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 11.5, fontWeight: 600, color: '#3C3C43',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
            aria-label="Party size"
          >
            {[1,2,3,4,5,6,8].map(n => (
              <option key={n} value={n}>{n} {n !== 1 ? 'Guests' : 'Guest'}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div
        className="no-scrollbar"
        style={{
          flex:          1,
          overflowY:     'auto',
          overflowX:     'hidden',
          paddingInline: 16,
          paddingBottom: 36,
        }}
      >
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      transition={SPRING}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        paddingBlock: 5, paddingInline: 11, borderRadius: 999,
        background: `${color}12`, border: `1.5px solid ${color}30`,
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
