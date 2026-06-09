'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  motion, AnimatePresence,
  useMotionValue, useSpring, useTransform,
} from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Plane, Hotel, UtensilsCrossed, Compass, Train, CloudSun,
  MessageSquare, LayoutGrid, ArrowRight, Sparkles, Mic, Zap,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Stage   = 'globe' | 'flash' | 'main';
type CardFocus = 'ai' | 'manual' | null;

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────

const ZONES = [
  { icon: Plane,           label: 'Flights',     color: '#2563EB', bg: '#EFF6FF', border: '#DBEAFE', href: '/zone/flights'     },
  { icon: Hotel,           label: 'Stays',        color: '#0891B2', bg: '#ECFEFF', border: '#CFFAFE', href: '/zone/lodging'     },
  { icon: UtensilsCrossed, label: 'Dining',       color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', href: '/zone/dining'      },
  { icon: Compass,         label: 'Experiences',  color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', href: '/zone/attractions' },
  { icon: Train,           label: 'Transit',      color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', href: '/zone/transit'     },
  { icon: CloudSun,        label: 'Conditions',   color: '#DC2626', bg: '#FFF1F2', border: '#FECDD3', href: '/zone/conditions'  },
];

const TEMPLATES = [
  { label: 'Honeymoon',   sub: '7-day package' },
  { label: 'Backpacker',  sub: '14-day budget'  },
  { label: 'Luxury Week', sub: '5-star only'    },
];

const PROMPT_CHIPS = [
  'Paris, 5 days in June',
  'Beach for 2 in August',
  'Maldives honeymoon',
  'Tokyo adventure',
];

// ─────────────────────────────────────────────────────────────────────────────
// GLOBE SCENE
// ─────────────────────────────────────────────────────────────────────────────

function GlobeScene() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const globe = useMemo(() => {
    const g = new THREE.Group();
    const count = 3200;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const phi = Math.PI * (Math.sqrt(5) - 1);
    // Light-theme palette — vivid but works on white: Azure, Indigo, Violet, Emerald, Rose, Amber, Teal, Sky
    const pal = [[0.0,0.478,1.0],[0.310,0.278,0.898],[0.498,0.239,0.902],[0.059,0.588,0.416],[1.0,0.227,0.388],[1.0,0.624,0.039],[0.0,0.784,0.745],[0.149,0.667,0.980]];
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const t = phi * i; const R = 2.3;
      pos[i*3]=r*Math.cos(t)*R; pos[i*3+1]=y*R; pos[i*3+2]=r*Math.sin(t)*R;
      const c=pal[i%pal.length]; col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2];
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dg.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    // Brighter, more visible points on light background
    g.add(new THREE.Points(dg, new THREE.PointsMaterial({ size:0.022, vertexColors:true, sizeAttenuation:true, transparent:true, opacity:0.85, depthWrite:false })));
    // Light-friendly shell layers — very subtle
    [{ r:2.25,color:'#EEF2FF',opacity:0.18 },{ r:2.65,color:'#4F46E5',opacity:0.04 },{ r:3.10,color:'#06B6D4',opacity:0.025 }]
      .forEach(({r,color,opacity}) => g.add(new THREE.Mesh(new THREE.SphereGeometry(r,32,32), new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.BackSide}))));
    const pairs: [[number,number,number],[number,number,number]][] = [
      [[0.7,0.6,0.4],[-0.8,0.3,0.5]],[[-0.5,0.8,0.3],[0.6,-0.5,0.6]],
      [[0.3,0.9,-0.3],[-0.7,-0.4,0.6]],[[-0.9,0.1,0.4],[0.4,0.7,-0.6]],
      [[0.8,-0.6,0.1],[-0.3,0.8,0.5]],[[0.1,0.5,-0.9],[0.9,0.3,0.3]],
      [[-0.6,-0.7,0.4],[0.5,0.5,-0.7]],[[0.4,-0.3,0.9],[-0.7,0.6,-0.4]],
    ];
    // Vivid arc colors — high saturation for light bg
    const ac=['#2563EB','#7C3AED','#0891B2','#059669','#E11D48','#D97706','#0D9488','#4F46E5'];
    pairs.forEach(([a,b],i) => {
      const s=new THREE.Vector3(...a).normalize().multiplyScalar(2.38);
      const e=new THREE.Vector3(...b).normalize().multiplyScalar(2.38);
      const m=s.clone().add(e).normalize().multiplyScalar(3.5);
      const geo=new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(s,m,e).getPoints(60));
      g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({color:new THREE.Color(ac[i]),transparent:true,opacity:0.45})));
    });
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.rotation.y = t * 0.055;
      groupRef.current.rotation.x = Math.sin(t * 0.062) * 0.04;
    }
    (camera as THREE.PerspectiveCamera).position.z +=
      (6.8 - (camera as THREE.PerspectiveCamera).position.z) * 0.025;
  });
  return <group ref={groupRef}><primitive object={globe} /></group>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT TITLE  (0.030s/char → total reveal 270ms, under 400ms patience threshold)
// ─────────────────────────────────────────────────────────────────────────────

function SplitTitle({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span style={{ display: 'inline-block' }}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 44, rotateX: -50, scale: 0.84 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28, delay: delay + i * 0.030 }}
          style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT COUNTER
// GESTALT FEATURE 5 — Common Fate Pulse: all stats pulse simultaneously at 2.5s
// pulse prop → local pulsing state → Framer Motion scale keyframe
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
      const start = performance.now(); const dur = 1200;
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

  // Feature 5: trigger local pulse when prop fires
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
        transition={pulsing ? { duration: 0.32, ease: [0.22, 1, 0.36, 1] } : { duration: 0.18 }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{display}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE WAVE
// ─────────────────────────────────────────────────────────────────────────────

function VoiceWave({ active }: { active: boolean }) {
  const heights = [8, 14, 18, 14, 8];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          style={{ width: 3, borderRadius: 2, background: 'rgba(255,255,255,0.90)', originY: 0.5 }}
          animate={active
            ? { height: [h*0.5, h*1.2, h*0.4, h, h*0.5], opacity: [0.6, 1, 0.7, 1, 0.6] }
            : { height: 4, opacity: 0.5 }}
          transition={active ? { duration: 0.75, repeat: Infinity, ease: 'easeInOut', delay: i * 0.11 } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CHAT INPUT
// GESTALT FEATURE 2 — Proximity Glow: cardHovered prop → input border brightens
// GESTALT FEATURE 4 — Prägnanz Collapse: onFocusChange lifts state to card level
// ─────────────────────────────────────────────────────────────────────────────

function AIChatInput({ onSend, cardHovered, onFocusChange }: {
  onSend: (q: string) => void;
  cardHovered: boolean;
  onFocusChange: (focused: boolean) => void;
}) {
  const [val, setVal]         = useState('');
  const [focused, setFocused] = useState(false);
  const [voiceOn, setVoice]   = useState(false);

  const handleFocus = useCallback(() => {
    setFocused(true);
    onFocusChange(true);
  }, [onFocusChange]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setFocused(false);
      onFocusChange(false);
    }, 180);
  }, [onFocusChange]);

  const submit = useCallback((q: string) => { if (q.trim()) onSend(q.trim()); }, [onSend]);

  // Feature 2: proximity (card hovered) → border glow. Focus → deeper glow.
  const borderOpacity = focused ? 0.32 : cardHovered ? 0.22 : 0.16;
  const glowShadow = focused
    ? '0 0 0 2px rgba(255,255,255,0.22), 0 4px 24px rgba(0,0,0,0.28)'
    : cardHovered
      ? '0 0 0 1px rgba(255,255,255,0.14), 0 2px 16px rgba(0,0,0,0.22)'
      : '0 2px 12px rgba(0,0,0,0.20)';

  return (
    <div style={{ width: '100%' }}>
      <motion.div
        animate={{ boxShadow: glowShadow }}
        transition={{ duration: 0.20 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderRadius: 14,
          background: 'rgba(255,255,255,0.10)',
          border: `1.5px solid rgba(255,255,255,${borderOpacity})`,
          backdropFilter: 'blur(16px)',
          transition: 'border-color 0.20s',
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
            fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.92)',
            fontFamily: 'inherit', letterSpacing: '-0.01em', minWidth: 0,
          }}
        />
        <motion.button
          onMouseDown={() => setVoice(v => !v)}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: voiceOn ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)',
            border: `1px solid rgba(255,255,255,${voiceOn ? 0.32 : 0.14})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {voiceOn ? <VoiceWave active /> : <Mic size={13} color="rgba(255,255,255,0.68)" strokeWidth={2} />}
        </motion.button>
        <AnimatePresence>
          {val && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 440, damping: 26 }}
              onClick={() => submit(val)}
              whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.94 }}
              style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(255,255,255,0.96)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(0,0,0,0.24)',
              }}
            >
              <ArrowRight size={14} color="#1E1B4B" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Prompt chips — Feature 4: float up when input focused */}
      <motion.div
        animate={{ y: focused ? -4 : 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}
      >
        {PROMPT_CHIPS.map((chip, i) => (
          <motion.button
            key={chip}
            initial={{ opacity: 0, y: 6, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.12 + i * 0.05, type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => { setVal(chip); submit(chip); }}
            whileHover={{ scale: 1.06, backgroundColor: 'rgba(255,255,255,0.18)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '4px 12px', borderRadius: 100,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: 'rgba(255,255,255,0.72)',
              fontSize: 11, fontWeight: 500,
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
  const router = useRouter();
  const [stage, setStage]         = useState<Stage>('globe');
  const [showTap, setShowTap]     = useState(false);
  const [travelers, setTravelers]    = useState(142);

  // ── Gestalt state ─────────────────────────────────────────────────────────
  // Feature 1 — Figure-Ground: which card has focus
  const [focusedCard, setFocusedCard] = useState<CardFocus>(null);

  // Feature 3 — Common Fate Zone Ripple: which zone index is hovered
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);

  // Feature 4 — Prägnanz Collapse: AI input focus state (lifted from AIChatInput)
  const [aiInputFocused, setAiInputFocused] = useState(false);

  // Feature 5 — Stats Common Fate Pulse
  const [statsPulse, setStatsPulse] = useState(false);

  // ── Parallax ──────────────────────────────────────────────────────────────
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 48, damping: 18 });
  const sy = useSpring(my, { stiffness: 48, damping: 18 });
  const tx = useTransform(sx, [-0.5, 0.5], [-8, 8]);
  const ty = useTransform(sy, [-0.5, 0.5], [-6, 6]);

  const advTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    if (stage !== 'globe') return;
    if (advTimerRef.current) clearTimeout(advTimerRef.current);
    setStage('flash');
    setTimeout(() => setStage('main'), 530);
  }, [stage]);

  useEffect(() => {
    // Show the "Begin your journey" button after 1.4s
    // DO NOT auto-advance — the globe stays until the user clicks
    const t1 = setTimeout(() => setShowTap(true), 1400);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t1);
      if (advTimerRef.current) clearTimeout(advTimerRef.current);
      window.removeEventListener('keydown', onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch real active-traveler count from Supabase
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/trips', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then((d: { count?: number } | null) => { if (d?.count && d.count > 0) setTravelers(d.count); })
      .catch(() => { /* fallback to default */ });
    return () => ctrl.abort();
  }, []);

  // Feature 5: trigger stats pulse 2.5s after main stage loads
  useEffect(() => {
    if (stage !== 'main') return;
    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      setStatsPulse(true);
      t2 = setTimeout(() => setStatsPulse(false), 380);
    }, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stage]);

  const goTo = useCallback((path: string, query?: string) => {
    if (query) {
      try {
        const prompt = query.length < 40
          ? `Plan a trip to ${query} — show me flights, top stays, and must-see experiences.`
          : query;
        sessionStorage.setItem('unitravel-ai-prompt', prompt);
      } catch { /* Safari private mode */ }
    }
    setTimeout(() => router.push(path), 300);
  }, [router]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    mx.set(e.clientX / window.innerWidth  - 0.5);
    my.set(e.clientY / window.innerHeight - 0.5);
  }, [mx, my]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  // ── Derived per-card animate values ───────────────────────────────────────
  // Feature 1: non-focused card dims, focused card elevates
  const aiRecede    = focusedCard === 'manual';
  const manualRecede = focusedCard === 'ai';

  return createPortal(
    <div onMouseMove={onMouseMove} style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden' }}>

      {/* ════ STAGE 1 — GLOBE ════ */}
      <AnimatePresence>
        {stage === 'globe' && (
          <motion.div key="globe"
            exit={{ opacity: 0, scale: 1.06, filter: 'blur(12px)' }}
            transition={{ duration: 0.32 }}
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(148deg, #F0F4FF 0%, #EDF0FE 20%, #F5F3FF 42%, #EFF8FF 68%, #F0FDF4 100%)',
            }}
          >
            {/* ── Ambient light blobs — soft, pastel ── */}
            <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
              <div style={{ position:'absolute', top:'-18%', left:'-8%',  width:'60%', height:'60%', borderRadius:'50%', background:'radial-gradient(ellipse, rgba(99,102,241,0.14) 0%, transparent 65%)', animation:'breathe 18s ease-in-out infinite' }} />
              <div style={{ position:'absolute', top:'-12%', right:'-6%', width:'52%', height:'52%', borderRadius:'50%', background:'radial-gradient(ellipse, rgba(139,92,246,0.10) 0%, transparent 65%)', animation:'breathe 22s ease-in-out infinite', animationDelay:'6s' }} />
              <div style={{ position:'absolute', bottom:'-16%', left:'18%', width:'64%', height:'48%', borderRadius:'50%', background:'radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 65%)', animation:'liquid-drift 26s ease-in-out infinite', animationDelay:'10s' }} />
              <div style={{ position:'absolute', bottom:'10%', right:'-4%', width:'40%', height:'40%', borderRadius:'50%', background:'radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 65%)', animation:'breathe 20s ease-in-out infinite', animationDelay:'3s' }} />
              {/* Subtle central glow behind globe */}
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'60vmin', height:'60vmin', borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.09) 0%, rgba(139,92,246,0.05) 45%, transparent 70%)', filter:'blur(32px)', animation:'breathe 7s ease-in-out infinite', pointerEvents:'none' }} />
            </div>

            {/* ── Three.js Globe ── */}
            <div style={{ position: 'absolute', inset: 0 }}>
              <Canvas camera={{ position: [0, 0, 6.8], fov: 42 }} gl={{ antialias: true, alpha: true }} style={{ width: '100%', height: '100%' }}>
                <ambientLight intensity={2.2} />
                <directionalLight position={[5, 5, 5]} intensity={1.0} color="#ffffff" />
                <pointLight position={[6, 4, 4]}  color="#4F46E5" intensity={1.8} />
                <pointLight position={[-5, -3, 3]} color="#0891B2" intensity={1.4} />
                <GlobeScene />
              </Canvas>
            </div>

            {/* ── Overlay UI ── */}
            <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'44px 0 60px' }}>

              {/* Logo */}
              <motion.div
                initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:1.0, ease:[0.22,1,0.36,1], delay:0.4 }}
                style={{ display:'flex', alignItems:'center', gap:10 }}
              >
                <div style={{
                  width:36, height:36, borderRadius:12,
                  background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 4px 24px rgba(79,70,229,0.32), 0 0 0 1px rgba(255,255,255,0.80)',
                }}>
                  <Sparkles size={15} color="#fff" strokeWidth={2.2} />
                </div>
                <span style={{
                  fontSize:16, fontWeight:900, letterSpacing:'-0.04em',
                  background:'linear-gradient(130deg,#1D1D1F 0%,#4F46E5 60%,#7C3AED 100%)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                }}>UNITRAVEL</span>
              </motion.div>

              {/* Tagline */}
              <motion.div
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:1.4, delay:1.0 }}
                style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}
              >
                <p style={{
                  fontSize:12, fontWeight:600, color:'rgba(79,70,229,0.55)',
                  letterSpacing:'0.22em', textTransform:'uppercase', margin:0,
                }}>Your AI Travel Operating System</p>

                {/* CTA Button — shown after 1.4s */}
                <AnimatePresence>
                  {showTap && (
                    <motion.button
                      initial={{ opacity:0, y:18, scale:0.90 }}
                      animate={{ opacity:1, y:0, scale:1 }}
                      exit={{ opacity:0, scale:0.88 }}
                      transition={{ type:'spring', stiffness:380, damping:26 }}
                      onClick={advance}
                      whileHover={{ scale:1.05, y:-3, boxShadow:'0 12px 40px rgba(79,70,229,0.30), 0 0 0 1.5px rgba(79,70,229,0.28)' }}
                      whileTap={{ scale:0.96 }}
                      style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'14px 34px 14px 28px', borderRadius:100,
                        background:'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(240,244,255,0.92) 100%)',
                        border:'1.5px solid rgba(99,102,241,0.22)',
                        backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
                        cursor:'pointer', fontFamily:'inherit',
                        boxShadow:'0 8px 32px rgba(99,102,241,0.18), 0 2px 8px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,1)',
                      }}
                      aria-label="Enter Unitravel"
                    >
                      <div style={{
                        width:28, height:28, borderRadius:9,
                        background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        boxShadow:'0 2px 10px rgba(79,70,229,0.40)',
                        flexShrink:0,
                      }}>
                        <Sparkles size={12} color="#fff" strokeWidth={2.5} />
                      </div>
                      <motion.span
                        animate={{ opacity: [0.80, 1, 0.80] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                        style={{ display:'flex', alignItems:'center', gap:8 }}
                      >
                        <span style={{ fontSize:13.5, fontWeight:700, color:'#3730A3', letterSpacing:'-0.01em' }}>Begin your journey</span>
                        <ArrowRight size={14} color="#4F46E5" strokeWidth={2.5} />
                      </motion.span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ STAGE 2 — FLASH ════ */}
      <AnimatePresence>
        {stage === 'flash' && (
          <motion.div key="flash"
            style={{ position:'absolute',inset:0,zIndex:50,background:'radial-gradient(circle at center,#FFFFFF 0%,rgba(235,240,255,0.98) 28%,rgba(200,215,255,0.90) 52%,rgba(180,195,255,0.55) 72%,transparent 90%)' }}
            initial={{ opacity:0, scale:0.06 }}
            animate={{ opacity:[0,1,0.92,0], scale:[0.06,1.0,1.28,1.65] }}
            transition={{ duration:0.55, times:[0,0.27,0.64,1.0], ease:'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* ════ STAGE 3 — MAIN ════ */}
      <AnimatePresence>
        {stage === 'main' && (
          <motion.div key="main"
            initial={{ opacity:0, scale:0.978 }} animate={{ opacity:1, scale:1 }}
            transition={{ duration:0.70, ease:[0.22,1,0.36,1] }}
            style={{ position:'absolute',inset:0,overflow:'hidden',background:'linear-gradient(148deg,#F8F9FF 0%,#EEF2FF 26%,#F4F1FF 55%,#EDF5FF 100%)',display:'flex',flexDirection:'column' }}
          >
            {/* Ambient blobs — reduced to 3 for animation budget */}
            <div aria-hidden style={{ position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none' }}>
              {([
                { top:'-20%', left:'-6%',    w:'52%', h:'58%', c:'rgba(99,102,241,0.11)',  a:'breathe 20s ease-in-out infinite'       },
                { top:'-10%', right:'-5%',   w:'44%', h:'48%', c:'rgba(139,92,246,0.08)', a:'breathe 25s ease-in-out infinite', d:'7s' },
                { bottom:'-15%', right:'8%', w:'42%', h:'42%', c:'rgba(168,85,247,0.07)', a:'breathe 22s ease-in-out infinite', d:'4s' },
              ] as { top?:string; left?:string; right?:string; bottom?:string; w:string; h:string; c:string; a:string; d?:string }[]).map((b, i) => (
                <div key={i} style={{ position:'absolute', top:b.top, left:b.left, right:b.right, bottom:b.bottom, width:b.w, height:b.h, borderRadius:'50%', background:`radial-gradient(ellipse,${b.c} 0%,transparent 65%)`, animation:b.a, animationDelay:b.d??'0s' }} />
              ))}
            </div>

            {/* ── TOP BAR ── */}
            <motion.div
              initial={{ opacity:0, y:-16 }}
              animate={{ opacity:1, y:0 }}
              transition={{ duration:0.50, delay:0.16, ease:[0.22,1,0.36,1] }}
              style={{ position:'absolute', top:24, left:24, right:24, zIndex:20, display:'flex', alignItems:'center', justifyContent:'space-between', pointerEvents:'none' }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:8, pointerEvents:'auto' }}>
                <div style={{ width:32,height:32,borderRadius:10,background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(79,70,229,0.38)' }}>
                  <Sparkles size={14} color="#fff" strokeWidth={2.2} />
                </div>
                <span style={{ fontSize:13,fontWeight:800,letterSpacing:'-0.04em',color:'#1D1D1F' }}>UNITRAVEL</span>
              </div>
              <motion.div
                initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }}
                transition={{ type:'spring', stiffness:340, damping:28, delay:0.80 }}
                style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 16px 6px 8px',borderRadius:100,background:'rgba(255,255,255,0.92)',border:'1px solid rgba(255,255,255,0.98)',boxShadow:'0 4px 20px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,1)',backdropFilter:'blur(20px)',pointerEvents:'auto' }}
              >
                <div style={{ width:8,height:8,borderRadius:'50%',background:'#10B981',boxShadow:'0 0 0 2px rgba(16,185,129,0.22)',animation:'pulse-glow 2.4s ease-in-out infinite',flexShrink:0 }} />
                <span style={{ fontSize:11,fontWeight:600,color:'#374151',letterSpacing:'-0.01em' }}>
                  <span style={{ color:'#059669',fontWeight:800 }}>{travelers}</span> planning now
                </span>
              </motion.div>
            </motion.div>

            {/* ── MAIN CONTENT ── */}
            <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'80px 32px 24px',overflowY:'auto' }}>
              <motion.div style={{ x:tx, y:ty, width:'100%', maxWidth:960 }}>
                <div style={{ display:'flex',flexDirection:'column',alignItems:'center' }}>

                  {/* Badge — static (float removed) */}
                  <motion.div
                    initial={{ opacity:0, y:12, scale:0.90 }}
                    animate={{ opacity:1, y:0, scale:1 }}
                    transition={{ type:'spring', stiffness:380, damping:30, delay:0.10 }}
                    style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 16px 8px 8px',borderRadius:100,background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.18)',boxShadow:'0 2px 16px rgba(99,102,241,0.08),inset 0 1px 0 rgba(255,255,255,0.90)',marginBottom:16 }}
                  >
                    <div style={{ width:20,height:20,borderRadius:7,background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 10px rgba(79,70,229,0.38)',flexShrink:0 }}>
                      <Zap size={10} color="#fff" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize:11,fontWeight:700,color:'#4F46E5',letterSpacing:'0.10em',textTransform:'uppercase' }}>
                      151+ Live Engines · Zero Hidden Fees · Real-time AI
                    </span>
                  </motion.div>

                  {/* Wordmark */}
                  <h1 style={{ fontSize:'clamp(3.2rem,6.5vw,5.6rem)',fontWeight:900,letterSpacing:'-0.055em',lineHeight:0.92,margin:'0 0 8px',textAlign:'center',background:'linear-gradient(140deg,#0F172A 0%,#1E293B 14%,#2563EB 38%,#7C3AED 64%,#9333EA 82%,#BE185D 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',perspective:'900px',willChange:'transform' }}>
                    <SplitTitle text="Unitravel." delay={0.12} />
                  </h1>

                  {/* Tagline */}
                  <motion.p
                    initial={{ opacity:0, y:8, filter:'blur(6px)' }}
                    animate={{ opacity:1, y:0, filter:'blur(0px)' }}
                    transition={{ duration:0.48, delay:0.34, ease:[0.22,1,0.36,1] }}
                    style={{ fontSize:18,fontWeight:400,color:'#475569',margin:'0 0 24px',letterSpacing:'-0.012em',textAlign:'center',lineHeight:1.4 }}
                  >
                    Every flight, stay, and experience — unified by intelligence.
                  </motion.p>

                  {/* ════════════════════════════════════════════════════
                      TWO-PATH CARDS
                      FEATURE 1: Reciprocal Figure-Ground Dimming
                      Non-hovered card: opacity 0.50, blur 1.5px, scale 0.992
                      Hovered card: scale 1.008, elevated shadow
                      All transitions: 250ms spring ease
                      ════════════════════════════════════════════════════ */}
                  <motion.div
                    initial={{ opacity:0, y:20 }}
                    animate={{ opacity:1, y:0 }}
                    transition={{ duration:0.60, ease:[0.22,1,0.36,1], delay:0.46 }}
                    style={{ display:'flex', gap:16, width:'100%', alignItems:'stretch' }}
                  >

                    {/* ╔══════════════════════════════════════╗
                        ║  LEFT — AI CHAT CARD (dark glass)   ║
                        ╚══════════════════════════════════════╝ */}
                    <motion.div
                      onMouseEnter={() => setFocusedCard('ai')}
                      onMouseLeave={() => { setFocusedCard(null); }}
                      animate={{
                        opacity:    aiRecede ? 0.48 : 1,
                        scale:      aiRecede ? 0.992 : focusedCard === 'ai' ? 1.008 : 1,
                        filter:     aiRecede ? 'blur(1.5px) brightness(0.92)' : 'blur(0px) brightness(1)',
                        boxShadow:  focusedCard === 'ai'
                          ? '0 32px 100px rgba(16,10,80,0.60),0 12px 32px rgba(79,70,229,0.34),inset 0 1px 0 rgba(255,255,255,0.14)'
                          : '0 24px 80px rgba(16,10,80,0.48),0 8px 24px rgba(79,70,229,0.28),inset 0 1px 0 rgba(255,255,255,0.12)',
                      }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        flex:'1 1 0',
                        padding:'24px',
                        borderRadius:24,
                        background:'linear-gradient(148deg,rgba(10,6,50,0.82) 0%,rgba(22,14,92,0.78) 50%,rgba(16,9,64,0.82) 100%)',
                        border:'1px solid rgba(255,255,255,0.13)',
                        backdropFilter:'blur(40px) saturate(200%)',
                        WebkitBackdropFilter:'blur(40px) saturate(200%)',
                        display:'flex', flexDirection:'column', gap:0,
                        position:'relative', overflow:'hidden',
                        cursor:'default',
                      }}
                    >
                      {/* Depth glows */}
                      <div aria-hidden style={{ position:'absolute',top:'-35%',left:'-8%',width:'65%',height:'65%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(99,102,241,0.24) 0%,transparent 65%)',pointerEvents:'none' }} />
                      <div aria-hidden style={{ position:'absolute',bottom:'-20%',right:'-6%',width:'50%',height:'50%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(139,92,246,0.16) 0%,transparent 65%)',pointerEvents:'none' }} />
                      <div aria-hidden style={{ position:'absolute',left:'8%',right:'8%',top:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.50) 38%,rgba(255,255,255,0.50) 62%,transparent)',borderRadius:'999px',pointerEvents:'none' }} />

                      {/*
                        FEATURE 4 — Prägnanz Collapse:
                        When AI input is focused:
                          • Card header dims to 0.35 opacity (title+icon fade away)
                          • Description vanishes (opacity 0)
                          • "or speak" hides
                          • Chips float up (handled in AIChatInput)
                          • CTA becomes MORE prominent (opacity 1 → stays)
                        Law: Prägnanz — maximum simplicity at decision point.
                        Result: only input→chips→CTA remain, the user's full attention is on their query.
                      */}
                      <motion.div
                        animate={{ opacity: aiInputFocused ? 0.32 : 1, y: aiInputFocused ? -2 : 0 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4,position:'relative',zIndex:1 }}
                      >
                        <div style={{ width:40,height:40,borderRadius:12,background:'rgba(255,255,255,0.11)',border:'1px solid rgba(255,255,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)',boxShadow:'0 4px 14px rgba(0,0,0,0.22)',flexShrink:0 }}>
                          <MessageSquare size={18} color="rgba(255,255,255,0.92)" strokeWidth={1.8} />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:16,fontWeight:800,color:'#fff',letterSpacing:'-0.030em',lineHeight:1.2 }}>Chat with Unit AI</div>
                          <div style={{ fontSize:11,fontWeight:500,color:'rgba(255,255,255,0.68)',letterSpacing:'-0.005em',marginTop:1 }}>Your personal AI travel concierge</div>
                        </div>
                        <motion.button
                          animate={{ opacity: aiInputFocused ? 0 : 1 }}
                          transition={{ duration: 0.18 }}
                          whileHover={{ scale:1.06 }}
                          whileTap={{ scale:0.96 }}
                          style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 10px 5px 7px',borderRadius:100,background:'rgba(255,255,255,0.09)',border:'1px solid rgba(255,255,255,0.15)',cursor:'pointer',fontFamily:'inherit',flexShrink:0 }}
                        >
                          <Mic size={11} color="rgba(255,255,255,0.72)" strokeWidth={2} />
                          <span style={{ fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.68)',letterSpacing:'0.01em' }}>or speak</span>
                        </motion.button>
                      </motion.div>

                      <motion.p
                        animate={{ opacity: aiInputFocused ? 0 : 1, y: aiInputFocused ? -4 : 0 }}
                        transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
                        style={{ fontSize:12.5,color:'rgba(255,255,255,0.60)',margin:'0 0 16px',letterSpacing:'-0.005em',lineHeight:1.55,position:'relative',zIndex:1 }}
                      >
                        Tell Unit where you want to go — it curates flights, stays, dining, and every detail. Instantly.
                      </motion.p>

                      {/* Feature 2: cardHovered → input glows. Feature 4: onFocusChange */}
                      <div style={{ position:'relative', zIndex:1 }}>
                        <AIChatInput
                          onSend={(q) => goTo('/zone/management', q)}
                          cardHovered={focusedCard === 'ai'}
                          onFocusChange={setAiInputFocused}
                        />
                      </div>

                      {/* CTA — stays prominent during focus (Feature 4: this is the goal) */}
                      <motion.button
                        animate={{ opacity: aiInputFocused ? 1 : 0.85 }}
                        whileHover={{ scale:1.03, opacity:1 }}
                        whileTap={{ scale:0.97 }}
                        onClick={() => goTo('/zone/management')}
                        transition={{ duration: 0.18 }}
                        style={{
                          marginTop:'auto',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                          padding:'11px 24px', borderRadius:100,
                          background:'rgba(255,255,255,0.14)',
                          border:'1px solid rgba(255,255,255,0.24)',
                          boxShadow:'inset 0 1px 0 rgba(255,255,255,0.18)',
                          cursor:'pointer', fontFamily:'inherit',
                          position:'relative', zIndex:1,
                        }}
                      >
                        <span style={{ fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.96)',letterSpacing:'-0.01em' }}>Plan my trip with AI</span>
                        <ArrowRight size={13} color="rgba(255,255,255,0.80)" strokeWidth={2.5} />
                      </motion.button>
                    </motion.div>

                    {/* ╔══════════════════════════════════════════╗
                        ║  RIGHT — BUILD MANUALLY (light glass)   ║
                        ╚══════════════════════════════════════════╝ */}
                    <motion.div
                      onMouseEnter={() => setFocusedCard('manual')}
                      onMouseLeave={() => { setFocusedCard(null); setHoveredZone(null); }}
                      animate={{
                        opacity:    manualRecede ? 0.48 : 1,
                        scale:      manualRecede ? 0.992 : focusedCard === 'manual' ? 1.008 : 1,
                        filter:     manualRecede ? 'blur(1.5px) brightness(0.97)' : 'blur(0px) brightness(1)',
                        boxShadow:  focusedCard === 'manual'
                          ? '0 20px 64px rgba(0,0,0,0.12),0 6px 20px rgba(0,0,0,0.07),inset 0 1px 0 rgba(255,255,255,1)'
                          : '0 8px 40px rgba(0,0,0,0.07),0 2px 10px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,1)',
                      }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        flex:'1 1 0',
                        padding:'24px',
                        borderRadius:24,
                        background:'rgba(255,255,255,0.96)',
                        border:'1px solid rgba(0,0,0,0.06)',
                        backdropFilter:'blur(32px) saturate(190%)',
                        WebkitBackdropFilter:'blur(32px) saturate(190%)',
                        display:'flex', flexDirection:'column', gap:0,
                        position:'relative', overflow:'hidden',
                        cursor:'default',
                      }}
                    >
                      <div aria-hidden style={{ position:'absolute',left:'8%',right:'8%',top:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,1) 38%,rgba(255,255,255,1) 62%,transparent)',borderRadius:'999px',pointerEvents:'none' }} />

                      {/* Card header */}
                      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4 }}>
                        <div style={{ width:40,height:40,borderRadius:12,background:'rgba(79,70,229,0.08)',border:'1px solid rgba(79,70,229,0.16)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 10px rgba(79,70,229,0.08)',flexShrink:0 }}>
                          <LayoutGrid size={18} color="#4F46E5" strokeWidth={1.8} />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:16,fontWeight:800,color:'#0F172A',letterSpacing:'-0.030em',lineHeight:1.2 }}>Build your trip</div>
                          <div style={{ fontSize:11,fontWeight:500,color:'#475569',letterSpacing:'-0.005em',marginTop:1 }}>Search every engine, your way</div>
                        </div>
                        <div style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:100,background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.20)',flexShrink:0 }}>
                          <div style={{ width:5,height:5,borderRadius:'50%',background:'#10B981',flexShrink:0 }} />
                          <span style={{ fontSize:10,fontWeight:700,color:'#059669',whiteSpace:'nowrap' }}>Best time: Now</span>
                        </div>
                      </div>

                      <p style={{ fontSize:12.5,color:'#64748B',margin:'0 0 16px',letterSpacing:'-0.005em',lineHeight:1.55 }}>
                        Access 151+ live engines across all 6 zones — full control, zero compromise.
                      </p>

                      {/*
                        FEATURE 3 — Common Fate Zone Ripple:
                        Hovering zone[i] creates a ripple:
                          Same row (floor(i/3) === floor(hoveredZone/3)):
                            → scale 1.02, y -1, 20ms delay (they follow upward)
                          Other row:
                            → scale 0.97, y +1, opacity 0.70, 50ms delay (they recede)
                          Hovered zone itself:
                            → scale 1.06, y -3, shows zone color
                        Law: Common Fate — elements moving in same direction are perceived as one unit.
                        Result: the 6 zones feel like a connected magnetic field, not a list.
                        BUG FIX: removed inline CSS transition (conflicts with Framer Motion backgroundColor)
                        BUG FIX: onMouseLeave on grid container as safety net
                      */}
                      <div
                        onMouseLeave={() => setHoveredZone(null)}
                        style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}
                      >
                        {ZONES.map((zone, i) => {
                          const Icon = zone.icon;
                          const isHovered  = hoveredZone === i;
                          const sameRow    = hoveredZone !== null && Math.floor(i / 3) === Math.floor(hoveredZone / 3) && !isHovered;
                          const otherRow   = hoveredZone !== null && Math.floor(i / 3) !== Math.floor(hoveredZone / 3);

                          return (
                            <motion.button
                              key={zone.label}
                              initial={{ opacity:0, scale:0.86, y:6 }}
                              animate={{
                                opacity: !isHovered && otherRow ? 0.62 : 1,
                                scale:   isHovered ? 1.06 : sameRow ? 1.02 : otherRow ? 0.97 : 1,
                                y:       isHovered ? -3 : sameRow ? -1 : otherRow ? 1 : 0,
                                backgroundColor: isHovered ? zone.bg : 'rgba(248,249,255,0.92)',
                                borderColor:     isHovered ? zone.border : 'rgba(0,0,0,0.06)',
                                boxShadow:       isHovered
                                  ? `0 6px 20px ${zone.color}28, inset 0 1px 0 rgba(255,255,255,1)`
                                  : '0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)',
                              }}
                              transition={{
                                duration: 0.22,
                                delay:    sameRow ? 0.02 : otherRow ? 0.05 : 0,
                                ease:     [0.22, 1, 0.36, 1],
                                // Delay initial entry animation separately
                                opacity:  { delay: 0.64 + i * 0.04 },
                                scale:    { delay: hoveredZone === null ? 0 : (sameRow ? 0.02 : otherRow ? 0.05 : 0) },
                              }}
                              onMouseEnter={() => setHoveredZone(i)}
                              onMouseLeave={() => setHoveredZone(null)}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => goTo(zone.href)}
                              style={{
                                display:'flex', alignItems:'center', gap:7,
                                padding:'8px 12px', borderRadius:12,
                                cursor:'pointer', fontFamily:'inherit',
                                border:'1px solid',
                              }}
                            >
                              <Icon size={14} color={zone.color} strokeWidth={2} />
                              <span style={{ fontSize:11.5,fontWeight:600,color:'#1E293B',letterSpacing:'-0.01em',whiteSpace:'nowrap' }}>{zone.label}</span>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Template chips — BUG FIX: removed inline CSS transition (conflicts with whileHover) */}
                      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                        {TEMPLATES.map((t, i) => (
                          <motion.button
                            key={t.label}
                            initial={{ opacity:0, scale:0.90 }}
                            animate={{ opacity:1, scale:1 }}
                            transition={{ delay:0.76+i*0.07, type:'spring', stiffness:400, damping:30 }}
                            whileHover={{ scale:1.05, backgroundColor:'#F1F5F9', borderColor:'rgba(0,0,0,0.09)' }}
                            whileTap={{ scale:0.96 }}
                            onClick={() => goTo('/setup')}
                            style={{
                              display:'flex', flexDirection:'column', alignItems:'center',
                              padding:'8px 16px', borderRadius:10,
                              background:'rgba(0,0,0,0.03)',
                              border:'1px solid rgba(0,0,0,0.06)',
                              cursor:'pointer', fontFamily:'inherit',
                              flex:'1 1 0',
                            }}
                          >
                            <span style={{ fontSize:11.5,fontWeight:700,color:'#334155',letterSpacing:'-0.01em' }}>{t.label}</span>
                            <span style={{ fontSize:10,color:'#64748B',marginTop:1 }}>{t.sub}</span>
                          </motion.button>
                        ))}
                      </div>

                      {/* CTA — BUG FIX: removed inline CSS transition, Framer handles it */}
                      <motion.button
                        whileHover={{ scale:1.03, backgroundColor:'rgba(79,70,229,0.14)', borderColor:'rgba(79,70,229,0.28)' }}
                        whileTap={{ scale:0.97 }}
                        onClick={() => goTo('/setup')}
                        style={{
                          display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                          padding:'11px 24px', borderRadius:100,
                          background:'rgba(79,70,229,0.08)',
                          border:'1px solid rgba(79,70,229,0.20)',
                          boxShadow:'inset 0 1px 0 rgba(255,255,255,0.70)',
                          cursor:'pointer', fontFamily:'inherit',
                          marginTop:'auto',
                        }}
                      >
                        <span style={{ fontSize:13,fontWeight:700,color:'#4F46E5',letterSpacing:'-0.01em' }}>Build my trip</span>
                        <ArrowRight size={13} color="#4F46E5" strokeWidth={2.5} />
                      </motion.button>
                    </motion.div>

                  </motion.div>

                  {/*
                    STATS STRIP
                    FEATURE 5 — Common Fate Pulse:
                    All 4 stat numbers scale simultaneously 1→1.08→1 at 2.5s.
                    Law: Common Fate — elements that move together are grouped as one.
                    Result: user perceives the 4 stats as "one living system" not a list of numbers.
                    The synchronized pulse also signals "these numbers are real and updating".
                  */}
                  <motion.div
                    initial={{ opacity:0, y:12 }}
                    animate={{ opacity:1, y:0 }}
                    transition={{ duration:0.50, delay:0.84, ease:[0.22,1,0.36,1] }}
                    style={{ display:'flex',alignItems:'center',marginTop:16,padding:'12px 32px',borderRadius:100,background:'rgba(255,255,255,0.72)',border:'1px solid rgba(255,255,255,0.90)',backdropFilter:'blur(16px)',boxShadow:'0 2px 16px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,1)' }}
                  >
                    {([
                      { value:'151+', label:'Live Engines'  },
                      { value:'0',    label:'Hidden Fees'  },
                      { value:'AI',   label:'Price Watch'  },
                      { value:'∞',    label:'Trip Combos'  },
                    ] as { value: string; label: string }[]).map((s, i) => (
                      <div key={s.label} style={{ display:'flex', alignItems:'center' }}>
                        {i > 0 && <div style={{ width:1,height:32,background:'rgba(0,0,0,0.07)',margin:'0 32px' }} />}
                        <StatCounter
                          target={s.value}
                          label={s.label}
                          delay={0.90 + i * 0.08}
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

    </div>,
    document.body
  );
}
