'use client';

import { useState, useCallback, useRef }  from 'react';
import { motion, AnimatePresence }        from 'framer-motion';
import { TransitControl }                 from '@/components/zones/TransitControl';
import { MultiModalGraph }                from '@/components/results/MultiModalGraph';
import { TransitBento }                   from '@/components/results/TransitBento';
import { useTravelEngine }                from '@/store/useTravelEngine';
import { useLocaleEngine }                from '@/store/useLocaleEngine';
import type { TransitQuery }              from '@/types/transit';
import type { TransitSearchResponse }     from '@/app/api/transit/route';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR  = '#BF5AF2';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

type SearchState = 'idle' | 'loading' | 'results' | 'needs_api_key' | 'error';

// ── NL query parser ───────────────────────────────────────────────────────────

interface ParsedTransitNL {
  origin?:      string;
  destination?: string;
  adults?:      number;
}

function parseTransitNL(raw: string): ParsedTransitNL {
  const result: ParsedTransitNL = {};
  const l = raw.toLowerCase();

  // "from X to Y" / "X to Y"
  const fromTo = l.match(/(?:from\s+)?(.+?)\s+to\s+(.+?)(?:\s+for\s+|$)/);
  if (fromTo) {
    result.origin      = fromTo[1].trim();
    result.destination = fromTo[2].trim();
  }

  // party size
  const paxMatch = l.match(/(\d)\s*(?:people|guests?|adults?|pax|persons?)/);
  if (paxMatch) result.adults = parseInt(paxMatch[1]);

  return result;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TransitPage() {
  const [searchState,  setSearchState]  = useState<SearchState>('idle');
  const [engineCount,  setEngineCount]  = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeQuery,  setActiveQuery]  = useState(0);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [results,      setResults]      = useState<TransitQuery[]>([]);
  const [setupUrl,     setSetupUrl]     = useState<string | undefined>();
  const [setupMessage, setSetupMessage] = useState<string | undefined>();

  // Form state
  const [origin,      setOrigin]      = useState('');
  const [destination, setDestination] = useState('');
  const [adults,      setAdults]      = useState(2);

  // NL state
  const [nlQuery, setNlQuery] = useState('');
  const [nlPills, setNlPills] = useState<string[]>([]);
  const nlRef = useRef<HTMLInputElement>(null);

  const { days } = useTravelEngine(s => ({ days: s.days }));
  const { profile } = useLocaleEngine();
  const isRtl = profile.direction === 'rtl';
  const isHe  = profile.locale === 'he-IL';

  const uniqueDests = [...new Set(days.map(d => d.destination).filter(Boolean))];

  const applyNLQuery = useCallback(() => {
    if (!nlQuery.trim()) return;
    const parsed = parseTransitNL(nlQuery.trim());
    const pills: string[] = [];
    if (parsed.origin)      { setOrigin(parsed.origin);           pills.push(`📍 ${parsed.origin}`); }
    if (parsed.destination) { setDestination(parsed.destination); pills.push(`🏁 ${parsed.destination}`); }
    if (parsed.adults)      { setAdults(parsed.adults);           pills.push(`👥 ${parsed.adults}`); }
    if (pills.length) setNlPills(pills);
    setNlQuery('');
  }, [nlQuery]);

  const handleSearch = useCallback(async (engineIds: string[]) => {
    if (!origin.trim() || !destination.trim()) return;

    setEngineCount(engineIds.length);
    setSearchState('loading');
    setScanProgress(0);
    setSetupUrl(undefined);
    setSetupMessage(undefined);
    setSelectedRouteId(null);

    const progressRaf = { id: 0, start: Date.now() };
    const animateProgress = () => { const t = Math.min(82, 82 * (1 - Math.exp(-(Date.now() - progressRaf.start) / 5000))); setScanProgress(Math.floor(t)); if (t < 81.9) progressRaf.id = requestAnimationFrame(animateProgress); };
    progressRaf.id = requestAnimationFrame(animateProgress);

    try {
      const res = await fetch('/api/transit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          origin: origin.trim(),
          destination: destination.trim(),
          adults,
          engines: engineIds,
        }),
      });

      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);

      const data: TransitSearchResponse = await res.json();

      if (data.status === 'needs_api_key') {
        setSetupUrl(data.setupUrl);
        setSetupMessage(data.setupMessage);
        setSearchState('needs_api_key');
        return;
      }

      if (data.status === 'error' || !data.results.length) {
        setSetupMessage(data.setupMessage ?? (isHe ? 'לא נמצאו מסלולים' : 'No routes found'));
        setSearchState('error');
        return;
      }

      setResults(data.results);
      setActiveQuery(0);
      // Pre-select the recommended route
      const firstQuery = data.results[0];
      if (firstQuery) {
        const rec = firstQuery.options.find(o => o.isRecommended) ?? firstQuery.options[0];
        setSelectedRouteId(rec?.id ?? null);
      }

      setTimeout(() => setSearchState('results'), 200);
    } catch {
      cancelAnimationFrame(progressRaf.id);
      setScanProgress(100);
      setSetupMessage(isHe ? 'שגיאת רשת. נסה שוב.' : 'Network error. Please try again.');
      setSearchState('error');
    }
  }, [origin, destination, adults, isHe]);

  const activeResults = results[activeQuery];
  const selectedOption = activeResults?.options.find(o => o.id === selectedRouteId) ?? activeResults?.options[0];

  return (
    <div
      className="flex flex-col h-full w-full gap-0 relative"
      style={{
        background: [
          `radial-gradient(ellipse at 0% 0%, ${COLOR}06 0%, transparent 50%)`,
          'radial-gradient(ellipse at 100% 100%, rgba(94,92,230,0.04) 0%, transparent 48%)',
        ].join(', '),
        direction: isRtl ? 'rtl' : 'ltr',
        overflow: 'hidden',
      }}
    >
      {/* ── Header: h2 + NL search ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.04 }}
        className="glass-panel mx-4 mt-4 flex-shrink-0"
        style={{ paddingInline: 20, paddingBlock: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBlockEnd: 12 }}>
          <motion.span
            animate={{ rotate: [0, 12, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}
            aria-hidden
          >
            🗺
          </motion.span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <motion.h2
              style={{
                margin: 0,
                fontSize: 'clamp(1rem, 1.8vw, 1.35rem)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                color: 'var(--text-primary)',
                lineHeight: 1.15,
              }}
            >
              {isHe ? 'מטריצת ניידות ותחבורה' : 'Mobility & Transit Matrix'}
            </motion.h2>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 500,
              color: 'var(--text-secondary)', marginBlockStart: 2,
              letterSpacing: '-0.01em',
            }}>
              {isHe
                ? '30 רשתות · בדיקת עמלת שיא · מרווח ציר זמן חכם'
                : '30 networks · live surge detection · smart timeline buffering'}
            </p>
          </div>

          {/* Scan progress / status */}
          <AnimatePresence mode="wait">
            {searchState === 'loading' && (
              <ScanPill key="scan" progress={scanProgress} engineCount={engineCount} isHe={isHe} />
            )}
            {searchState === 'results' && (
              <motion.div
                key="done"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={SPRING}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  paddingBlock: 5, paddingInline: 10,
                  borderRadius: 999, background: `${COLOR}12`,
                  border: `1.5px solid ${COLOR}30`,
                  fontSize: 10, fontWeight: 700, color: COLOR, flexShrink: 0,
                }}
              >
                <motion.span
                  animate={{ scale: [1, 1.35, 1] }}
                  transition={{ duration: 1.9, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR, display: 'inline-block' }}
                  aria-hidden
                />
                {isHe ? 'מסלולים מסונכרנים' : 'Routes distilled'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* NL search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingBlock: 8, paddingInline: 14,
          borderRadius: 12, background: `${COLOR}08`,
          border: `1.5px solid ${COLOR}28`,
        }}>
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{ fontSize: 13, flexShrink: 0 }}
            aria-hidden
          >✦</motion.span>
          <input
            ref={nlRef}
            value={nlQuery}
            onChange={e => setNlQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyNLQuery()}
            placeholder={isHe
              ? 'למשל: "מהשדה לבית מלון לשניים"'
              : 'e.g. "How to get from the Airport to the Resort for 2"'}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
              fontFamily: 'inherit', letterSpacing: '-0.01em',
              direction: isRtl ? 'rtl' : 'ltr',
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
                background: COLOR, color: 'white', border: 'none',
                fontSize: 11, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit', flexShrink: 0, letterSpacing: '-0.01em',
              }}
            >
              {isHe ? 'החל →' : 'Apply →'}
            </motion.button>
          )}
        </div>

        {/* NL parsed pills */}
        {nlPills.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBlockStart: 8 }}>
            {nlPills.map(pill => (
              <div key={pill} style={{
                fontSize: 10, fontWeight: 700, color: COLOR,
                background: `${COLOR}10`, border: `1px solid ${COLOR}28`,
                borderRadius: 6, paddingBlock: 3, paddingInline: 8,
              }}>
                {pill}
              </div>
            ))}
          </div>
        )}

        {/* Structured origin/destination inputs */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBlockStart: 10, flexWrap: 'wrap', rowGap: 6,
        }}>
          <SearchInput
            value={origin}
            onChange={setOrigin}
            placeholder={isHe ? 'מוצא' : 'From'}
            icon="📍"
          />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {isRtl ? '←' : '→'}
          </span>
          <SearchInput
            value={destination}
            onChange={setDestination}
            placeholder={isHe ? 'יעד' : 'To'}
            icon="🏁"
          />
          {/* Adults */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            paddingBlock: 6, paddingInline: 10,
            borderRadius: 10, background: 'rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.07)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 11 }} aria-hidden>👥</span>
            <button onClick={() => setAdults(a => Math.max(1, a - 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1 }}
              aria-label={isHe ? 'הפחת' : 'Remove'}>−</button>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', minWidth: 14, textAlign: 'center' }}>{adults}</span>
            <button onClick={() => setAdults(a => Math.min(9, a + 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1 }}
              aria-label={isHe ? 'הוסף' : 'Add'}>+</button>
          </div>

          {uniqueDests.length > 0 && (
            <>
              <div aria-hidden style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.09)', marginInline: 2, flexShrink: 0 }} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                paddingBlock: 5, paddingInline: 9, borderRadius: 8,
                background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)',
                fontSize: 11, fontWeight: 500, color: '#3C3C43', flexShrink: 0,
              }}>
                <span aria-hidden>⚡</span>
                <span>{isHe ? 'ניטור עמלת שיא פעיל' : 'Live surge monitoring'}</span>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* ── TransitControl — horizontal engine strip ─────────────────────── */}
      <div style={{ flexShrink: 0, marginBlockStart: 8 }}>
        <TransitControl onSearch={handleSearch} isSearching={searchState === 'loading'} />
      </div>

      {/* ── Results scroll area ──────────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        padding: '16px 16px 36px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,0,0,0.10) transparent',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {searchState === 'idle' && (
          <IdleState isHe={isHe} hasInputs={!!(origin && destination)} />
        )}

        {searchState === 'loading' && (
          <LoadingState engineCount={engineCount} isHe={isHe} />
        )}

        {searchState === 'needs_api_key' && (
          <NeedsApiKeyState
            setupUrl={setupUrl ?? 'https://console.cloud.google.com/apis/library/directions-backend.googleapis.com'}
            message={setupMessage ?? (isHe ? 'הוסף GOOGLE_MAPS_API_KEY לקובץ .env.local' : 'Add GOOGLE_MAPS_API_KEY to .env.local to enable real transit routing.')}
            isHe={isHe}
          />
        )}

        {searchState === 'error' && (
          <ErrorState message={setupMessage} isHe={isHe} />
        )}

        {searchState === 'results' && results.length > 0 && (
          <>
            {/* Query tabs */}
            {results.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                {results.map((q, i) => (
                  <motion.button
                    key={q.id}
                    onClick={() => {
                      setActiveQuery(i);
                      const rec = q.options.find(o => o.isRecommended) ?? q.options[0];
                      setSelectedRouteId(rec?.id ?? null);
                    }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      paddingBlock: 7, paddingInline: 12,
                      borderRadius: 10, cursor: 'pointer',
                      border: i === activeQuery ? `1.5px solid ${COLOR}50` : '1px solid rgba(0,0,0,0.08)',
                      background: i === activeQuery ? `${COLOR}0E` : 'rgba(255,255,255,0.55)',
                      backdropFilter: 'blur(16px)',
                      fontSize: 11, fontWeight: i === activeQuery ? 800 : 500,
                      color: i === activeQuery ? COLOR : '#3C3C43',
                      fontFamily: 'inherit', flexShrink: 0,
                    }}
                  >
                    <span>{q.icon}</span>
                    <span>{q.fromLabel.split(',')[0]} → {q.toLabel.split(',')[0]}</span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Active route: MultiModalGraph + selected TransitBento */}
            <AnimatePresence mode="wait">
              {activeResults && (
                <motion.div
                  key={activeQuery}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={SPRING}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  {/* AI summary */}
                  <div style={{
                    display: 'flex', gap: 8,
                    paddingBlock: 10, paddingInline: 12,
                    borderRadius: 12, background: `${COLOR}08`,
                    border: `1px solid ${COLOR}20`,
                  }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>✦</span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 600, color: '#3C3C43',
                      lineHeight: 1.5, letterSpacing: '-0.01em',
                    }}>
                      {activeResults.aiSummary}
                    </span>
                  </div>

                  {/* Spatial comparison graph */}
                  <div style={{
                    background: 'rgba(255,255,255,0.30)',
                    backdropFilter: 'blur(32px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
                    borderRadius: 20,
                    border: '1.5px solid rgba(255,255,255,0.65)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
                    padding: '16px 18px',
                  }}>
                    <MultiModalGraph
                      options={activeResults.options}
                      fromLabel={activeResults.fromLabel}
                      toLabel={activeResults.toLabel}
                      selectedId={selectedRouteId ?? undefined}
                      onSelect={id => setSelectedRouteId(id)}
                    />
                  </div>

                  {/* Hero bento card for selected route */}
                  {selectedOption && (
                    <TransitBento
                      option={selectedOption}
                      query={activeResults}
                      destination={destination || uniqueDests[0]}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SearchInput({
  value, onChange, placeholder, icon,
}: { value: string; onChange: (v: string) => void; placeholder: string; icon: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      paddingBlock: 6, paddingInline: 10, borderRadius: 10,
      background: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.70)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 12 }} aria-hidden>{icon}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'none', border: 'none', outline: 'none',
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
          fontFamily: 'inherit', letterSpacing: '-0.01em', width: 110, minWidth: 80,
        }}
      />
    </div>
  );
}

function IdleState({ isHe, hasInputs }: { isHe: boolean; hasInputs: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, height: '100%', minHeight: 260,
    }}>
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: 44 }}
      >🗺</motion.div>
      <div style={{ textAlign: 'center', maxWidth: 280 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBlockEnd: 6 }}>
          {isHe ? 'מוכן לתכנון תנועה' : 'Ready for routing'}
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {hasInputs
            ? (isHe ? 'בחר מנועי ניידות ולחץ Route' : 'Select engines and click Route')
            : (isHe ? 'הכנס מוצא ויעד כדי להתחיל' : 'Enter origin and destination to begin')}
        </div>
      </div>
    </div>
  );
}

function LoadingState({ engineCount, isHe }: { engineCount: number; isHe: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14, height: '100%', minHeight: 260,
    }}>
      <motion.span
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 32, display: 'inline-block' }}
      >✦</motion.span>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {isHe ? `מחשב מסלולים דרך ${engineCount} רשתות` : `Routing via ${engineCount} networks`}
      </div>
    </div>
  );
}

function NeedsApiKeyState({ setupUrl, message, isHe }: { setupUrl: string; message: string; isHe: boolean }) {
  const COLOR = '#BF5AF2';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, height: '100%', minHeight: 260, textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: `${COLOR}12`, border: `1.5px solid ${COLOR}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
      }}>🔑</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBlockEnd: 6 }}>
          {isHe ? 'חבר Google Maps' : 'Connect Google Maps'}
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 280, marginBlockEnd: 14 }}>
          {message}
        </div>
      </div>
      <a
        href={setupUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          paddingBlock: 10, paddingInline: 18,
          borderRadius: 12, background: COLOR, color: '#fff',
          fontSize: 12, fontWeight: 800, textDecoration: 'none',
          letterSpacing: '-0.01em', boxShadow: `0 4px 16px ${COLOR}44`,
        }}
      >
        {isHe ? 'קבל API Key →' : 'Get API Key →'}
      </a>
      <div style={{
        paddingBlock: 8, paddingInline: 12,
        borderRadius: 8, background: 'rgba(0,0,0,0.04)',
        border: '1px solid rgba(0,0,0,0.07)',
        fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
        fontFamily: 'monospace',
      }}>
        GOOGLE_MAPS_API_KEY=your_key → .env.local
      </div>
    </div>
  );
}

function ErrorState({ message, isHe }: { message?: string; isHe: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-red-50/30 backdrop-blur-xl border border-red-100/50 h-full">
      <div style={{ fontSize: 36, marginBlockEnd: 12 }}>⚠️</div>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#9A3412', marginBlockEnd: 4 }}>
        {isHe ? 'לא נמצאו מסלולים' : 'No routes found'}
      </p>
      {message && (
        <p style={{ fontSize: 11, fontWeight: 500, color: '#78716c', textAlign: 'center', maxWidth: 280 }}>
          {message}
        </p>
      )}
    </div>
  );
}

function ScanPill({ progress, engineCount, isHe }: { progress: number; engineCount: number; isHe: boolean }) {
  const COLOR = '#BF5AF2';
  const clamped = Math.min(100, Math.round(progress));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBlock: 7, paddingInline: 14,
        borderRadius: 999, background: `${COLOR}0D`,
        border: `1.5px solid ${COLOR}28`, flexShrink: 0,
      }}
    >
      <motion.span
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 11, color: COLOR, display: 'inline-block' }}
        aria-hidden
      >✦</motion.span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: COLOR, letterSpacing: '-0.01em' }}>
          {isHe ? `ניתוב ${engineCount} רשתות` : `Routing ${engineCount} networks`}
        </span>
        <div style={{ height: 3, borderRadius: 999, background: `${COLOR}1C`, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${clamped}%` }}
            transition={{ ease: 'easeOut', duration: 0.28 }}
            style={{ height: '100%', background: `linear-gradient(90deg, ${COLOR}, #5E5CE6)`, borderRadius: 999 }}
          />
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: COLOR, minWidth: 26, textAlign: 'end' }}>
        {clamped}%
      </span>
    </motion.div>
  );
}
