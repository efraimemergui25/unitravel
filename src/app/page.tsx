'use client';

import {
  useState, useEffect, useCallback, useRef, memo,
  type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence }        from 'framer-motion';
import { useRouter }                      from 'next/navigation';
import { LocaleToggle }                   from '@/components/ui/LocaleToggle';
import { useLocaleEngine }                from '@/store/useLocaleEngine';
import { MorphingTransition }             from '@/components/onboarding/MorphingTransition';
import { InitialHandshake }               from '@/components/ai/InitialHandshake';
import { Plane, Hotel, Utensils, Compass, Map } from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────

const AZURE   = '#007AFF';
const EMERALD = '#30D158';
const AMBER   = '#FF9F0A';
const INDIGO  = '#5E5CE6';
const TEAL    = '#00C7BE';

const SPRING_SOFT   = { type: 'spring', stiffness: 280, damping: 28 } as const;
const SPRING_SNAPPY = { type: 'spring', stiffness: 420, damping: 32 } as const;

// ── Cycling entry prompts (en + he) ───────────────────────────────────────────

const PROMPTS: Record<string, string[]> = {
  'en-US': [
    'Where does the journey begin?',
    'Plan your next escape.',
    'What adventure are you dreaming of?',
    'Tell me where you want to go.',
    'Your next chapter starts here.',
  ],
  'he-IL': [
    'לאן המסע מתחיל?',
    'תכנן את ההרפתקה הבאה שלך.',
    'לאן את/ה חולם/ת לנסוע?',
    'ספר לי לאן תרצה לטוס.',
    'הפרק הבא שלך מתחיל כאן.',
  ],
};

// ── Workspace zone grid ────────────────────────────────────────────────────────

const ZONES = [
  { id: 'flights',     Icon: Plane,    label: 'Aviation Hub',   color: AZURE,   path: '/zone/flights'     },
  { id: 'lodging',     Icon: Hotel,    label: 'Lodging Matrix', color: INDIGO,  path: '/zone/lodging'     },
  { id: 'dining',      Icon: Utensils, label: 'Culinary Hub',   color: AMBER,   path: '/zone/dining'      },
  { id: 'attractions', Icon: Compass,  label: 'Experiences',    color: EMERALD, path: '/zone/attractions' },
  { id: 'transit',     Icon: Map,      label: 'Transit Grid',   color: TEAL,    path: '/zone/transit'     },
];

// ── Animated mesh background ──────────────────────────────────────────────────

const MeshBackground = memo(function MeshBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <motion.div
        animate={{ scale: [1, 1.12, 1], x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position:   'absolute',
          top:        '-20%', insetInlineEnd: '-10%',
          width:      '70%',  height: '70%',
          background: 'radial-gradient(ellipse, rgba(0,122,255,0.10) 0%, transparent 65%)',
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.08, 1], x: [0, -25, 0], y: [0, 18, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        style={{
          position:   'absolute',
          bottom:     '-15%', insetInlineStart: '-10%',
          width:      '60%',  height: '60%',
          background: 'radial-gradient(ellipse, rgba(0,199,190,0.08) 0%, transparent 65%)',
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.14, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        style={{
          position:   'absolute',
          top:        '35%',  insetInlineStart: '20%',
          width:      '50%',  height: '50%',
          background: 'radial-gradient(ellipse, rgba(94,92,230,0.06) 0%, transparent 65%)',
        }}
      />
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 9 }}
        style={{
          position:   'absolute',
          bottom:     '10%',  insetInlineEnd: '5%',
          width:      '40%',  height: '40%',
          background: 'radial-gradient(ellipse, rgba(255,159,10,0.06) 0%, transparent 65%)',
        }}
      />
    </div>
  );
});

// ── Cycling prompt display ────────────────────────────────────────────────────

function CyclingPrompt({ locale }: { locale: string }) {
  const [index, setIndex] = useState(0);
  const prompts = PROMPTS[locale] ?? PROMPTS['en-US'];

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % prompts.length), 4200);
    return () => clearInterval(id);
  }, [prompts.length]);

  return (
    <div style={{ height: 40, overflow: 'hidden', position: 'relative' }}>
      <AnimatePresence mode="wait">
        <motion.p
          key={`${locale}-${index}`}
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position:      'absolute',
            inset:         0,
            margin:        0,
            fontSize:      'clamp(1.05rem, 1.8vw, 1.35rem)',
            fontWeight:    300,
            letterSpacing: '-0.015em',
            lineHeight:    1.3,
            color:         'var(--text-secondary)',
            textAlign:     'center',
            whiteSpace:    'nowrap',
          }}
        >
          {prompts[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ── Entry search input ─────────────────────────────────────────────────────────

function EntryInput({
  onSubmit,
  isRtl,
  locale,
}: {
  onSubmit: (value: string) => void;
  isRtl:   boolean;
  locale:  string;
}) {
  const [value,   setValue]   = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = locale === 'he-IL'
    ? 'הזן יעד, תאריכים, מספר נוסעים...'
    : 'Enter destination, dates, travelers...';

  const handleSubmit = useCallback(() => {
    if (value.trim()) onSubmit(value.trim());
  }, [value, onSubmit]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <motion.div
      animate={{
        boxShadow: focused
          ? '0 0 0 3px rgba(0,122,255,0.15), 0 20px 60px rgba(0,0,0,0.10)'
          : '0 8px 40px rgba(0,0,0,0.08)',
      }}
      transition={{ duration: 0.2 }}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:             10,
        background:     'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(40px) saturate(1.9)',
        border:         `1.5px solid ${focused ? 'rgba(0,122,255,0.28)' : 'rgba(255,255,255,0.95)'}`,
        borderRadius:    22,
        paddingBlock:    16,
        paddingInline:   20,
        width:          '100%',
        transition:     'border-color 0.2s ease',
        boxShadow:      'inset 0 1px 0 rgba(255,255,255,1)',
        direction:       isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* Sparkle */}
      <motion.span
        animate={{ rotate: focused ? 180 : 0, opacity: focused ? 1 : 0.55 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ fontSize: 18, flexShrink: 0 }}
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
        placeholder={placeholder}
        style={{
          flex:         1,
          background:   'none',
          border:       'none',
          outline:      'none',
          fontSize:     16,
          fontWeight:   500,
          color:        'var(--text-primary)',
          letterSpacing: '-0.01em',
          direction:    isRtl ? 'rtl' : 'ltr',
          minWidth:     0,
        }}
      />

      <AnimatePresence>
        {value.trim() && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            transition={SPRING_SNAPPY}
            onClick={handleSubmit}
            style={{
              width:          36,
              height:         36,
              borderRadius:  '50%',
              background:     AZURE,
              border:         'none',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              cursor:         'pointer',
              flexShrink:     0,
              fontSize:       14,
              color:          '#fff',
              boxShadow:      '0 4px 14px rgba(0,122,255,0.38)',
            }}
          >
            {isRtl ? '←' : '↑'}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Quick zone chips (landing) ────────────────────────────────────────────────

const QuickZoneChips = memo(function QuickZoneChips({
  onSubmit,
}: { onSubmit: (query: string) => void }) {
  const QUICK = [
    { label: 'Flights',      query: 'Find me flights',                color: AZURE   },
    { label: 'Hotels',       query: 'Find me a hotel',                color: INDIGO  },
    { label: 'Dining',       query: 'Find great restaurants',         color: AMBER   },
    { label: 'Experiences',  query: 'Discover local experiences',     color: EMERALD },
  ];

  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
      {QUICK.map((q, i) => (
        <motion.button
          key={q.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_SOFT, delay: 0.7 + i * 0.06 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onSubmit(q.query)}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:             5,
            paddingBlock:    8,
            paddingInline:   14,
            borderRadius:    12,
            background:     'rgba(255,255,255,0.80)',
            border:         '1px solid rgba(255,255,255,0.95)',
            boxShadow:      '0 2px 10px rgba(0,0,0,0.05)',
            backdropFilter: 'blur(20px)',
            cursor:         'pointer',
            fontSize:       13,
            fontWeight:      600,
            color:          'var(--text-primary)',
            letterSpacing:  '-0.01em',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: q.color, flexShrink: 0 }} />
          {q.label}
        </motion.button>
      ))}
    </div>
  );
});

// ── Cinematic entry screen ────────────────────────────────────────────────────

function EntryScreen({
  onSubmit,
  isRtl,
  locale,
}: {
  onSubmit: (value: string) => void;
  isRtl:   boolean;
  locale:  string;
}) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 620, padding: '0 20px' }}>
      {/* Glass card */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...SPRING_SOFT, delay: 0.1 }}
        style={{
          background:     'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(56px) saturate(1.9)',
          border:         '1.5px solid rgba(255,255,255,0.95)',
          borderRadius:    36,
          padding:        'clamp(32px, 5vw, 52px) clamp(28px, 4vw, 48px)',
          boxShadow:      '0 24px 80px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,1)',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:             28,
        }}
      >
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_SOFT, delay: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            Unitravel
          </span>
          <span style={{
            fontSize:      8,
            fontWeight:    800,
            color:         AZURE,
            background:    'rgba(0,122,255,0.08)',
            border:        '1px solid rgba(0,122,255,0.18)',
            borderRadius:   5,
            paddingBlock:   2,
            paddingInline:  6,
            letterSpacing: '0.06em',
          }}>
            AI
          </span>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{ textAlign: 'center', width: '100%' }}
        >
          <h1 style={{
            margin:        0,
            marginBottom:  12,
            fontSize:      'clamp(1.8rem, 3.5vw, 2.8rem)',
            fontWeight:    900,
            letterSpacing: '-0.04em',
            lineHeight:    1.08,
            color:         'var(--text-primary)',
          }}>
            {locale === 'he-IL'
              ? 'תכנן כל טיול — בשניות.'
              : 'Plan any trip — in seconds.'}
          </h1>
          <CyclingPrompt locale={locale} />
        </motion.div>

        {/* Search input */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_SOFT, delay: 0.45 }}
          style={{ width: '100%' }}
        >
          <EntryInput onSubmit={onSubmit} isRtl={isRtl} locale={locale} />
        </motion.div>

        {/* Quick zone chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.65 }}
        >
          <QuickZoneChips onSubmit={onSubmit} />
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── Post-morph workspace (2/3 panel) ─────────────────────────────────────────

function WorkspacePanel() {
  const router = useRouter();

  return (
    <div
      className="glass-panel"
      style={{
        height:         '100%',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:             32,
        padding:        'clamp(24px, 4vw, 56px)',
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Ambient blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position:   'absolute',
            top:        '-20%', insetInlineEnd: '-10%',
            width:      '55%',  height: '55%',
            background: 'radial-gradient(ellipse, rgba(0,122,255,0.07) 0%, transparent 65%)',
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          style={{
            position:   'absolute',
            bottom:     '-15%', insetInlineStart: '-8%',
            width:      '50%',  height: '50%',
            background: 'radial-gradient(ellipse, rgba(0,199,190,0.06) 0%, transparent 65%)',
          }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, delay: 0.3 }}
        style={{ textAlign: 'center', zIndex: 1 }}
      >
        <p style={{
          margin:        0,
          marginBottom:   8,
          fontSize:       11,
          fontWeight:     700,
          letterSpacing: '0.06em',
          color:         'var(--text-tertiary)',
        }}>
          MISSION CONTROL
        </p>
        <h2 style={{
          margin:        0,
          fontSize:      'clamp(1.3rem, 2.2vw, 1.9rem)',
          fontWeight:    800,
          letterSpacing: '-0.035em',
          lineHeight:    1.1,
          color:         'var(--text-primary)',
        }}>
          Select your zone
        </h2>
      </motion.div>

      {/* Zone grid */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap:                  10,
        width:               '100%',
        maxWidth:             520,
        zIndex:               1,
      }}>
        {ZONES.map((zone, i) => {
          const { Icon } = zone;
          const isLast = i === ZONES.length - 1 && ZONES.length % 2 !== 0;
          return (
            <motion.button
              key={zone.id}
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...SPRING_SOFT, delay: 0.35 + i * 0.07 }}
              whileHover={{ y: -3, boxShadow: `0 10px 28px ${zone.color}28` }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push(zone.path)}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:      isLast ? 'center' : 'flex-start',
                gap:             10,
                padding:        '18px 20px',
                borderRadius:    22,
                background:     'rgba(255,255,255,0.72)',
                border:         '1.5px solid rgba(255,255,255,0.90)',
                backdropFilter: 'blur(32px) saturate(1.8)',
                boxShadow:      '0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)',
                cursor:         'pointer',
                textAlign:      isLast ? 'center' : 'start',
                gridColumn:      isLast ? '1 / -1' : undefined,
                justifyContent:  isLast ? 'center' : undefined,
              }}
            >
              <div style={{
                width:          36,
                height:         36,
                borderRadius:   10,
                background:    `${zone.color}14`,
                border:        `1px solid ${zone.color}25`,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}>
                <Icon size={17} strokeWidth={2} color={zone.color} />
              </div>
              <div>
                <p style={{
                  margin:        0,
                  fontSize:       14,
                  fontWeight:     700,
                  color:          'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}>
                  {zone.label}
                </p>
                <p style={{
                  margin:        0,
                  marginTop:      2,
                  fontSize:       11,
                  fontWeight:     500,
                  color:          'var(--text-secondary)',
                }}>
                  30 live engines
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Management link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => router.push('/zone/management')}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:             7,
          paddingBlock:    10,
          paddingInline:   20,
          borderRadius:    12,
          background:     'rgba(255,255,255,0.65)',
          border:         '1px solid rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          cursor:         'pointer',
          fontSize:        13,
          fontWeight:      600,
          color:           'var(--text-secondary)',
          letterSpacing:  '-0.01em',
          zIndex:          1,
        }}
      >
        <span>🗓</span>
        View trip timeline
        <span style={{ opacity: 0.5, fontSize: 12 }}>→</span>
      </motion.button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const { profile } = useLocaleEngine();
  const isRtl  = profile.direction === 'rtl';
  const locale = profile.locale;

  const [morphed,      setMorphed]      = useState(false);
  const [firstPrompt,  setFirstPrompt]  = useState('');

  const handleSubmit = useCallback((value: string) => {
    setFirstPrompt(value);
    setMorphed(true);
  }, []);

  return (
    <main
      style={{
        width:     '100vw',
        height:    '100vh',
        overflow:  'hidden',
        position:  'relative',
        background: 'linear-gradient(135deg, #fdfbfb 0%, #eff1f5 50%, #edf0f8 100%)',
        direction:  isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* Animated mesh background — always visible */}
      <MeshBackground />

      {/* Top-bar — brand + locale toggle */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, delay: 0.05 }}
        style={{
          position:         'fixed',
          top:               16,
          insetInlineStart:  24,
          insetInlineEnd:    24,
          display:          'flex',
          alignItems:       'center',
          justifyContent:   'space-between',
          zIndex:            40,
          pointerEvents:    morphed ? 'none' : 'auto',
          opacity:           morphed ? 0 : 1,
          transition:       'opacity 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            Unitravel
          </span>
          <span style={{
            fontSize:      7,
            fontWeight:    800,
            color:         AZURE,
            background:   'rgba(0,122,255,0.08)',
            border:       '1px solid rgba(0,122,255,0.18)',
            borderRadius:  4,
            paddingBlock:  2,
            paddingInline: 5,
            letterSpacing: '0.06em',
          }}>
            AI
          </span>
        </div>
        <LocaleToggle />
      </motion.div>

      {/* Morphing layout */}
      <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 10 }}>
        <MorphingTransition
          morphed={morphed}
          aiPanel={
            firstPrompt
              ? <InitialHandshake prompt={firstPrompt} onZoneLaunch={() => {}} />
              : null
          }
          workspace={<WorkspacePanel />}
        >
          {/* Entry screen (pre-morph centered content) */}
          <EntryScreen
            onSubmit={handleSubmit}
            isRtl={isRtl}
            locale={locale}
          />
        </MorphingTransition>
      </div>
    </main>
  );
}
