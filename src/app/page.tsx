'use client';

import {
  useState, useEffect, useRef, useCallback, memo,
  type KeyboardEvent,
} from 'react';
import {
  motion, AnimatePresence, LayoutGroup,
  useMotionValue, useSpring,
} from 'framer-motion';
import { useRouter } from 'next/navigation';

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

// ── AI preview messages ───────────────────────────────────────────────────────

const AI_PREVIEW = [
  {
    id:   'a1',
    text: 'I\'ve found 94 flights to Mexico City across 12 engines. Aeromexico has the best business class seat tonight.',
    icon: '✈',
  },
  {
    id:   'a2',
    text: 'Your Tulum eco-lodge has a hidden resort fee. I found the same room on Booking.com for 18% less.',
    icon: '🔍',
  },
  {
    id:   'a3',
    text: 'Pujol has a cancellation on Day 4 at 19:30. Michelin ✦✦ — it matches your schedule perfectly.',
    icon: '🌟',
  },
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

      {/* ✦ Brand mark */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, delay: 0.1 }}
        style={{
          position:     'absolute',
          top:          28,
          insetInlineStart: 32,
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          zIndex:       10,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
          Unitravel
        </span>
        <span style={{
          fontSize: 9, fontWeight: 800, color: AZURE,
          background: 'rgba(0,122,255,0.08)',
          border: '1px solid rgba(0,122,255,0.2)',
          borderRadius: 5, paddingBlock: 2, paddingInline: 5,
          letterSpacing: '0.04em',
        }}>
          AI
        </span>
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

// ── AI preview message bubble ─────────────────────────────────────────────────

const AIMessage = memo(function AIMessage({
  msg, delay,
}: {
  msg:   typeof AI_PREVIEW[number];
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_SOFT, delay }}
      layoutId={msg.id}
      className="drag-card"
      style={{
        display:        'flex',
        gap:            10,
        padding:        '11px 13px',
        borderRadius:   14,
        background:     'rgba(255,255,255,0.90)',
        border:         '1px solid rgba(255,255,255,0.95)',
        boxShadow:      'var(--shadow-sm)',
        cursor:         'grab',
      }}
    >
      <div style={{
        width:          34,
        height:         34,
        borderRadius:   10,
        background:     'rgba(0,122,255,0.08)',
        border:         '1px solid rgba(0,122,255,0.14)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       16,
        flexShrink:     0,
      }}>
        {msg.icon}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>
        {msg.text}
      </p>
    </motion.div>
  );
});

// ── AI Brain Panel (1/3) ──────────────────────────────────────────────────────

function AIBrainPanel() {
  const [input,   setInput]   = useState('');
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    const v = input.toLowerCase();
    const zone =
      v.includes('flight') || v.includes('fly') ? 'flights'  :
      v.includes('hotel')                        ? 'lodging'  :
      v.includes('eat')    || v.includes('food') ? 'dining'   :
      v.includes('tour')                         ? 'attractions' :
      'flights';
    router.push(`/zone/${zone}`);
  }, [input, router]);

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ ...SPRING_SOFT, delay: 0.15 }}
      style={{
        flex:                '0 0 clamp(280px, 32%, 400px)',
        display:             'flex',
        flexDirection:       'column',
        height:              '100dvh',
        background:          'rgba(255,255,255,0.78)',
        backdropFilter:      'blur(48px) saturate(1.9)',
        WebkitBackdropFilter:'blur(48px) saturate(1.9)',
        borderInlineStart:   '1px solid rgba(0,0,0,0.06)',
        boxShadow:           'inset 1px 0 0 rgba(255,255,255,1)',
        position:            'relative',
        overflow:            'hidden',
      }}
    >
      {/* Subtle top-edge specular */}
      <div style={{
        position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
        zIndex: 1,
      }} />

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        padding:       '22px 20px 16px',
        borderBottom:  '1px solid rgba(0,0,0,0.05)',
        flexShrink:    0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {/* Logo mark */}
            <div style={{
              width:          36,
              height:         36,
              borderRadius:   11,
              background:     `linear-gradient(135deg, ${AZURE}, #5E5CE6)`,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       16,
              boxShadow:      `0 4px 14px rgba(0,122,255,0.30)`,
              flexShrink:     0,
            }}>
              ✦
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                AI Concierge
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                Unitravel Intelligence
              </div>
            </div>
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="pulse-dot" />
            <span style={{ fontSize: 10, fontWeight: 600, color: EMERALD }}>Live</span>
          </div>
        </div>

        {/* Capability chips */}
        <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
          {['94 engines', '10 zones', 'Real-time'].map(chip => (
            <div key={chip} style={{
              fontSize:     9,
              fontWeight:   700,
              color:        'var(--text-secondary)',
              background:   'rgba(0,0,0,0.04)',
              border:       '1px solid rgba(0,0,0,0.07)',
              borderRadius: 6,
              paddingBlock: 3,
              paddingInline:7,
            }}>
              {chip}
            </div>
          ))}
        </div>
      </div>

      {/* ── Messages / Cards ──────────────────────────────── */}
      <div style={{
        flex:      1,
        overflowY: 'auto',
        padding:   '16px 16px',
        display:   'flex',
        flexDirection: 'column',
        gap:       10,
      }}>
        {/* Intro message */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_SOFT, delay: 0.4 }}
          style={{
            fontSize:     12,
            lineHeight:   1.55,
            color:        'var(--text-secondary)',
            background:   'rgba(0,122,255,0.05)',
            border:       '1px solid rgba(0,122,255,0.10)',
            borderRadius: 14,
            padding:      '10px 13px',
          }}
        >
          Hi. I've scanned 94 travel engines this morning. Here are three things you should know before planning your next trip.
        </motion.div>

        {/* AI insight cards (draggable to workspace) */}
        {AI_PREVIEW.map((msg, i) => (
          <AIMessage key={msg.id} msg={msg} delay={0.55 + i * 0.12} />
        ))}

        {/* Drag hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          style={{
            textAlign:  'center',
            fontSize:   10,
            color:      'var(--text-tertiary)',
            padding:    '6px 0',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap:        4,
          }}
        >
          <span>Drag cards to workspace</span>
          <span style={{ opacity: 0.6 }}>→</span>
        </motion.div>
      </div>

      {/* ── Chat input ────────────────────────────────────── */}
      <div style={{
        padding:      '12px 14px 20px',
        borderTop:    '1px solid rgba(0,0,0,0.05)',
        flexShrink:   0,
      }}>
        <motion.div
          animate={{
            boxShadow: focused
              ? `0 0 0 2.5px rgba(0,122,255,0.18), var(--shadow-md)`
              : `var(--shadow-sm)`,
          }}
          transition={{ duration: 0.2 }}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            background:     'rgba(245,245,247,0.90)',
            border:         `1.5px solid ${focused ? 'rgba(0,122,255,0.25)' : 'rgba(0,0,0,0.07)'}`,
            borderRadius:   14,
            paddingBlock:   11,
            paddingInline:  13,
            transition:     'border-color 0.2s ease',
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Ask me anything about your trip…"
            style={{
              flex:         1,
              background:   'none',
              border:       'none',
              outline:      'none',
              fontSize:     12,
              fontWeight:   500,
              color:        'var(--text-primary)',
              letterSpacing:'-0.01em',
            }}
          />
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            onClick={handleSubmit}
            style={{
              width:          30,
              height:         30,
              borderRadius:   '50%',
              background:     input.trim() ? AZURE : 'rgba(0,0,0,0.08)',
              border:         'none',
              cursor:         'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       12,
              color:          input.trim() ? '#fff' : 'var(--text-tertiary)',
              flexShrink:     0,
              transition:     'background 0.2s ease, color 0.2s ease',
              boxShadow:      input.trim() ? '0 3px 10px rgba(0,122,255,0.30)' : 'none',
            }}
          >
            ↑
          </motion.button>
        </motion.div>

        {/* Suggested prompts */}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          {['Mexico honeymoon', 'Business class deals', 'Michelin ✦✦✦'].map(prompt => (
            <button
              key={prompt}
              onClick={() => setInput(prompt)}
              style={{
                fontSize:     9,
                fontWeight:   600,
                color:        AZURE,
                background:   'rgba(0,122,255,0.06)',
                border:       '1px solid rgba(0,122,255,0.14)',
                borderRadius: 7,
                paddingBlock: 3,
                paddingInline:7,
                cursor:       'pointer',
                transition:   'background 0.15s ease',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </motion.aside>
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

        {/* 1/3 — AI Brain (inset-inline-end: auto-flips in RTL) */}
        <AIBrainPanel />
      </main>
    </LayoutGroup>
  );
}
