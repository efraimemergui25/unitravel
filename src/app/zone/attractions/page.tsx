'use client';

import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { motion, AnimatePresence }    from 'framer-motion';
import { ExperiencesControl }         from '@/components/zones/ExperiencesControl';
import { EffortFilter }               from '@/components/zones/EffortFilter';
import { ExperienceBento }            from '@/components/results/ExperienceBento';
import type { ExperienceSearchState } from '@/components/results/ExperienceBento';
import { useTravelEngine }            from '@/store/useTravelEngine';
import { useLocaleEngine }            from '@/store/useLocaleEngine';
import { ConciergePanel }             from '@/components/ai/ConciergePanel';
import type { EffortLevel }           from '@/components/zones/EffortFilter';
import type { AttractionEntity }      from '@/types/attractions';

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
  const [nlQuery,        setNlQuery]        = useState('');
  const [nlFocused,      setNlFocused]      = useState(false);
  const [parsedQuery,    setParsedQuery]    = useState<ParsedAttractionQuery | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Read dynamic trip context — never hardcode destinations
  const { days, activeDay } = useTravelEngine(s => ({ days: s.days, activeDay: s.activeDay }));
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

  const handleSearch = useCallback(async (engineIds: string[]) => {
    setEngineCount(engineIds.length);
    setSearchState('loading');
    setScanProgress(0);
    setResults(null);
    setApiStatus(null);

    const parsed = nlQuery.trim() ? parseNLAttractionQuery(nlQuery) : null;
    setParsedQuery(parsed);

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
          engineIds,
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
  }, [activeDestination, days, nlQuery, selectedEffort, profile.currency]);

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && nlQuery.trim()) {
      // NL search pre-fills context; user still clicks Search on engine strip
      setParsedQuery(parseNLAttractionQuery(nlQuery));
    }
  };

  return (
    <div
      style={{
        display:   'flex',
        width:     '100%',
        height:    '100%',
        overflow:  'hidden',
        background: [
          `radial-gradient(ellipse at 0% 0%, ${COLOR}09 0%, transparent 52%)`,
          'radial-gradient(ellipse at 100% 100%, rgba(0,199,190,0.04) 0%, transparent 48%)',
          '#F2F2F7',
        ].join(', '),
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* ── 2/3 Workspace ─────────────────────────────────── */}
      <div
        style={{
          flex:          1,
          minWidth:      0,
          display:       'flex',
          flexDirection: 'column',
          height:        '100%',
          overflow:      'hidden',
          gap:           0,
        }}
      >
        {/* ── Header: "Global Experiences Matrix" + NL search ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.05 }}
          className="glass-panel"
          style={{
            marginInline:  16,
            marginBlockStart: 14,
            flexShrink:    0,
            padding:       '16px 20px',
            display:       'flex',
            flexDirection: 'column',
            gap:            12,
          }}
        >
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.h2
              style={{
                margin:        0,
                fontSize:      17,
                fontWeight:    900,
                letterSpacing: '-0.035em',
                color:         'var(--text-primary)',
                lineHeight:    1,
              }}
            >
              Global Experiences Matrix
            </motion.h2>
            <motion.span
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              style={{ fontSize: 13, color: COLOR, flexShrink: 0 }}
            >
              ✦
            </motion.span>

            {/* Context chips */}
            {hasContext && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
                {uniqueDestinations.slice(0, 3).map(dest => (
                  <span
                    key={dest}
                    style={{
                      fontSize:      10,
                      fontWeight:    700,
                      color:         COLOR,
                      background:    `${COLOR}10`,
                      border:        `1px solid ${COLOR}22`,
                      borderRadius:  7,
                      paddingBlock:  3,
                      paddingInline: 8,
                    }}
                  >
                    🎭 {dest}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* NL search input */}
          <motion.div
            animate={{
              boxShadow: nlFocused
                ? `0 0 0 3px rgba(48,209,88,0.14), 0 4px 20px rgba(0,0,0,0.06)`
                : '0 2px 10px rgba(0,0,0,0.04)',
            }}
            transition={{ duration: 0.18 }}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:             10,
              background:    'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(32px) saturate(1.9)',
              border:        `1.5px solid ${nlFocused ? `${COLOR}38` : 'rgba(255,255,255,0.95)'}`,
              borderRadius:   14,
              paddingBlock:   11,
              paddingInline:  16,
              transition:    'border-color 0.18s ease',
            }}
          >
            <motion.span
              animate={{ rotate: nlFocused ? 180 : 0, opacity: nlFocused ? 1 : 0.55 }}
              transition={{ duration: 0.5 }}
              style={{ fontSize: 16, flexShrink: 0 }}
            >
              ✦
            </motion.span>
            <input
              ref={inputRef}
              type="text"
              value={nlQuery}
              onChange={e => setNlQuery(e.target.value)}
              onFocus={() => setNlFocused(true)}
              onBlur={() => setNlFocused(false)}
              onKeyDown={onInputKey}
              placeholder={
                isRtl
                  ? 'חפש חוויות... "סיורי יין תחת $150", "הייקינג בוקר", "טיול פרטי עם סירה"'
                  : 'Find experiences... "private boat tours under $200", "morning hike", "cooking class"'
              }
              style={{
                flex:          1,
                background:   'none',
                border:       'none',
                outline:      'none',
                fontSize:     13,
                fontWeight:   500,
                color:        'var(--text-primary)',
                letterSpacing: '-0.01em',
                minWidth:     0,
                direction:    isRtl ? 'rtl' : 'ltr',
              }}
            />

            {/* Parsed query pills */}
            <AnimatePresence>
              {parsedQuery && (parsedQuery.type || parsedQuery.maxPrice) && (
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {parsedQuery.type && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      style={{
                        fontSize: 9.5, fontWeight: 700, color: COLOR,
                        background: `${COLOR}12`, border: `1px solid ${COLOR}25`,
                        borderRadius: 6, paddingBlock: 2, paddingInline: 7,
                      }}
                    >
                      {parsedQuery.type}
                    </motion.span>
                  )}
                  {parsedQuery.maxPrice && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      style={{
                        fontSize: 9.5, fontWeight: 700, color: '#007AFF',
                        background: 'rgba(0,122,255,0.10)', border: '1px solid rgba(0,122,255,0.20)',
                        borderRadius: 6, paddingBlock: 2, paddingInline: 7,
                      }}
                    >
                      &lt;${parsedQuery.maxPrice}
                    </motion.span>
                  )}
                </div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Scan progress bar */}
          <AnimatePresence>
            {searchState === 'loading' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <motion.span
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                  style={{ fontSize: 11, color: COLOR }}
                  aria-hidden
                >✦</motion.span>
                <div style={{ flex: 1, height: 3, borderRadius: 999, background: `${COLOR}18`, overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${Math.min(100, Math.round(scanProgress))}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                    style={{ height: '100%', background: `linear-gradient(90deg, ${COLOR}, #00C7BE)`, borderRadius: 999 }}
                  />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: COLOR, minWidth: 40, textAlign: 'end' }}>
                  {Math.min(100, Math.round(scanProgress))}%
                </span>
              </motion.div>
            )}
            {searchState === 'results' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR, display: 'inline-block', flexShrink: 0 }}
                  aria-hidden
                />
                <span style={{ fontSize: 10, fontWeight: 700, color: COLOR }}>
                  Weather-synced · Effort-filtered · {results?.length ?? 0} experiences found
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── ExperiencesControl horizontal strip ── */}
        <div style={{ marginBlockStart: 10, flexShrink: 0 }}>
          <ExperiencesControl onSearch={handleSearch} isSearching={searchState === 'loading'} />
        </div>

        {/* ── Effort filter ── */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          style={{
            paddingInline:  20,
            paddingBlock:   9,
            background:    'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(32px) saturate(1.9)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.9)',
            borderBlockEnd: '1px solid rgba(0,0,0,0.05)',
            flexShrink:     0,
          }}
        >
          <EffortFilter selected={selectedEffort} onChange={setSelectedEffort} />
        </motion.div>

        {/* ── Scrollable results ── */}
        <div
          style={{
            flex:           1,
            minHeight:      0,
            overflowY:      'auto',
            overflowX:      'hidden',
            padding:        '18px 20px 40px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,0,0,0.10) transparent',
          }}
        >
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

      {/* ── 1/3 AI Concierge — permanent right column ── */}
      <ConciergePanel fitParent />
    </div>
  );
}
