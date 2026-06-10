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
  ArrowRight, Sparkles, Mic,
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

interface PinData { name: string; flag: string; lat: number; lon: number; color: string; }

const DEST_PINS: PinData[] = [
  { name: 'Paris',          flag: '🇫🇷', lat:  48.85, lon:   2.35, color: '#FF9F0A' },
  { name: 'Tokyo',          flag: '🇯🇵', lat:  35.67, lon: 139.65, color: '#FF453A' },
  { name: 'New York',       flag: '🇺🇸', lat:  40.71, lon: -74.01, color: '#007AFF' },
  { name: 'Dubai',          flag: '🇦🇪', lat:  25.20, lon:  55.27, color: '#30D158' },
  { name: 'Sydney',         flag: '🇦🇺', lat: -33.87, lon: 151.21, color: '#BF5AF2' },
  { name: 'Rome',           flag: '🇮🇹', lat:  41.90, lon:  12.50, color: '#FF2D55' },
  { name: 'Barcelona',      flag: '🇪🇸', lat:  41.38, lon:   2.17, color: '#FF9F0A' },
  { name: 'London',         flag: '🇬🇧', lat:  51.50, lon:  -0.12, color: '#5E5CE6' },
  { name: 'Bangkok',        flag: '🇹🇭', lat:  13.75, lon: 100.50, color: '#00C7BE' },
  { name: 'Bali',           flag: '🇮🇩', lat:  -8.34, lon: 115.09, color: '#30D158' },
  { name: 'Istanbul',       flag: '🇹🇷', lat:  41.01, lon:  28.97, color: '#FF9F0A' },
  { name: 'Amsterdam',      flag: '🇳🇱', lat:  52.37, lon:   4.90, color: '#007AFF' },
  { name: 'Singapore',      flag: '🇸🇬', lat:   1.35, lon: 103.82, color: '#30D158' },
  { name: 'Lisbon',         flag: '🇵🇹', lat:  38.72, lon:  -9.14, color: '#FF9F0A' },
  { name: 'Prague',         flag: '🇨🇿', lat:  50.08, lon:  14.43, color: '#5E5CE6' },
  { name: 'Cancun',         flag: '🇲🇽', lat:  21.16, lon: -86.85, color: '#00C7BE' },
  { name: 'Santorini',      flag: '🇬🇷', lat:  36.39, lon:  25.46, color: '#007AFF' },
  { name: 'Marrakech',      flag: '🇲🇦', lat:  31.63, lon:  -7.99, color: '#FF9F0A' },
  { name: 'Cape Town',      flag: '🇿🇦', lat: -33.93, lon:  18.42, color: '#FF453A' },
  { name: 'Rio de Janeiro', flag: '🇧🇷', lat: -22.91, lon: -43.17, color: '#30D158' },
  { name: 'Miami',          flag: '🇺🇸', lat:  25.77, lon: -80.19, color: '#FF2D55' },
  { name: 'Maldives',       flag: '🇲🇻', lat:   4.17, lon:  73.51, color: '#00C7BE' },
  { name: 'Kyoto',          flag: '🇯🇵', lat:  35.01, lon: 135.77, color: '#FF2D55' },
  { name: 'Vienna',         flag: '🇦🇹', lat:  48.21, lon:  16.37, color: '#BF5AF2' },
  { name: 'Reykjavik',      flag: '🇮🇸', lat:  64.13, lon: -21.93, color: '#5AC8FA' },
  { name: 'Buenos Aires',   flag: '🇦🇷', lat: -34.60, lon: -58.38, color: '#FF9F0A' },
  { name: 'Hong Kong',      flag: '🇭🇰', lat:  22.32, lon: 114.18, color: '#FF2D55' },
  { name: 'Berlin',         flag: '🇩🇪', lat:  52.52, lon:  13.40, color: '#5E5CE6' },
  { name: 'Toronto',        flag: '🇨🇦', lat:  43.65, lon: -79.38, color: '#007AFF' },
  { name: 'Cairo',          flag: '🇪🇬', lat:  30.04, lon:  31.24, color: '#FF9F0A' },
];

function latLonToXYZ(lat: number, lon: number, r: number): [number, number, number] {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ];
}

function DestinationPins({ onPinHover, onPinLeave, onPinClick }: {
  onPinHover: (pin: PinData, x: number, y: number) => void;
  onPinLeave: () => void;
  onPinClick: (pin: PinData) => void;
}) {
  return (
    <>
      {DEST_PINS.map((d, i) => {
        const pos = latLonToXYZ(d.lat, d.lon, 2.23);
        return (
          <group
            key={i}
            position={pos}
            onPointerOver={(e) => {
              e.stopPropagation();
              const ne = e.nativeEvent as MouseEvent;
              onPinHover(d, ne.clientX, ne.clientY);
            }}
            onPointerOut={() => onPinLeave()}
            onClick={(e) => { e.stopPropagation(); onPinClick(d); }}
          >
            <mesh>
              <sphereGeometry args={[0.034, 12, 12]} />
              <meshBasicMaterial color={d.color} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.082, 12, 12]} />
              <meshBasicMaterial color={d.color} transparent opacity={0.20} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function EarthMesh() {
  const [dayMap, nightMap] = useTexture(['/earth-texture.jpg', '/earth-night.jpg']);

  return (
    <group>
      {/* meshBasicMaterial ignores all lighting — texture always full brightness */}
      <mesh>
        <sphereGeometry args={[2.2, 128, 128]} />
        <meshBasicMaterial map={dayMap} />
      </mesh>
      {/* Night city-lights via additive blending on top */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[2.2, 128, 128]} />
        <meshBasicMaterial map={nightMap} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

function GlobeScene({ onPinHover, onPinLeave, onPinClick, autoRotate }: {
  onPinHover: (pin: PinData, x: number, y: number) => void;
  onPinLeave: () => void;
  onPinClick: (pin: PinData) => void;
  autoRotate: boolean;
}) {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.setClearColor(0x000000, 0);
    scene.background = null;
  }, [gl, scene]);

  return (
    <>
      <Suspense fallback={null}>
        <EarthMesh />
        <DestinationPins onPinHover={onPinHover} onPinLeave={onPinLeave} onPinClick={onPinClick} />
      </Suspense>
      {/* OrbitControls — drag + autoRotate, no custom handlers needed */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.6}
        minPolarAngle={Math.PI * 0.20}
        maxPolarAngle={Math.PI * 0.80}
      />
    </>
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

  const [focusedCard, setFocusedCard] = useState<CardFocus>(null);
  const [statsPulse, setStatsPulse]   = useState(false);
  const [hoveredPin, setHoveredPin]   = useState<(PinData & { x: number; y: number }) | null>(null);

  const handlePinHover  = useCallback((pin: PinData, x: number, y: number) => setHoveredPin({ ...pin, x, y }), []);
  const handlePinLeave  = useCallback(() => setHoveredPin(null), []);
  const handlePinClick  = useCallback((pin: PinData) => {
    setHoveredPin(null);
    try { sessionStorage.setItem('unitravel:prefill:destination', pin.name); } catch {}
    router.push('/zone/flights');
  }, [router]);

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

  return createPortal(
    <div onMouseMove={onMouseMove} style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden' }}>

      {/* ════ GLOBE STAGE ════ */}
      <AnimatePresence>
        {stage === 'globe' && (
          <motion.div key="globe"
            exit={{ opacity: 0, filter: 'blur(14px)' }}
            transition={{ duration: 0.28 }}
            style={{
              position: 'absolute', inset: 0, overflow: 'hidden',
              background: 'linear-gradient(160deg, #EDF0FF 0%, #FFFFFF 40%, #F4F0FF 68%, #EEF4FF 100%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: 38, paddingBottom: 40,
            }}
          >
            {/* ① Logo */}
            <motion.div
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline' }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.20em', color: '#1C1C1E', textTransform: 'uppercase' }}>UNIT</span>
              <span style={{ fontSize: 14, fontWeight: 300, letterSpacing: '0.30em', color: 'rgba(0,0,0,0.28)', textTransform: 'uppercase' }}>RAVEL</span>
            </motion.div>

            {/* ② Headline — own flex row, never overlaps globe */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.65 }}
              style={{ flexShrink: 0, textAlign: 'center', marginTop: 18, marginBottom: 4 }}
            >
              <div style={{
                fontSize: 'clamp(24px, 3.6vw, 50px)', fontWeight: 900,
                letterSpacing: '-0.042em', lineHeight: 1.0,
                background: 'linear-gradient(128deg, #1C1C1E 0%, #1C1C1E 28%, #007AFF 54%, #5856D6 74%, #BF5AF2 92%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                whiteSpace: 'nowrap',
              }}>The World Is Yours</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.28)', letterSpacing: '0.24em', textTransform: 'uppercase', marginTop: 10 }}>
                Your AI Travel Operating System
              </div>
            </motion.div>

            {/* ③ Globe — flex:1 so it fills all remaining vertical space */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 1.4, delay: 0.15 }}
              style={{
                flex: 1, minHeight: 0, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}
            >
              {/* Atmospheric halo — CSS only, behind globe */}
              <div style={{
                position: 'absolute',
                width: 'min(78vmin, calc(100vw - 20px))', height: 'min(78vmin, calc(100vw - 20px))',
                borderRadius: '50%', pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(100,140,255,0.09) 60%, rgba(120,160,255,0.05) 74%, transparent 87%)',
              }} />
              {/* Globe circle */}
              <div style={{
                width: 'min(66vmin, calc(100vw - 40px))', height: 'min(66vmin, calc(100vw - 40px))',
                borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                boxShadow: '0 28px 72px rgba(50,90,200,0.20), 0 6px 28px rgba(50,90,200,0.10), 0 0 0 1px rgba(140,170,255,0.18)',
                cursor: hoveredPin ? 'pointer' : 'default',
              }}>
                <Canvas
                  camera={{ position: [0, 0, 6.2], fov: 44 }}
                  gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                  style={{ width: '100%', height: '100%', background: 'transparent' }}
                >
                  <GlobeScene
                    onPinHover={handlePinHover}
                    onPinLeave={handlePinLeave}
                    onPinClick={handlePinClick}
                    autoRotate={!hoveredPin}
                  />
                </Canvas>
              </div>
            </motion.div>

            {/* ④ CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 1.1 }}
              style={{ flexShrink: 0, marginTop: 18 }}
            >
              <AnimatePresence>
                {showTap && (
                  <motion.button
                    initial={{ opacity: 0, y: 12, scale: 0.90 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.90 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    onClick={advance}
                    whileHover={{ scale: 1.04, y: -2, boxShadow: '0 20px 56px rgba(0,80,200,0.18), inset 0 1.5px 0 rgba(255,255,255,1)' }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 26px 13px 18px', borderRadius: 100,
                      background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(255,255,255,1)',
                      backdropFilter: 'blur(48px) saturate(1.9)', WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 8px 32px rgba(0,60,180,0.11), 0 2px 8px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,1)',
                    }}
                    aria-label="Enter Unitravel"
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: 8,
                      background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 3px 12px rgba(0,122,255,0.45)', flexShrink: 0,
                    }}>
                      <Sparkles size={11} color="#fff" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.01em' }}>Begin your journey</span>
                    <ArrowRight size={13} color="rgba(0,0,0,0.28)" strokeWidth={2.5} />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ PIN TOOLTIP ════ */}
      <AnimatePresence>
        {hoveredPin && stage === 'globe' && (
          <motion.div
            key="pin-tooltip"
            initial={{ opacity: 0, scale: 0.84, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 3, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 540, damping: 30 }}
            style={{
              position: 'fixed',
              left: hoveredPin.x + 16,
              top: hoveredPin.y - 52,
              zIndex: 200,
              pointerEvents: 'none',
              fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px 8px 10px',
              borderRadius: 100,
              background: 'rgba(255,255,255,0.92)',
              border: `1.5px solid ${hoveredPin.color}44`,
              backdropFilter: 'blur(40px) saturate(1.9)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
              boxShadow: `0 8px 28px rgba(0,0,0,0.13), 0 2px 8px ${hoveredPin.color}1A, inset 0 1px 0 rgba(255,255,255,1)`,
              whiteSpace: 'nowrap',
            }}>
              {/* Colored dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: hoveredPin.color,
                boxShadow: `0 0 0 3px ${hoveredPin.color}26`,
                flexShrink: 0,
              }} />
              {/* Flag + name */}
              <span style={{ fontSize: 13.5 }}>{hoveredPin.flag}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.015em' }}>
                {hoveredPin.name}
              </span>
              {/* Divider + CTA */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                paddingInlineStart: 8,
                borderInlineStart: '1px solid rgba(0,0,0,0.09)',
                marginInlineStart: 2,
              }}>
                <Plane size={10} color={hoveredPin.color} strokeWidth={2.5} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: hoveredPin.color, letterSpacing: '-0.01em' }}>
                  Search flights
                </span>
              </div>
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

            {/* MAIN CONTENT — single column, clear hierarchy */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '72px 24px 28px', overflowY: 'auto' }}>
              <motion.div style={{ x: tx, y: ty, width: '100%', maxWidth: 680 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

                  {/* ① Hero headline — warm, human, travel-forward */}
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
                    style={{ textAlign: 'center', marginBottom: 22 }}
                  >
                    <h1 style={{
                      fontSize: 'clamp(2.4rem, 5vw, 4.2rem)', fontWeight: 900,
                      letterSpacing: '-0.052em', lineHeight: 1.0, margin: 0,
                      background: 'linear-gradient(138deg, #1C1C1E 0%, #1C1C1E 24%, #007AFF 52%, #5856D6 72%, #BF5AF2 90%)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    }}>Where to next?</h1>
                    <p style={{ fontSize: 15, color: 'rgba(0,0,0,0.42)', marginTop: 10, marginBottom: 0, letterSpacing: '-0.012em', fontWeight: 400, lineHeight: 1.45 }}>
                      Tell Unit your dream — flights, stays, dining and experiences,<br />all searched at once.
                    </p>
                  </motion.div>

                  {/* ② Full-width AI glass card — the hero action */}
                  <motion.div
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.60, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
                    onMouseEnter={() => setFocusedCard('ai')}
                    onMouseLeave={() => setFocusedCard(null)}
                    style={{
                      width: '100%', padding: '18px 18px 16px',
                      borderRadius: 26,
                      background: 'rgba(255,255,255,0.97)',
                      backdropFilter: 'blur(52px) saturate(2)',
                      WebkitBackdropFilter: 'blur(52px) saturate(2)',
                      border: '1px solid rgba(255,255,255,1)',
                      boxShadow: focusedCard === 'ai'
                        ? '0 28px 80px rgba(0,100,255,0.16), 0 6px 24px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,1)'
                        : '0 10px 44px rgba(0,0,0,0.08), 0 2px 10px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
                      marginBottom: 20, position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {/* Full-spectrum top accent */}
                    <div aria-hidden style={{ position: 'absolute', top: 0, insetInlineStart: 0, insetInlineEnd: 0, height: 2.5, background: 'linear-gradient(90deg, #007AFF, #5856D6, #BF5AF2, #FF2D55)', borderRadius: '26px 26px 0 0', pointerEvents: 'none' }} />
                    <div aria-hidden style={{ position: 'absolute', top: 2.5, insetInlineStart: '8%', insetInlineEnd: '8%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 35%, rgba(255,255,255,1) 65%, transparent)', borderRadius: 999, pointerEvents: 'none' }} />

                    <AIChatInput
                      onSend={() => setShowGuidedJourney(true)}
                      cardHovered={focusedCard === 'ai'}
                      onFocusChange={() => {}}
                    />

                    <motion.button
                      onClick={() => setShowGuidedJourney(true)}
                      whileHover={{ scale: 1.01, boxShadow: '0 14px 44px rgba(0,122,255,0.38), inset 0 1.5px 0 rgba(255,255,255,0.30)' }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: '100%', marginTop: 12, padding: '13px 0', borderRadius: 16,
                        background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                        border: 'none',
                        boxShadow: '0 6px 24px rgba(0,122,255,0.30), inset 0 1.5px 0 rgba(255,255,255,0.26)',
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', letterSpacing: '-0.016em' }}>Plan my trip with AI</span>
                      <ArrowRight size={13} color="rgba(255,255,255,0.72)" strokeWidth={2.5} />
                    </motion.button>
                  </motion.div>

                  {/* ③ Zone pills — discover by category */}
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: '100%', marginBottom: 18 }}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(0,0,0,0.28)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 11, textAlign: 'center' }}>
                      Explore by category
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {ZONES.map((zone, i) => {
                        const Icon = zone.icon;
                        return (
                          <motion.button
                            key={zone.label}
                            initial={{ opacity: 0, scale: 0.86, y: 6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ delay: 0.38 + i * 0.055, type: 'spring', stiffness: 420, damping: 28 }}
                            whileHover={{ scale: 1.07, y: -3, boxShadow: `0 12px 30px ${zone.color}28, inset 0 1px 0 rgba(255,255,255,1)` }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => goTo(zone.href)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 7,
                              padding: '9px 17px', borderRadius: 100,
                              background: `${zone.bg}`,
                              border: `1.5px solid ${zone.border}`,
                              backdropFilter: 'blur(24px)',
                              boxShadow: `0 2px 12px ${zone.color}16, inset 0 1px 0 rgba(255,255,255,0.90)`,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <Icon size={14} color={zone.color} strokeWidth={2} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.012em', whiteSpace: 'nowrap' }}>{zone.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* ④ Ready-made trip templates */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.50, delay: 0.58, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: '100%', marginBottom: 18 }}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(0,0,0,0.28)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 11, textAlign: 'center' }}>
                      Ready-made trips
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      {TEMPLATES.map((t, i) => (
                        <motion.button
                          key={t.label}
                          initial={{ opacity: 0, scale: 0.90 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.62 + i * 0.07, type: 'spring', stiffness: 400, damping: 28 }}
                          whileHover={{ scale: 1.06, y: -3, boxShadow: `0 14px 36px ${t.color}24, inset 0 1px 0 rgba(255,255,255,0.90)` }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => applyTemplate(t)}
                          style={{
                            flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '11px 16px', borderRadius: 18,
                            background: `${t.color}08`,
                            border: `1.5px solid ${t.color}22`,
                            backdropFilter: 'blur(24px)',
                            boxShadow: `0 2px 14px ${t.color}10, inset 0 1px 0 rgba(255,255,255,0.90)`,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.022em' }}>{t.label}</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(0,0,0,0.40)', marginTop: 3 }}>{t.sub}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>

                  {/* ⑤ Stats strip */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.46, delay: 0.78, ease: [0.22, 1, 0.36, 1] }}
                    style={{ display: 'flex', alignItems: 'center', padding: '11px 28px', borderRadius: 100, background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', boxShadow: '0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)' }}
                  >
                    {([
                      { value: '151+', label: 'Live Engines' },
                      { value: '0',    label: 'Hidden Fees'  },
                      { value: 'AI',   label: 'Price Watch'  },
                      { value: '∞',    label: 'Trip Combos'  },
                    ] as { value: string; label: string }[]).map((s, i) => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
                        {i > 0 && <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.07)', margin: '0 24px' }} />}
                        <StatCounter target={s.value} label={s.label} delay={0.84 + i * 0.08} pulse={statsPulse} />
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
