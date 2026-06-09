'use client';

import { useState, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import { ZoneShell, ZoneEngineDrawer } from '@/components/zones/ZoneShell';
import { ExperienceBento }             from '@/components/results/ExperienceBento';
import type { ExperienceSearchState }  from '@/components/results/ExperienceBento';
import { useTravelEngine }             from '@/store/useTravelEngine';
import { useLocaleEngine }             from '@/store/useLocaleEngine';
import { ZONE_ENGINES, resolveStatus } from '@/lib/zoneEngines';
import type { AttractionEntity }       from '@/types/attractions';

const EXP_AI_PICKS = new Set([
  'geoapify', 'tripadvisor-a', 'viator', 'getyourguide', 'klook',
  'tiqets', 'airbnb-exp', 'musement', 'atlas-obscura', 'culture-trip',
]);
const EXP_ENGINES = ZONE_ENGINES['attractions'];

type EffortLevel = 'easy' | 'moderate' | 'challenging' | 'extreme';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR  = '#30D158';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

// ── NL query parser ───────────────────────────────────────────────────────────

interface ParsedAttractionQuery {
  type?:       string;
  maxPrice?:   number;
  minPrice?:   number;
  duration?:   number;
  isPrivate?:  boolean;
  tags:        string[];
}

function parseNLAttractionQuery(text: string): ParsedAttractionQuery {
  const t    = text.toLowerCase();
  const tags: string[] = [];

  const maxPriceMatch = t.match(/under\s+\$?(\d+)/);
  const maxPrice = maxPriceMatch ? parseInt(maxPriceMatch[1]) : undefined;

  const durationMatch = t.match(/(\d+)\s*(?:hour|hr)/);
  const duration = durationMatch ? parseInt(durationMatch[1]) : undefined;

  const isPrivate = /\bprivate\b|\bpersonal\b|\bjust\s+us\b/.test(t);

  // Activity type detection
  let type: string | undefined;
  if (/\btour\b/.test(t))        type = 'tour';
  if (/\bcooking\b|\bculin/.test(t)) type = 'culinary';
  if (/\bhike|hiking|trekk/.test(t)) type = 'outdoor';
  if (/\bmuseum|gallery|art\b/.test(t)) type = 'cultural';
  if (/\bwellness|spa|yoga/.test(t)) type = 'wellness';
  if (/\bboat|sail|kayak|surf/.test(t)) { type = 'outdoor'; tags.push('water'); }
  if (/\bwine|beer|cocktail/.test(t)) { type = 'culinary'; tags.push('drinks'); }
  if (/\bfamily|kids/.test(t))   tags.push('family-friendly');
  if (/\bnight|evening/.test(t)) tags.push('evening');

  return { type, maxPrice, duration, isPrivate, tags };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttractionsPage() {
  const [searchState,    setSearchState]    = useState<ExperienceSearchState>('idle');
  const [engineCount,    setEngineCount]    = useState(0);
  const [scanProgress,   setScanProgress]   = useState(0);
  const [selectedEffort, setSelectedEffort] = useState<EffortLevel[]>([]);
  const [results,        setResults]        = useState<AttractionEntity[] | null>(null);
  const [apiStatus,      setApiStatus]      = useState<'ok' | 'needs_api_key' | 'error' | null>(null);
  const [apiMessage,     setApiMessage]     = useState<string | null>(null);
  const [engineStatus,   setEngineStatus]   = useState<import('@/app/api/attractions/route').AttractionEngineStatus[] | null>(null);
  const [nlQuery,        setNlQuery]        = useState('');
  const [nlFocused,      setNlFocused]      = useState(false);
  const [selectedEngines, setSelectedEngines] = useState<Set<string>>(new Set(EXP_AI_PICKS));
  const [enginesOpen,     setEnginesOpen]     = useState(false);

  // Read dynamic trip context — never hardcode destinations
  const days      = useTravelEngine(s => s.days);
  const activeDay = useTravelEngine(s => s.activeDay);
  const { profile }         = useLocaleEngine();
  const isRtl               = profile.direction === 'rtl';

  const activeDestination = (() => {
    if (activeDay) {
      const day = days.find(d => d.id === activeDay);
      if (day?.destination) return day.destination;
    }
    const dests = [...new Set(days.map(d => d.destination).filter(Boolean))];
    return dests[0] ?? null;
  })();

  const uniqueDestinations = [...new Set(days.map(d => d.destination).filter(Boolean))];
  const hasContext         = uniqueDestinations.length > 0;

  // ── Search handler ─────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (engineIds?: string[]) => {
    const ids = engineIds ?? [...selectedEngines];
    setEngineCount(ids.length);
    setSearchState('loading');
    setScanProgress(0);
    setResults(null);
    setApiStatus(null);

    const parsed = nlQuery.trim() ? parseNLAttractionQuery(nlQuery) : null;

    const progressRaf = { id: 0, start: Date.now() };
    const animateProgress = () => { const t = Math.min(82, 82 * (1 - Math.exp(-(Date.now() - progressRaf.start) / 5000))); setScanProgress(Math.floor(t)); if (t < 81.9) progressRaf.id = requestAnimationFrame(animateProgress); };
    progressRaf.id = requestAnimationFrame(animateProgress);

    try {
      const destination = activeDestination ?? 'Paris';
      const startDate   = days[0]?.date ?? new Date().toISOString().split('T')[0];
      const endDate     = days[days.length - 1]?.date ?? startDate;

      const res  = await fetch('/api/attractions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          destination,
          engineIds: ids,
          adults:       2,
          startDate,
          endDate,
          effortLevels: selectedEffort.length > 0 ? selectedEffort : undefined,
          currency:     profile.currency,
          nlQuery:      nlQuery.trim() || undefined,
          type:         parsed?.type,
          maxPrice:     parsed?.maxPrice,
          isPrivate:    parsed?.isPrivate,
          tags:         parsed?.tags.length ? parsed.tags : undefined,
        }),
      });

      const data = await res.json();
      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);

      setEngineStatus(data.engineStatus ?? null);
      if (data.status === 'needs_api_key') {
        setApiStatus('needs_api_key');
        setApiMessage(data.setupMessage ?? null);
      } else if (data.results?.length > 0) {
        setApiStatus('ok');
        setResults(data.results);
      } else if (data.count === 0) {
        setApiStatus('ok');
        setResults([]);
      } else {
        setApiStatus('error');
        setApiMessage(data.error ?? 'No results');
      }
      setTimeout(() => setSearchState('results'), 200);
    } catch (err) {
      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);
      setApiStatus('error');
      setApiMessage(err instanceof Error ? err.message : 'Network error');
      setTimeout(() => setSearchState('results'), 200);
    }
  }, [selectedEngines, activeDestination, days, nlQuery, selectedEffort, profile.currency]); // eslint-disable-line

  const canSearch = (activeDestination ?? '').length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', direction: isRtl ? 'rtl' : 'ltr' }}>
      <ZoneShell
        color="#30D158"
        gradient="linear-gradient(135deg, #30D158 0%, #00C7BE 100%)"
        nlPlaceholder='What do you want to experience? — "private boat tour under $200", "morning hike", "cooking class"'
        nlValue={nlQuery}
        onNLChange={setNlQuery}
        onNLApply={(v) => setNlQuery(v)}
        nlFocused={nlFocused}
        onNLFocus={() => setNlFocused(true)}
        onNLBlur={() => setNlFocused(false)}
        paramsRow={activeDestination ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 100, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.20)', flexShrink: 0 }}>
            <MapPin size={9} color="#30D158" strokeWidth={2} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#30D158', letterSpacing: '-0.01em' }}>{activeDestination}</span>
          </div>
        ) : undefined}
        engineCount={selectedEngines.size}
        engineLabel={`AI · ${selectedEngines.size} engines`}
        enginesOpen={enginesOpen}
        onEnginesToggle={() => setEnginesOpen(v => !v)}
        engineDrawer={
          <ZoneEngineDrawer
            engines={EXP_ENGINES.map(e => ({ id: e.id, name: e.name, icon: e.icon, status: resolveStatus(e) }))}
            selected={selectedEngines}
            onToggle={id => setSelectedEngines(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onAIPick={() => setSelectedEngines(new Set(EXP_AI_PICKS))}
            onSelectAll={() => setSelectedEngines(new Set(EXP_ENGINES.map(e => e.id)))}
            onClear={() => setSelectedEngines(new Set())}
            aiPicks={EXP_AI_PICKS}
            color="#30D158"
          />
        }
        canSearch={canSearch}
        onSearch={() => handleSearch()}
        isSearching={searchState === 'loading'}
        scanProgress={scanProgress}
        apiStatus={apiStatus}
        resultCount={results?.length}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px 12px 24px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.07) transparent' }}>
          <ExperienceBento
            searchState={searchState}
            engineCount={engineCount}
            destination={activeDestination ?? undefined}
            results={results}
            apiStatus={apiStatus}
            apiMessage={apiMessage}
          />
        </div>
      </div>
    </div>
  );
}
