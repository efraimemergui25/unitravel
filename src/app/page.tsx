'use client';

import { useState, useRef, useCallback, useMemo, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  motion, AnimatePresence,
  useMotionValue, useSpring, useTransform,
} from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Canvas, useThree } from '@react-three/fiber';
import { useTexture, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  Plane, Hotel, UtensilsCrossed, Compass, Train, CloudSun,
  MessageSquare, LayoutGrid, ArrowRight, Sparkles, Mic, Zap,
} from 'lucide-react';
import { useTravelEngine } from '@/store/useTravelEngine';
import { GuidedJourney }    from '@/components/GuidedJourney';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Stage   = 'globe' | 'flash' | 'main';
type CardFocus = 'ai' | 'manual' | null;


// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────

const ZONES = [
  { icon: Plane,           label: 'Flights',     color: '#007AFF', bg: 'rgba(0,122,255,0.07)',   border: 'rgba(0,122,255,0.18)',   href: '/zone/flights'     },
  { icon: Hotel,           label: 'Stays',        color: '#5AC8FA', bg: 'rgba(90,200,250,0.07)',  border: 'rgba(90,200,250,0.20)',  href: '/zone/lodging'     },
  { icon: UtensilsCrossed, label: 'Dining',       color: '#FF9F0A', bg: 'rgba(255,159,10,0.07)',  border: 'rgba(255,159,10,0.18)',  href: '/zone/dining'      },
  { icon: Compass,         label: 'Experiences',  color: '#30D158', bg: 'rgba(48,209,88,0.07)',   border: 'rgba(48,209,88,0.18)',   href: '/zone/attractions' },
  { icon: Train,           label: 'Transit',      color: '#BF5AF2', bg: 'rgba(191,90,242,0.07)',  border: 'rgba(191,90,242,0.18)', href: '/zone/transit'     },
  { icon: CloudSun,        label: 'Conditions',   color: '#FF453A', bg: 'rgba(255,69,58,0.07)',   border: 'rgba(255,69,58,0.18)',  href: '/zone/conditions'  },
];

// Template chips pre-populate the store and navigate directly to management
const TEMPLATES = [
  {
    label: 'Honeymoon', sub: '7 nights · 2 ppl', color: '#FF2D55',
    trip: { title: 'Honeymoon', travelers: ['Partner 1', 'Partner 2'], nights: 7, totalBudget: 8000 },
  },
  {
    label: 'Backpacker', sub: '14 nights · solo', color: '#30D158',
    trip: { title: 'Backpacker Adventure', travelers: ['Traveler'], nights: 14, totalBudget: 2500 },
  },
  {
    label: 'Luxury Week', sub: '5 nights · 2 ppl', color: '#FF9F0A',
    trip: { title: 'Luxury Getaway', travelers: ['Guest 1', 'Guest 2'], nights: 5, totalBudget: 15000 },
  },
];

const PROMPT_CHIPS = [
  'Paris, 5 days in June',
  'Beach for 2 in August',
  'Maldives honeymoon',
  'Tokyo adventure',
];

// ─────────────────────────────────────────────────────────────────────────────
// EARTH GLOBE — OrbitControls handles drag natively (most reliable approach)
// ─────────────────────────────────────────────────────────────────────────────

function EarthMesh() {
  const [dayMap, nightMap] = useTexture(['/earth-texture.jpg', '/earth-night.jpg']);

  return (
    <group>
      {/* Day layer — PBR, well-lit */}
      <mesh>
        <sphereGeometry args={[2.2, 128, 128]} />
        <meshStandardMaterial map={dayMap} roughness={0.58} metalness={0.02} />
      </mesh>

      {/* Night city-lights — additively blended so they only show on dark side */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[2.2, 128, 128]} />
        <meshBasicMaterial map={nightMap} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.88} />
      </mesh>

      {/* Thin atmosphere rim — tight scale keeps it subtle */}
      <mesh scale={1.02}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshLambertMaterial color={new THREE.Color('#5599FF')} transparent opacity={0.09} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GlobeScene() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.setClearColor(0x000000, 0);
    scene.background = null;
  }, [gl, scene]);

  return (
    <>
      {/* High ambient — keeps Earth colorful, avoids pitch-black dark side */}
      <ambientLight intensity={0.72} color="#FFFFFF" />
      {/* Primary sun — upper right front, warm */}
      <directionalLight position={[4, 2.5, 4]} intensity={1.75} color="#FFF9F0" />
      {/* Subtle fill from left to show dark-side detail */}
      <directionalLight position={[-3, 0, 2]}   intensity={0.28} color="#EEF3FF" />

      <Suspense fallback={null}>
        <EarthMesh />
      </Suspense>

      {/* OrbitControls — battle-tested, handles mouse + touch drag natively */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.45}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.55}
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.78}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT TITLE
// ─────────────────────────────────────────────────────────────────────────────

function SplitTitle({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span style={{ display: 'inline-block' }}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 40, rotateX: -45, scale: 0.82 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28, delay: delay + i * 0.028 }}
          style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT COUNTER
// ─────────────────────────────────────────────────────────────────────────────

function StatCounter({ target, label, delay = 0, pulse = false }: {
  target: string; label: string; delay?: number; pulse?: boolean;
}) {
  const num    = useMemo(() => parseInt(target.replace(/[^0-9]/g, ''), 10), [target]);
  const suffix = useMemo(() => target.replace(/[0-9]+/, ''), [target]);
  const shouldAnimate = !isNaN(num) && num > 0;
  const [display, setDisplay] = useState(shouldAnimate ? '0' + suffix : target);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (!shouldAnimate) return;
    let raf: number;
    const t = setTimeout(() => {
      const start = performance.now();
      const dur   = 1100;
      const tick  = (now: number) => {
        const p    = Math.min((now - start) / dur, 1);
        const ease = 1 - (1 - p) ** 3;
        setDisplay(String(Math.round(ease * num)) + suffix);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay * 1000);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [shouldAnimate, num, suffix, delay]);

  useEffect(() => {
    if (!pulse) return;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 380);
    return () => clearTimeout(t);
  }, [pulse]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      style={{ textAlign: 'center' }}
    >
      <motion.div
        animate={pulsing ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={pulsing ? { duration: 0.30, ease: [0.22, 1, 0.36, 1] } : { duration: 0.18 }}
      >
        <div style={{ fontSize: 19, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {display}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3 }}>
          {label}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE WAVE  —  light theme: indigo bars
// ─────────────────────────────────────────────────────────────────────────────

function VoiceWave({ active }: { active: boolean }) {
  const heights = [8, 14, 18, 14, 8];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          style={{ width: 3, borderRadius: 2, background: '#007AFF', originY: 0.5 }}
          animate={active
            ? { height: [h * 0.5, h * 1.2, h * 0.4, h, h * 0.5], opacity: [0.5, 1, 0.6, 1, 0.5] }
            : { height: 4, opacity: 0.35 }}
          transition={active ? { duration: 0.75, repeat: Infinity, ease: 'easeInOut', delay: i * 0.11 } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CHAT INPUT  —  light Apple style
// ─────────────────────────────────────────────────────────────────────────────

function AIChatInput({ onSend, cardHovered, onFocusChange }: {
  onSend: (q: string) => void;
  cardHovered: boolean;
  onFocusChange: (focused: boolean) => void;
}) {
  const [val, setVal]         = useState('');
  const [focused, setFocused] = useState(false);
  const [voiceOn, setVoice]   = useState(false);

  const handleFocus = useCallback(() => { setFocused(true);  onFocusChange(true);  }, [onFocusChange]);
  const handleBlur  = useCallback(() => {
    setTimeout(() => { setFocused(false); onFocusChange(false); }, 180);
  }, [onFocusChange]);

  const submit = useCallback((q: string) => { if (q.trim()) onSend(q.trim()); }, [onSend]);

  const borderColor = focused
    ? 'rgba(0,122,255,0.40)'
    : cardHovered
    ? 'rgba(0,122,255,0.22)'
    : 'rgba(0,0,0,0.10)';

  const glowShadow = focused
    ? '0 0 0 3px rgba(0,122,255,0.12), 0 2px 12px rgba(0,0,0,0.08)'
    : '0 1px 4px rgba(0,0,0,0.06)';

  return (
    <div style={{ width: '100%' }}>
      <motion.div
        animate={{ boxShadow: glowShadow, borderColor }}
        transition={{ duration: 0.18 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 14,
          background: 'rgba(255,255,255,0.85)',
          border: `1.5px solid ${borderColor}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <input
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === 'Enter') submit(val); }}
          placeholder='Where to? "Paris, 5 days in June, under $2,000"'
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, fontWeight: 400, color: '#1D1D1F',
            fontFamily: 'inherit', letterSpacing: '-0.01em', minWidth: 0,
          }}
        />
        <motion.button
          onMouseDown={() => setVoice(v => !v)}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: voiceOn ? 'rgba(0,122,255,0.12)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${voiceOn ? 'rgba(0,122,255,0.28)' : 'rgba(0,0,0,0.09)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {voiceOn ? <VoiceWave active /> : <Mic size={13} color="#6E6E73" strokeWidth={2} />}
        </motion.button>
        <AnimatePresence>
          {val && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 440, damping: 26 }}
              onClick={() => submit(val)}
              whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.94 }}
              style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,122,255,0.32)',
              }}
            >
              <ArrowRight size={14} color="white" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Prompt chips */}
      <motion.div
        animate={{ y: focused ? -3 : 0 }}
        transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}
      >
        {PROMPT_CHIPS.map((chip, i) => (
          <motion.button
            key={chip}
            initial={{ opacity: 0, y: 5, scale: 0.90 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.10 + i * 0.05, type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => { setVal(chip); submit(chip); }}
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(0,122,255,0.10)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '4px 11px', borderRadius: 100,
              background: 'rgba(0,122,255,0.06)',
              border: '1px solid rgba(0,122,255,0.14)',
              color: '#007AFF',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.005em',
            }}
          >
            {chip}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const router            = useRouter();
  const setupTrip         = useTravelEngine(s => s.setupTrip);
  const addDay            = useTravelEngine(s => s.addDay);
  const [stage, setStage]     = useState<Stage>('globe');
  const [showTap, setShowTap] = useState(false);
  const [travelers, setTravelers] = useState(142);

  const [showGuidedJourney, setShowGuidedJourney] = useState(false);

  const [focusedCard, setFocusedCard]     = useState<CardFocus>(null);
  const [hoveredZone, setHoveredZone]     = useState<number | null>(null);
  const [aiInputFocused, setAiInputFocused] = useState(false);
  const [statsPulse, setStatsPulse]       = useState(false);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 48, damping: 18 });
  const sy = useSpring(my, { stiffness: 48, damping: 18 });
  const tx = useTransform(sx, [-0.5, 0.5], [-8, 8]);
  const ty = useTransform(sy, [-0.5, 0.5], [-5, 5]);

  const advTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref keeps advance() current inside the keyboard effect
  const advanceRef = useRef<() => void>(() => {});

  const advance = useCallback(() => {
    if (stage !== 'globe') return;
    if (advTimerRef.current) clearTimeout(advTimerRef.current);
    setStage('flash');
    advTimerRef.current = setTimeout(() => setStage('main'), 520);
  }, [stage]);

  // Keep ref always current so keyboard handler is never stale
  useEffect(() => { advanceRef.current = advance; });

  useEffect(() => {
    const t1 = setTimeout(() => setShowTap(true), 1400);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advanceRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t1);
      if (advTimerRef.current) clearTimeout(advTimerRef.current);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/trips', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then((d: { count?: number } | null) => { if (d?.count && d.count > 0) setTravelers(d.count); })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (stage !== 'main') return;
    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      setStatsPulse(true);
      t2 = setTimeout(() => setStatsPulse(false), 380);
    }, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stage]);

  // NeuralOnboarding no longer auto-triggers on home page.
  // It shows inside zone pages for first-time users (see zone layout).

  const goTo = useCallback((path: string, query?: string) => {
    if (query) {
      try {
        const prompt = query.length < 40
          ? `Plan a trip to ${query} — show me flights, top stays, and must-see experiences.`
          : query;
        sessionStorage.setItem('unitravel-ai-prompt', prompt);
      } catch {}
    }
    setTimeout(() => router.push(path), 280);
  }, [router]);

  const applyTemplate = useCallback((tpl: typeof TEMPLATES[number]) => {
    const today = new Date();
    const startDate = new Date(today); startDate.setDate(today.getDate() + 14);
    const endDate   = new Date(startDate); endDate.setDate(startDate.getDate() + tpl.trip.nights);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    setupTrip({
      title: tpl.trip.title,
      travelers: tpl.trip.travelers,
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      nights: tpl.trip.nights,
      totalBudget: tpl.trip.totalBudget,
    });
    for (let i = 0; i < tpl.trip.nights; i++) {
      const d = new Date(startDate); d.setDate(startDate.getDate() + i);
      addDay({
        id: `day-${i + 1}`,
        date: fmt(d),
        dayNumber: i + 1,
        destination: '',
        entities: [],
        budget: Math.round(tpl.trip.totalBudget / tpl.trip.nights),
        weather: { temp: 22, icon: '☀️', condition: 'Sunny' },
      });
    }
    goTo('/zone/management');
  }, [setupTrip, addDay, goTo]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    mx.set(e.clientX / window.innerWidth  - 0.5);
    my.set(e.clientY / window.innerHeight - 0.5);
  }, [mx, my]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const aiRecede     = focusedCard === 'manual';
  const manualRecede = focusedCard === 'ai';

  // ─── Shared Apple light card style ───────────────────────────────────────
  const cardBase = {
    flex: '1 1 0',
    padding: '22px',
    borderRadius: 22,
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    display: 'flex', flexDirection: 'column' as const, gap: 0,
    position: 'relative' as const, overflow: 'hidden',
    cursor: 'default',
    border: '1px solid rgba(255,255,255,0.98)',
  };

  return createPortal(
    <div onMouseMove={onMouseMove} style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden' }}>

      {/* ════ GLOBE STAGE ════ */}
      <AnimatePresence>
        {stage === 'globe' && (
          <motion.div key="globe"
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
            transition={{ duration: 0.30 }}
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 50% 40%, #0D1B3E 0%, #070E22 45%, #040810 100%)',
            }}
          >
            {/* Deep-space nebula clouds */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(30,60,160,0.22) 0%, transparent 65%)', animation: 'breathe 24s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', top: '-15%', right: '-8%', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(80,40,180,0.16) 0%, transparent 65%)', animation: 'breathe 28s ease-in-out infinite', animationDelay: '8s' }} />
              <div style={{ position: 'absolute', bottom: '-10%', left: '15%', width: '65%', height: '50%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(20,50,140,0.14) 0%, transparent 65%)', animation: 'breathe 20s ease-in-out infinite', animationDelay: '4s' }} />
            </div>

            {/* Three.js Earth Globe — OrbitControls handles drag + auto-rotation */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>
              <Canvas
                camera={{ position: [0, 0, 6.5], fov: 42 }}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                style={{ width: '100%', height: '100%', background: 'transparent', cursor: 'grab' }}
              >
                <GlobeScene />
              </Canvas>
            </div>

            {/* Overlay UI */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '44px 0 56px' }}>

              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.95)', textTransform: 'uppercase' }}>UNIT</span>
                <span style={{ fontSize: 15, fontWeight: 300, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>RAVEL</span>
              </motion.div>

              {/* Tagline + CTA */}
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.9 }}
                style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
              >
                <p style={{
                  fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.38)',
                  letterSpacing: '0.28em', textTransform: 'uppercase', margin: 0,
                }}>Your AI Travel Operating System</p>

                <AnimatePresence>
                  {showTap && (
                    <motion.button
                      initial={{ opacity: 0, y: 16, scale: 0.90 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                      onClick={advance}
                      whileHover={{ scale: 1.04, y: -3, boxShadow: '0 20px 60px rgba(0,0,0,0.55), inset 0 1.5px 0 rgba(255,255,255,0.55)' }}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 28px 14px 20px', borderRadius: 100,
                        background: 'rgba(255,255,255,0.10)',
                        border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(60px) saturate(2)',
                        WebkitBackdropFilter: 'blur(60px) saturate(2)',
                        cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.40), inset 0 1.5px 0 rgba(255,255,255,0.40), inset 0 -1px 0 rgba(0,0,0,0.12)',
                      }}
                      aria-label="Enter Unitravel"
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: 8,
                        background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 3px 14px rgba(0,122,255,0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
                        flexShrink: 0,
                      }}>
                        <Sparkles size={11} color="#fff" strokeWidth={2.5} />
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.01em' }}>
                        Begin your journey
                      </span>
                      <ArrowRight size={13} color="rgba(255,255,255,0.40)" strokeWidth={2.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ FLASH ════ */}
      <AnimatePresence>
        {stage === 'flash' && (
          <motion.div key="flash"
            style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'radial-gradient(circle at center, #FFFFFF 0%, rgba(240,246,255,0.98) 30%, rgba(210,225,255,0.88) 55%, rgba(190,210,255,0.50) 75%, transparent 90%)' }}
            initial={{ opacity: 0, scale: 0.06 }}
            animate={{ opacity: [0, 1, 0.90, 0], scale: [0.06, 1.0, 1.25, 1.60] }}
            transition={{ duration: 0.52, times: [0, 0.27, 0.62, 1.0], ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* ════ MAIN STAGE ════ */}
      <AnimatePresence>
        {stage === 'main' && (
          <motion.div key="main"
            initial={{ opacity: 0, scale: 0.980 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', inset: 0, overflow: 'hidden',
              // Apple system background
              background: 'linear-gradient(160deg, #FFFFFF 0%, #F5F5F7 28%, #F0EFFE 56%, #EDF4FF 100%)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Ambient blobs */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              {([
                { top: '-18%', left: '-5%',   w: '50%', h: '56%', c: 'rgba(0,122,255,0.09)',   a: 'breathe 20s ease-in-out infinite'       },
                { top: '-8%',  right: '-4%',  w: '42%', h: '46%', c: 'rgba(88,86,214,0.07)',   a: 'breathe 24s ease-in-out infinite', d: '7s'  },
                { bottom: '-13%', right: '7%', w: '40%', h: '40%', c: 'rgba(90,200,250,0.06)', a: 'breathe 22s ease-in-out infinite', d: '4s'  },
              ] as { top?: string; left?: string; right?: string; bottom?: string; w: string; h: string; c: string; a: string; d?: string }[]).map((b, i) => (
                <div key={i} style={{ position: 'absolute', top: b.top, left: b.left, right: b.right, bottom: b.bottom, width: b.w, height: b.h, borderRadius: '50%', background: `radial-gradient(ellipse,${b.c} 0%,transparent 65%)`, animation: b.a, animationDelay: b.d ?? '0s' }} />
              ))}
            </div>

            {/* TOP BAR */}
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', top: 24, left: 24, right: 24, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, pointerEvents: 'auto' }}>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.04em', color: '#1D1D1F' }}>UNIT</span>
                <span style={{ fontSize: 13, fontWeight: 300, letterSpacing: '0.05em', color: '#48484A' }}>RAVEL</span>
              </div>
              <motion.div
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.72 }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px 5px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(255,255,255,0.98)', boxShadow: '0 3px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)', backdropFilter: 'blur(20px)', pointerEvents: 'auto' }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#30D158', boxShadow: '0 0 0 2px rgba(48,209,88,0.20)', animation: 'pulse-glow 2.4s ease-in-out infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3A3A3C', letterSpacing: '-0.01em' }}>
                  <span style={{ color: '#1C8A39', fontWeight: 800 }}>{travelers}</span> planning now
                </span>
              </motion.div>
            </motion.div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 28px 20px', overflowY: 'auto' }}>
              <motion.div style={{ x: tx, y: ty, width: '100%', maxWidth: 940 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                  {/* Badge */}
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30, delay: 0.08 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px 7px 8px', borderRadius: 100, background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.16)', boxShadow: '0 2px 14px rgba(0,122,255,0.07), inset 0 1px 0 rgba(255,255,255,0.90)', marginBottom: 14 }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 7, background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,122,255,0.32)', flexShrink: 0 }}>
                      <Zap size={10} color="#fff" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#007AFF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      151+ Live Engines · Zero Hidden Fees · Real-time AI
                    </span>
                  </motion.div>

                  {/* Wordmark */}
                  <h1 style={{ fontSize: 'clamp(3.0rem,6.2vw,5.2rem)', fontWeight: 900, letterSpacing: '-0.055em', lineHeight: 0.92, margin: '0 0 8px', textAlign: 'center', background: 'linear-gradient(140deg, #1D1D1F 0%, #1D1D1F 20%, #007AFF 48%, #5856D6 70%, #BF5AF2 88%, #FF2D55 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', perspective: '900px' }}>
                    <SplitTitle text="Unitravel." delay={0.10} />
                  </h1>

                  {/* Tagline */}
                  <motion.p
                    initial={{ opacity: 0, y: 6, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.46, delay: 0.30, ease: [0.22, 1, 0.36, 1] }}
                    style={{ fontSize: 17, fontWeight: 400, color: '#48484A', margin: '0 0 22px', letterSpacing: '-0.012em', textAlign: 'center', lineHeight: 1.4 }}
                  >
                    Every flight, stay, and experience — unified by intelligence.
                  </motion.p>

                  {/* TWO-PATH CARDS */}
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1], delay: 0.42 }}
                    style={{ display: 'flex', gap: 14, width: '100%', alignItems: 'stretch' }}
                  >

                    {/* ── AI CHAT CARD — Apple light, blue accent ── */}
                    <motion.div
                      onMouseEnter={() => setFocusedCard('ai')}
                      onMouseLeave={() => setFocusedCard(null)}
                      animate={{
                        opacity:   aiRecede ? 0.48 : 1,
                        scale:     aiRecede ? 0.992 : focusedCard === 'ai' ? 1.007 : 1,
                        filter:    aiRecede ? 'blur(1.5px) brightness(0.94)' : 'blur(0px) brightness(1)',
                        boxShadow: focusedCard === 'ai'
                          ? '0 24px 72px rgba(0,122,255,0.18), 0 8px 24px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,1)'
                          : '0 8px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
                      }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        ...cardBase,
                        border: '1px solid rgba(0,122,255,0.14)',
                      }}
                    >
                      {/* Blue gradient top accent */}
                      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #007AFF, #5856D6, #BF5AF2)', borderRadius: '22px 22px 0 0', pointerEvents: 'none' }} />

                      {/* Specular top line */}
                      <div aria-hidden style={{ position: 'absolute', left: '6%', right: '6%', top: 3, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 35%, rgba(255,255,255,1) 65%, transparent)', borderRadius: 999, pointerEvents: 'none' }} />

                      {/* Very subtle blue ambient glow */}
                      <div aria-hidden style={{ position: 'absolute', top: '-30%', left: '-10%', width: '70%', height: '60%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,122,255,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />

                      {/* Card header */}
                      <motion.div
                        animate={{ opacity: aiInputFocused ? 0.35 : 1, y: aiInputFocused ? -2 : 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, position: 'relative', zIndex: 1, marginTop: 6 }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,122,255,0.10) 0%, rgba(88,86,214,0.10) 100%)', border: '1px solid rgba(0,122,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,122,255,0.10)', flexShrink: 0 }}>
                          <MessageSquare size={18} color="#007AFF" strokeWidth={1.8} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.030em', lineHeight: 1.2 }}>Chat with Unit AI</div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#6E6E73', letterSpacing: '-0.005em', marginTop: 1 }}>Your personal AI travel concierge</div>
                        </div>
                        <motion.button
                          animate={{ opacity: aiInputFocused ? 0 : 1 }}
                          transition={{ duration: 0.18 }}
                          whileHover={{ scale: 1.06 }}
                          whileTap={{ scale: 0.96 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px 5px 7px', borderRadius: 100, background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.16)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                        >
                          <Mic size={11} color="#007AFF" strokeWidth={2} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#007AFF', letterSpacing: '0.01em' }}>or speak</span>
                        </motion.button>
                      </motion.div>

                      <motion.p
                        animate={{ opacity: aiInputFocused ? 0 : 1, y: aiInputFocused ? -4 : 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        style={{ fontSize: 12.5, color: '#6E6E73', margin: '0 0 14px', letterSpacing: '-0.005em', lineHeight: 1.55, position: 'relative', zIndex: 1 }}
                      >
                        Tell Unit where you want to go — it curates flights, stays, dining, and every detail. Instantly.
                      </motion.p>

                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <AIChatInput
                          onSend={() => setShowGuidedJourney(true)}
                          cardHovered={focusedCard === 'ai'}
                          onFocusChange={setAiInputFocused}
                        />
                      </div>

                      {/* CTA */}
                      <motion.button
                        animate={{ opacity: aiInputFocused ? 1 : 0.88 }}
                        whileHover={{ scale: 1.02, opacity: 1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowGuidedJourney(true)}
                        transition={{ duration: 0.16 }}
                        style={{
                          marginTop: 'auto', paddingTop: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          padding: '12px 22px', borderRadius: 100,
                          background: 'linear-gradient(135deg, rgba(0,122,255,0.92) 0%, rgba(88,86,214,0.92) 100%)',
                          border: '1px solid rgba(255,255,255,0.28)',
                          backdropFilter: 'blur(20px) saturate(1.6)',
                          WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                          boxShadow: '0 6px 28px rgba(0,122,255,0.36), 0 2px 8px rgba(0,0,0,0.08), inset 0 1.5px 0 rgba(255,255,255,0.42), inset 0 -1px 0 rgba(0,0,0,0.10)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          position: 'relative', zIndex: 1,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.015em' }}>Plan my trip with AI</span>
                        <ArrowRight size={13} color="rgba(255,255,255,0.80)" strokeWidth={2.5} />
                      </motion.button>
                    </motion.div>

                    {/* ── BUILD MANUALLY CARD — Apple light, neutral ── */}
                    <motion.div
                      onMouseEnter={() => setFocusedCard('manual')}
                      onMouseLeave={() => { setFocusedCard(null); setHoveredZone(null); }}
                      animate={{
                        opacity:   manualRecede ? 0.48 : 1,
                        scale:     manualRecede ? 0.992 : focusedCard === 'manual' ? 1.007 : 1,
                        filter:    manualRecede ? 'blur(1.5px) brightness(0.96)' : 'blur(0px) brightness(1)',
                        boxShadow: focusedCard === 'manual'
                          ? '0 20px 60px rgba(0,0,0,0.11), 0 6px 18px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,1)'
                          : '0 8px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
                      }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        ...cardBase,
                        border: '1px solid rgba(0,0,0,0.07)',
                      }}
                    >
                      {/* Neutral top accent */}
                      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #30D158, #00C7BE, #5AC8FA)', borderRadius: '22px 22px 0 0', pointerEvents: 'none' }} />

                      {/* Specular */}
                      <div aria-hidden style={{ position: 'absolute', left: '6%', right: '6%', top: 3, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 35%, rgba(255,255,255,1) 65%, transparent)', borderRadius: 999, pointerEvents: 'none' }} />

                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, marginTop: 6 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(48,209,88,0.10)', flexShrink: 0 }}>
                          <LayoutGrid size={18} color="#1C8A39" strokeWidth={1.8} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.030em', lineHeight: 1.2 }}>Build your trip</div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#6E6E73', letterSpacing: '-0.005em', marginTop: 1 }}>Search every engine, your way</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 100, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.22)', flexShrink: 0 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158', flexShrink: 0, animation: 'pulse-glow 2.4s ease-in-out infinite' }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#1C8A39', whiteSpace: 'nowrap' }}>Best time: Now</span>
                        </div>
                      </div>

                      <p style={{ fontSize: 12.5, color: '#6E6E73', margin: '0 0 14px', letterSpacing: '-0.005em', lineHeight: 1.55 }}>
                        Access 151+ live engines across all 6 zones — full control, zero compromise.
                      </p>

                      {/* Zone grid with Common Fate ripple */}
                      <div
                        onMouseLeave={() => setHoveredZone(null)}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 14 }}
                      >
                        {ZONES.map((zone, i) => {
                          const Icon = zone.icon;
                          const isHovered  = hoveredZone === i;
                          const sameRow    = hoveredZone !== null && Math.floor(i / 3) === Math.floor(hoveredZone / 3) && !isHovered;
                          const otherRow   = hoveredZone !== null && Math.floor(i / 3) !== Math.floor(hoveredZone / 3);

                          return (
                            <motion.button
                              key={zone.label}
                              initial={{ opacity: 0, scale: 0.88, y: 5 }}
                              animate={{
                                opacity:         !isHovered && otherRow ? 0.60 : 1,
                                scale:           isHovered ? 1.05 : sameRow ? 1.02 : otherRow ? 0.97 : 1,
                                y:               isHovered ? -3 : sameRow ? -1 : otherRow ? 1 : 0,
                                backgroundColor: isHovered ? zone.bg : 'rgba(245,245,247,0.90)',
                                borderColor:     isHovered ? zone.border : 'rgba(0,0,0,0.06)',
                                boxShadow:       isHovered
                                  ? `0 5px 18px ${zone.color}22, inset 0 1px 0 rgba(255,255,255,1)`
                                  : '0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)',
                              }}
                              transition={{
                                duration: 0.20,
                                delay:    sameRow ? 0.02 : otherRow ? 0.04 : 0,
                                ease:     [0.22, 1, 0.36, 1],
                                opacity:  { delay: 0.60 + i * 0.04 },
                              }}
                              onMouseEnter={() => setHoveredZone(i)}
                              onMouseLeave={() => setHoveredZone(null)}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => goTo(zone.href)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '7px 10px', borderRadius: 11,
                                cursor: 'pointer', fontFamily: 'inherit',
                                border: '1px solid',
                              }}
                            >
                              <Icon size={13} color={zone.color} strokeWidth={2} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{zone.label}</span>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Template chips — pre-populate store and navigate to management */}
                      <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
                        {TEMPLATES.map((t, i) => (
                          <motion.button
                            key={t.label}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.72 + i * 0.07, type: 'spring', stiffness: 400, damping: 30 }}
                            whileHover={{ scale: 1.04, y: -2, boxShadow: `0 6px 20px ${t.color}22` }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => applyTemplate(t)}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                              padding: '8px 14px', borderRadius: 12,
                              background: `${t.color}08`,
                              border: `1.5px solid ${t.color}20`,
                              cursor: 'pointer', fontFamily: 'inherit',
                              flex: '1 1 0',
                              transition: 'border-color 0.15s',
                            }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{t.label}</span>
                            <span style={{ fontSize: 9.5, fontWeight: 500, color: '#8E8E93', marginTop: 2 }}>{t.sub}</span>
                          </motion.button>
                        ))}
                      </div>

                      {/* CTA — goes to flights zone as default entry */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -2, boxShadow: '0 12px 36px rgba(0,0,0,0.09), 0 4px 12px rgba(0,0,0,0.05), inset 0 2px 0 rgba(255,255,255,1)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => goTo('/zone/flights')}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          padding: '12px 22px', borderRadius: 100,
                          background: 'rgba(255,255,255,0.72)',
                          border: '1px solid rgba(255,255,255,0.92)',
                          backdropFilter: 'blur(40px) saturate(2)',
                          WebkitBackdropFilter: 'blur(40px) saturate(2)',
                          boxShadow: '0 6px 28px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,0.03)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          marginTop: 'auto',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.015em' }}>Start building</span>
                        <ArrowRight size={13} color="rgba(0,0,0,0.40)" strokeWidth={2.5} />
                      </motion.button>
                    </motion.div>

                  </motion.div>

                  {/* STATS STRIP */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.48, delay: 0.80, ease: [0.22, 1, 0.36, 1] }}
                    style={{ display: 'flex', alignItems: 'center', marginTop: 14, padding: '11px 28px', borderRadius: 100, background: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', boxShadow: '0 2px 14px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)' }}
                  >
                    {([
                      { value: '151+', label: 'Live Engines' },
                      { value: '0',    label: 'Hidden Fees'  },
                      { value: 'AI',   label: 'Price Watch'  },
                      { value: '∞',    label: 'Trip Combos'  },
                    ] as { value: string; label: string }[]).map((s, i) => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
                        {i > 0 && <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.07)', margin: '0 28px' }} />}
                        <StatCounter
                          target={s.value}
                          label={s.label}
                          delay={0.86 + i * 0.08}
                          pulse={statsPulse}
                        />
                      </div>
                    ))}
                  </motion.div>

                </div>
              </motion.div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ GUIDED AI JOURNEY — full screen chat overlay ════ */}
      <AnimatePresence>
        {showGuidedJourney && (
          <GuidedJourney onSwitch={() => setShowGuidedJourney(false)} />
        )}
      </AnimatePresence>

    </div>,
    document.body
  );
}
