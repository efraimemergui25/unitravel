'use client';

import {
  useState, useEffect, useCallback, memo, useRef,
  type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useRouter }           from 'next/navigation';
import { LocaleToggle }        from '@/components/ui/LocaleToggle';
import { ConciergePanel }      from '@/components/ai/ConciergePanel';

// ── Design constants ──────────────────────────────────────────────────────────

const AZURE   = '#007AFF';
const EMERALD = '#30D158';

const SPRING_SOFT = { type: 'spring', stiffness: 280, damping: 28 } as const;
const SPRING_SNAPPY = { type: 'spring', stiffness: 420, damping: 32 } as const;

// ── Inspiration quotes ────────────────────────────────────────────────────────

const QUOTES = [
  {
    line1: 'The journey doesn\'t start at the airport.',
    line2: 'It starts here.',
  },
  {
    line1: 'Every great trip begins with a question.',
    line2: 'Where to next?',
  },
  {
    line1: 'Not a search engine.',
    line2: 'An intelligence that knows before you ask.',
  },
  {
    line1: 'Hotels. Flights. Dining. Experiences.',
    line2: 'Unified in one consciousness.',
  },
  {
    line1: 'The world\'s top travel engines.',
    line2: 'Distilled into one answer.',
  },
];

// ── Quick action chips ────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: '✈', label: 'Flights',     zone: 'flights',     color: AZURE },
  { icon: '🏨', label: 'Hotels',     zone: 'lodging',     color: '#5E5CE6' },
  { icon: '🍽', label: 'Dining',     zone: 'dining',      color: '#FF9F0A' },
  { icon: '🎭', label: 'Experiences',zone: 'attractions', color: EMERALD },
  { icon: '🗺', label: 'Transit',    zone: 'transit',     color: '#00C7BE' },
];

// ── Word-reveal animation component ──────────────────────────────────────────

const WordReveal = memo(function WordReveal({
  text,
  delay = 0,
  className,
  style,
}: {
  text:       string;
  delay?:     number;
  className?: string;
  style?:     React.CSSProperties;
}) {
  const words = text.split(' ');
  return (
    <span className={className} style={{ display: 'block', ...style }}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          style={{ display: 'inline-block', marginInlineEnd: '0.28em' }}
          variants={{
            hidden: { opacity: 0, y: 22, filter: 'blur(8px)' },
            visible: {
              opacity: 1, y: 0, filter: 'blur(0px)',
              transition: { delay: delay + i * 0.072, ...SPRING_SOFT },
            },
            exit: {
              opacity: 0, filter: 'blur(10px)',
              transition: { duration: 0.45, ease: [0.4, 0, 1, 1] },
            },
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
});

// ── Ambient background blobs ──────────────────────────────────────────────────

const AmbientBlobs = memo(function AmbientBlobs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* Top-end blob */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '-15%', insetInlineEnd: '-10%',
          width: '55%', height: '55%',
          background: 'radial-gradient(ellipse, rgba(0,122,255,0.08) 0%, transparent 65%)',
        }}
      />
      {/* Bottom-start blob */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.72, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{
          position: 'absolute',
          bottom: '-10%', insetInlineStart: '-8%',
          width: '50%', height: '50%',
          background: 'radial-gradient(ellipse, rgba(0,199,190,0.07) 0%, transparent 65%)',
        }}
      />
      {/* Mid subtle */}
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        style={{
          position: 'absolute',
          top: '30%', insetInlineStart: '30%',
          width: '40%', height: '40%',
          background: 'radial-gradient(ellipse, rgba(94,92,230,0.04) 0%, transparent 65%)',
        }}
      />
    </div>
  );
});

// ── Inspiration quote cycling ─────────────────────────────────────────────────

function InspirationQuotes() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % QUOTES.length), 6000);
    return () => clearInterval(id);
  }, []);

  const quote = QUOTES[index];

  return (
    <div style={{ textAlign: 'center', padding: '0 clamp(24px, 6vw, 80px)' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {/* Line 1 — heavy */}
          <WordReveal
            text={quote.line1}
            delay={0.05}
            style={{
              fontSize:      'clamp(2rem, 4.2vw, 3.8rem)',
              fontWeight:    800,
              letterSpacing: '-0.038em',
              lineHeight:    1.08,
              color:         'var(--text-primary)',
            }}
          />
          {/* Line 2 — light, brand accent */}
          <WordReveal
            text={quote.line2}
            delay={0.35}
            style={{
              fontSize:      'clamp(1.3rem, 2.6vw, 2.4rem)',
              fontWeight:    300,
              letterSpacing: '-0.015em',
              lineHeight:    1.2,
              color:         'var(--text-secondary)',
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Quote progress dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 28 }}>
        {QUOTES.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === index ? 20 : 5, background: i === index ? AZURE : 'rgba(0,0,0,0.16)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: 5, borderRadius: 3, cursor: 'pointer' }}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Search input ──────────────────────────────────────────────────────────────

function SearchInput() {
  const [value,    setValue]    = useState('');
  const [focused,  setFocused]  = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;
    const v = value.toLowerCase();
    const zone =
      v.includes('flight') || v.includes('fly') ? 'flights'     :
      v.includes('hotel')  || v.includes('stay') ? 'lodging'    :
      v.includes('food')   || v.includes('eat') || v.includes('restaurant') ? 'dining' :
      v.includes('tour')   || v.includes('experience') || v.includes('visit') ? 'attractions' :
      v.includes('bus')    || v.includes('train') || v.includes('car') ? 'transit' :
      'flights';
    router.push(`/zone/${zone}`);
  }, [value, router]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <motion.div
      animate={{ boxShadow: focused ? `0 0 0 3px rgba(0,122,255,0.18), var(--shadow-lg)` : `var(--shadow-md)` }}
      transition={{ duration: 0.2 }}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        background:      'rgba(255,255,255,0.90)',
        backdropFilter:  'blur(32px)',
        border:          `1.5px solid ${focused ? 'rgba(0,122,255,0.3)' : 'rgba(255,255,255,0.95)'}`,
        borderRadius:    18,
        paddingBlock:    14,
        paddingInline:   18,
        maxWidth:        540,
        width:           '100%',
        transition:      'border-color 0.2s ease',
      }}
    >
      {/* Sparkle */}
      <motion.span
        animate={{ rotate: focused ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ fontSize: 18, flexShrink: 0, opacity: focused ? 1 : 0.6 }}
      >
        ✦
      </motion.span>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKey}
        placeholder="Where to next?"
        style={{
          flex:        1,
          background:  'none',
          border:      'none',
          outline:     'none',
          fontSize:    16,
          fontWeight:  500,
          color:       'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      />

      {/* Send */}
      <AnimatePresence>
        {value.trim() && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.93 }}
            transition={SPRING_SNAPPY}
            onClick={handleSubmit}
            style={{
              width:      34,
              height:     34,
              borderRadius: '50%',
              background:  AZURE,
              border:      'none',
              display:     'flex',
              alignItems:  'center',
              justifyContent: 'center',
              cursor:      'pointer',
              flexShrink:  0,
              fontSize:    14,
              color:       '#fff',
              boxShadow:   '0 4px 12px rgba(0,122,255,0.35)',
            }}
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Quick action chips ────────────────────────────────────────────────────────

const QuickActions = memo(function QuickActions() {
  const router = useRouter();
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {QUICK_ACTIONS.map((a, i) => (
        <motion.button
          key={a.zone}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_SOFT, delay: 0.6 + i * 0.07 }}
          whileHover={{ y: -2, boxShadow: `0 6px 20px rgba(0,0,0,0.08)` }}
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push(`/zone/${a.zone}`)}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            paddingBlock:   8,
            paddingInline:  14,
            borderRadius:   12,
            background:     'rgba(255,255,255,0.80)',
            border:         '1px solid rgba(255,255,255,0.95)',
            boxShadow:      'var(--shadow-sm)',
            backdropFilter: 'blur(20px)',
            cursor:         'pointer',
            fontSize:       13,
            fontWeight:     600,
            color:          'var(--text-primary)',
            letterSpacing:  '-0.01em',
            transition:     'border-color 0.15s ease',
          }}
        >
          <span style={{ fontSize: 15 }}>{a.icon}</span>
          {a.label}
        </motion.button>
      ))}
    </div>
  );
});

// ── Dynamic Workspace (2/3) ───────────────────────────────────────────────────

function DynamicWorkspace() {
  return (
    <div
      style={{
        flex:           2,
        minWidth:       0,
        position:       'relative',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            40,
        padding:        'clamp(24px, 4vw, 60px)',
        overflow:       'hidden',
      }}
    >
      <AmbientBlobs />

      {/* ── Top bar: brand mark + locale toggle ───────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, delay: 0.1 }}
        style={{
          position:         'absolute',
          top:              22,
          insetInlineStart: 28,
          insetInlineEnd:   28,
          display:          'flex',
          alignItems:       'center',
          justifyContent:   'space-between',
          zIndex:           10,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            Unitravel
          </span>
          <span style={{
            fontSize: 8, fontWeight: 800, color: AZURE,
            background: 'rgba(0,122,255,0.08)',
            border: '1px solid rgba(0,122,255,0.2)',
            borderRadius: 5, paddingBlock: 2, paddingInline: 5,
            letterSpacing: '0.06em',
          }}>
            AI
          </span>
        </div>

        {/* Locale toggle — floats top-end */}
        <LocaleToggle />
      </motion.div>

      {/* Hero quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ zIndex: 1, width: '100%' }}
      >
        <InspirationQuotes />
      </motion.div>

      {/* Search input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, delay: 0.5 }}
        style={{ zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}
      >
        <SearchInput />
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        style={{ zIndex: 1 }}
      >
        <QuickActions />
      </motion.div>
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <LayoutGroup>
      <main
        style={{
          display:    'flex',
          height:     '100dvh',
          width:      '100vw',
          overflow:   'hidden',
          background: 'var(--surface-base)',
        }}
      >
        {/* 2/3 — Dynamic Workspace */}
        <DynamicWorkspace />

        {/* 1/3 — AI Concierge (streaming, tool-calling) */}
        <ConciergePanel />
      </main>
    </LayoutGroup>
  );
}
