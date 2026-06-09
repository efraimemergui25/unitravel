'use client';

// InitialHandshake.tsx — Parses the user's first NL prompt and bootstraps their workspace.
// Runs a deterministic client-side parse (no API call needed for the initial parse).
// Updates useTravelEngine (setupTrip) and useUserDNA (setParsed) as side effects.
// Shows: streaming thinking steps → context pills → zone launch buttons.

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence }                 from 'framer-motion';
import { useRouter }                               from 'next/navigation';
import { Plane, Hotel, Utensils, Map, Compass }    from 'lucide-react';
import { useTravelEngine }                         from '@/store/useTravelEngine';
import { useUserDNA }                              from '@/store/useUserDNA';
import type { PartyType, BudgetRange }             from '@/store/useUserDNA';

// ── Design tokens ─────────────────────────────────────────────────────────────

const AZURE  = '#007AFF';
const EMERALD = '#30D158';
const AMBER  = '#FF9F0A';
const INDIGO = '#5E5CE6';
const TEAL   = '#00C7BE';
const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const;

// ── Zone catalogue ─────────────────────────────────────────────────────────────

const ZONE_CATALOG = [
  { id: 'flights',     Icon: Plane,    label: 'Aviation Hub',   color: AZURE,   path: '/zone/flights'     },
  { id: 'lodging',     Icon: Hotel,    label: 'Lodging Matrix', color: INDIGO,  path: '/zone/lodging'     },
  { id: 'dining',      Icon: Utensils, label: 'Culinary Hub',   color: AMBER,   path: '/zone/dining'      },
  { id: 'attractions', Icon: Compass,  label: 'Experiences',    color: EMERALD, path: '/zone/attractions' },
  { id: 'transit',     Icon: Map,      label: 'Transit Grid',   color: TEAL,    path: '/zone/transit'     },
] as const;

type ZoneId = typeof ZONE_CATALOG[number]['id'];

// ── NL parser ─────────────────────────────────────────────────────────────────

interface ParsedPrompt {
  dest:        string | null;
  partySize:   number | null;
  partyType:   PartyType | null;
  budgetRange: BudgetRange | null;
  nights:      number | null;
  zones:       ZoneId[];
}

function parseFirstPrompt(text: string): ParsedPrompt {
  const t = text.toLowerCase();

  // Destination — match "to X", "in X", "visiting X", "going to X"
  let dest: string | null = null;
  const destPatterns = [
    /\bgo(?:ing)?\s+to\s+([a-z][a-z\s]{2,22}?)(?:\s+(?:for|in|on|,)|$)/,
    /\bto\s+([a-z][a-z\s]{2,22}?)(?:\s+(?:for|in|on|with|from|this|next|,)|$)/,
    /\bin\s+([a-z][a-z\s]{2,22}?)(?:\s+(?:for|on|with|from|,)|$)/,
    /\bvisit(?:ing)?\s+([a-z][a-z\s]{2,22}?)(?:\s|,|$)/,
  ];
  for (const pat of destPatterns) {
    const m = t.match(pat);
    if (m?.[1]) { dest = m[1].trim(); break; }
  }

  // Party size
  let partySize: number | null = null;
  const sizePat =
    text.match(/(\d+)\s+(?:people|guests?|adults?|travelers?|pax)/i) ??
    text.match(/(?:party|group)\s+of\s+(\d+)/i)                      ??
    text.match(/(?:the\s+)?(\d+)\s+of\s+us/i);
  if (sizePat) partySize = parseInt(sizePat[1]);
  if (!partySize && /honeymoon|couple|just\s+us|two\s+of\s+us/i.test(text)) partySize = 2;
  if (!partySize && /\bsolo\b|just\s+me\b|myself\b/i.test(text))            partySize = 1;

  // Party type
  let partyType: PartyType | null = null;
  if (/honeymoon|anniversary|romantic/i.test(text))                       partyType = 'couple';
  else if (/\bfamily\b|\bkids?\b|\bchildren\b|\btoddler/i.test(text))     partyType = 'family';
  else if (/\bfriends?\b|\bcrew\b|\bbuddies\b|\bgroup\b/i.test(text))     partyType = 'friends';
  else if (/\bsolo\b|just\s+me\b|traveling\s+alone/i.test(text))          partyType = 'solo';
  else if (partySize === 2)                                                partyType = 'couple';
  else if (partySize && partySize >= 3)                                    partyType = 'friends';

  // Budget
  let budgetRange: BudgetRange | null = null;
  if (/luxury|5[\s-]star|high[\s-]end|premium|exclusive/i.test(text))    budgetRange = 'luxury';
  else if (/\bbudget\b|cheap|affordable|economy|backpacker/i.test(text)) budgetRange = 'economy';
  else if (/standard|mid[\s-]range|moderate/i.test(text))                budgetRange = 'standard';

  // Duration
  let nights: number | null = null;
  const durMatch = text.match(/(\d+)\s*(?:night|day|week)s?/i);
  if (durMatch) {
    const n    = parseInt(durMatch[1]);
    const unit = durMatch[0].toLowerCase();
    nights = unit.includes('week') ? n * 7 : unit.includes('day') ? n - 1 : n;
  }

  // Zone detection — order matters: first match wins for primary
  const zones: ZoneId[] = [];
  if (/fly|flight|flying|plane|airport|airways/i.test(text))                 zones.push('flights');
  if (/hotel|stay|resort|villa|accommodation|airbnb|hostel/i.test(text))    zones.push('lodging');
  if (/\beat\b|restaurant|dining|\bfood\b|dinner|lunch|cuisine/i.test(text)) zones.push('dining');
  if (/tour|visit|experience|museum|sightsee|attract/i.test(text))           zones.push('attractions');
  if (/transit|train|car\s+rent|bus|transfer|metro|taxi/i.test(text))        zones.push('transit');
  if (zones.length === 0) zones.push('flights');

  return { dest, partySize, partyType, budgetRange, nights, zones };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ContextPill = memo(function ContextPill({
  label, value, color, delay,
}: { label: string; value: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay }}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:            5,
        paddingBlock:   5,
        paddingInline:  11,
        borderRadius:   100,
        background:    `${color}12`,
        border:        `1px solid ${color}28`,
        fontSize:       11,
        fontWeight:     600,
        letterSpacing:  '-0.01em',
        whiteSpace:     'nowrap',
        flexShrink:     0,
      }}
    >
      <span style={{ color, opacity: 0.65, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}>
        {label.toUpperCase()}
      </span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </motion.div>
  );
});

const ThinkingLine = memo(function ThinkingLine({
  text, delay, done,
}: { text: string; delay: number; done: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:          8,
        fontSize:    12,
        fontWeight:  500,
        color:       done ? 'var(--text-secondary)' : 'var(--text-primary)',
        letterSpacing: '-0.01em',
      }}
    >
      <motion.span
        animate={done
          ? { scale: [1.4, 1], opacity: 1 }
          : { opacity: [0.35, 1, 0.35] }}
        transition={done
          ? { duration: 0.22 }
          : { duration: 1.1, repeat: Infinity }}
        style={{ fontSize: 8, color: done ? EMERALD : AZURE, flexShrink: 0 }}
      >
        {done ? '✓' : '◉'}
      </motion.span>
      {text}
    </motion.div>
  );
});

const ZoneLaunchButton = memo(function ZoneLaunchButton({
  zone, isPrimary, delay, onClick,
}: {
  zone: typeof ZONE_CATALOG[number];
  isPrimary: boolean;
  delay: number;
  onClick: () => void;
}) {
  const { Icon } = zone;
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay }}
      whileHover={{ y: -2, boxShadow: `0 8px 22px ${zone.color}28` }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:             10,
        width:          '100%',
        paddingBlock:    isPrimary ? 13 : 10,
        paddingInline:   16,
        borderRadius:    14,
        background:      isPrimary ? zone.color : 'rgba(255,255,255,0.55)',
        border:          isPrimary ? 'none' : '1.5px solid rgba(255,255,255,0.80)',
        backdropFilter: 'blur(20px)',
        cursor:         'pointer',
        fontSize:        isPrimary ? 14 : 13,
        fontWeight:      600,
        color:           isPrimary ? '#fff' : 'var(--text-primary)',
        letterSpacing:  '-0.01em',
        textAlign:      'start',
        boxShadow:       isPrimary ? `0 4px 18px ${zone.color}3A` : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <Icon size={isPrimary ? 15 : 13} strokeWidth={2.1} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        {isPrimary ? `Launch ${zone.label}` : zone.label}
      </span>
      {isPrimary && <span style={{ opacity: 0.6, fontSize: 13 }}>→</span>}
    </motion.button>
  );
});

// ── InitialHandshake ──────────────────────────────────────────────────────────

interface Props {
  prompt:       string;
  onZoneLaunch: (zone: string) => void;
}

export function InitialHandshake({ prompt, onZoneLaunch }: Props) {
  const router       = useRouter();
  const [phase, setPhase]       = useState<'thinking' | 'pills' | 'ready'>('thinking');
  const [parsed, setParsedState] = useState<ParsedPrompt | null>(null);

  const setParsed    = useUserDNA(s => s.setParsed);
  const setFirstPr   = useUserDNA(s => s.setFirstPrompt);
  const setupTrip    = useTravelEngine(s => s.setupTrip);

  useEffect(() => {
    const result = parseFirstPrompt(prompt);
    setParsedState(result);

    // Phase 1 — thinking steps visible (1.6s)
    // Phase 2 — pills appear (2.4s)
    // Phase 3 — zone buttons appear (3.0s)

    const t1 = setTimeout(() => {
      setFirstPr(prompt);
      setParsed({
        parsedDest:      result.dest,
        parsedPartySize: result.partySize,
        partyType:       result.partyType  ?? undefined,
        budgetRange:     result.budgetRange ?? undefined,
        detectedZones:   result.zones,
      });

      if (result.dest || result.partySize) {
        const today  = new Date();
        const start  = today.toISOString().split('T')[0];
        const nights = result.nights ?? 5;
        const end    = new Date(today.getTime() + nights * 86_400_000).toISOString().split('T')[0];
        setupTrip({
          title:       result.dest ? `Trip to ${titleCase(result.dest)}` : 'My Trip',
          travelers:   result.partySize
            ? Array.from({ length: result.partySize }, (_, i) => `Traveler ${i + 1}`)
            : ['Traveler 1'],
          startDate:   start,
          endDate:     end,
          nights,
          totalBudget: result.budgetRange === 'luxury'  ? 12_000
                     : result.budgetRange === 'premium' ?  6_000
                     : result.budgetRange === 'economy' ?  1_500
                     : 4_000,
        });
      }
      setPhase('pills');
    }, 1600);

    const t2 = setTimeout(() => setPhase('ready'), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const launch = useCallback((zone: typeof ZONE_CATALOG[number]) => {
    onZoneLaunch(zone.id);
    router.push(zone.path);
  }, [onZoneLaunch, router]);

  const primaryZones = parsed
    ? ZONE_CATALOG.filter(z => parsed.zones.includes(z.id as ZoneId))
    : [ZONE_CATALOG[0]];
  const secondaryZones = ZONE_CATALOG.filter(z => !primaryZones.some(p => p.id === z.id));

  return (
    <div
      className="glass-panel"
      style={{
        height:        '100%',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        paddingBlock:   18,
        paddingInline:  20,
        borderBottom:   '1px solid rgba(255,255,255,0.55)',
        flexShrink:     0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <motion.span
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            style={{ fontSize: 15 }}
          >
            ✦
          </motion.span>
          <span style={{ fontSize: 13, fontWeight: 700, color: AZURE, letterSpacing: '-0.01em' }}>
            Unitravel AI
          </span>
        </div>
        <p style={{
          margin:        0,
          fontSize:      11,
          fontWeight:    500,
          color:         'var(--text-secondary)',
          letterSpacing: '-0.01em',
        }}>
          {phase === 'thinking' ? 'Understanding your vision…' : 'Your workspace is ready'}
        </p>
      </div>

      {/* Body */}
      <div style={{
        flex:          1,
        overflowY:     'auto',
        padding:       '16px 20px',
        display:       'flex',
        flexDirection: 'column',
        gap:            18,
      }}>
        {/* Prompt echo */}
        <div style={{
          background:    'rgba(0,122,255,0.06)',
          border:        '1px solid rgba(0,122,255,0.13)',
          borderRadius:   12,
          padding:        '10px 14px',
          fontSize:       13,
          fontWeight:     500,
          color:          'var(--text-primary)',
          lineHeight:     1.5,
          fontStyle:      'italic',
        }}>
          "{prompt}"
        </div>

        {/* Thinking steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ThinkingLine text="Reading your request…"          delay={0.05} done={phase !== 'thinking'} />
          <ThinkingLine text="Finding your destination…"      delay={0.28} done={phase !== 'thinking'} />
          <ThinkingLine text="Matching the right zones…"      delay={0.52} done={phase !== 'thinking'} />
          <ThinkingLine text="Preparing your workspace…"      delay={0.78} done={phase !== 'thinking'} />
        </div>

        {/* Context pills */}
        <AnimatePresence>
          {(phase === 'pills' || phase === 'ready') && parsed && (
            <motion.div
              key="context-pills"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}
            >
              {parsed.dest && (
                <ContextPill label="Destination" value={titleCase(parsed.dest)} color={AZURE}   delay={0.00} />
              )}
              {parsed.partySize && (
                <ContextPill label="Party"       value={`${parsed.partySize} travelers`}        color={INDIGO} delay={0.08} />
              )}
              {parsed.partyType && (
                <ContextPill label="Type"        value={titleCase(parsed.partyType)}            color={AMBER}  delay={0.16} />
              )}
              {parsed.budgetRange && (
                <ContextPill label="Budget"      value={titleCase(parsed.budgetRange)}          color={EMERALD} delay={0.24} />
              )}
              {parsed.nights && (
                <ContextPill label="Duration"    value={`${parsed.nights} nights`}             color={TEAL}   delay={0.32} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zone launch buttons */}
        <AnimatePresence>
          {phase === 'ready' && (
            <motion.div
              key="zone-buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <p style={{
                margin:        0,
                marginBottom:  2,
                fontSize:       11,
                fontWeight:     700,
                color:          'var(--text-tertiary)',
                letterSpacing:  '0.05em',
              }}>
                READY TO EXPLORE
              </p>

              {primaryZones.map((zone, i) => (
                <ZoneLaunchButton
                  key={zone.id}
                  zone={zone}
                  isPrimary={true}
                  delay={i * 0.07}
                  onClick={() => launch(zone)}
                />
              ))}

              {secondaryZones.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
                  {secondaryZones.map((zone, i) => (
                    <ZoneLaunchButton
                      key={zone.id}
                      zone={zone}
                      isPrimary={false}
                      delay={0.08 + i * 0.05}
                      onClick={() => launch(zone)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Follow-up input */}
      <AnimatePresence>
        {phase === 'ready' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            style={{
              flexShrink:    0,
              borderTop:     '1px solid rgba(255,255,255,0.55)',
              padding:        '12px 16px',
            }}
          >
            <input
              type="text"
              placeholder="Add more details…"
              style={{
                width:          '100%',
                background:     'rgba(255,255,255,0.62)',
                border:         '1px solid rgba(255,255,255,0.85)',
                borderRadius:    12,
                paddingBlock:    9,
                paddingInline:   14,
                fontSize:        13,
                fontWeight:      500,
                color:           'var(--text-primary)',
                outline:         'none',
                backdropFilter:  'blur(20px)',
                letterSpacing:  '-0.01em',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Util ──────────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}
