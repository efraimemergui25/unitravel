'use client';

import { Suspense, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link                                                 from 'next/link';
import { usePathname, useSearchParams, useRouter }          from 'next/navigation';
import {
  motion, AnimatePresence, MotionConfig, useAnimate,
} from 'framer-motion';
import { useTravelEngine }  from '@/store/useTravelEngine';
import { useLocaleEngine }  from '@/store/useLocaleEngine';
import { useToast }         from '@/components/ui/Toast';
import type { TimelineDropPayload } from '@/utils/TimelineSync';
import {
  ChevronLeft, ChevronRight, Plane, Hotel, UtensilsCrossed,
  Compass, Train, CloudSun, CalendarDays,
  Wallet, Clock3, Map, MoreHorizontal, MapPin,
  Share2, Download, RefreshCw, Globe,
} from 'lucide-react';
import { ConciergePanel }        from '@/components/ai/ConciergePanel';
import { OmniSelectorConsole }  from '@/components/OmniSelectorConsole';
import type { ZoneId }          from '@/lib/zoneEngines';

// ── Zone definitions ──────────────────────────────────────────────────────────

type NavZone = {
  id:      string;
  label:   string;
  labelHe: string;
  icon:    React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  color:   string;
  glow:    string;
  href:    string;
};

const PLAN_ZONES: NavZone[] = [
  { id: 'flights',     label: 'Flights',     labelHe: 'טיסות',  icon: Plane,           color: '#007AFF', glow: 'rgba(0,122,255,0.28)',   href: '/zone/flights' },
  { id: 'lodging',     label: 'Stays',       labelHe: 'לינה',   icon: Hotel,           color: '#5AC8FA', glow: 'rgba(90,200,250,0.28)',  href: '/zone/lodging' },
  { id: 'dining',      label: 'Dining',      labelHe: 'אוכל',   icon: UtensilsCrossed, color: '#FF9F0A', glow: 'rgba(255,159,10,0.28)',  href: '/zone/dining' },
  { id: 'attractions', label: 'Experiences', labelHe: 'חוויות', icon: Compass,         color: '#30D158', glow: 'rgba(48,209,88,0.28)',   href: '/zone/attractions' },
  { id: 'transit',     label: 'Transit',     labelHe: 'תחבורה', icon: Train,           color: '#BF5AF2', glow: 'rgba(191,90,242,0.28)', href: '/zone/transit' },
  { id: 'conditions',  label: 'Conditions',  labelHe: 'תנאים',  icon: CloudSun,        color: '#FF453A', glow: 'rgba(255,69,58,0.28)',   href: '/zone/conditions' },
];

const MANAGE_ZONES: NavZone[] = [
  { id: 'timeline', label: 'Timeline', labelHe: 'ציר זמן', icon: CalendarDays, color: '#007AFF', glow: 'rgba(0,122,255,0.28)',  href: '/zone/management' },
  { id: 'budget',   label: 'Budget',   labelHe: 'תקציב',   icon: Wallet,       color: '#30D158', glow: 'rgba(48,209,88,0.28)',  href: '/zone/management?tab=budget' },
  { id: 'schedule', label: 'Schedule', labelHe: 'לו"ז',    icon: Clock3,       color: '#FF9F0A', glow: 'rgba(255,159,10,0.28)', href: '/zone/management?tab=schedule' },
];

const SPRING      = { type: 'spring', stiffness: 500, damping: 34 } as const;
const SPRING_SLOW = { type: 'spring', stiffness: 280, damping: 26 } as const;

// ── [FIX] Particle burst — positions memoised, no Math.random() at render ─────

function ParticleBurst({ color }: { color: string }) {
  // [FIX] useMemo prevents non-deterministic values on every render
  const particles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      x:    Math.cos((i / 8) * 2 * Math.PI) * (18 + (i % 3) * 8),
      y:    Math.sin((i / 8) * 2 * Math.PI) * (18 + (i % 3) * 8),
      size: 2 + (i % 3),
      delay: i * 0.022,
    })),
  []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 20, overflow: 'visible',
    }}>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.1 }}
          transition={{ duration: 0.52, delay: p.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            position: 'absolute',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 ${p.size * 3}px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

// ── [FIX] Budget ping — framer-motion, limited cycles, aria-hidden ─────────────

function BudgetPing({ dotColor = '#30D158' }: { dotColor?: string }) {
  return (
    <>
      <motion.div
        aria-hidden
        animate={{ scale: [1, 2.5, 2.5], opacity: [0.65, 0, 0] }}
        transition={{ duration: 1.9, repeat: 4, ease: 'easeOut', repeatDelay: 1.4 }}
        style={{
          position: 'absolute',
          width: 6, height: 6, borderRadius: '50%',
          border: `1px solid ${dotColor}`,
          pointerEvents: 'none',
        }}
      />
      <motion.div
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 8px ${dotColor}cc`,
          position: 'relative', zIndex: 1,
        }}
      />
    </>
  );
}

// ── Sub-zone tab — stagger + isPreview for hover-preview mode ────────────────

function SubZoneTab({
  zone, isActive, isHe, index, isPreview = false,
}: {
  zone: NavZone; isActive: boolean; isHe: boolean; index: number; isPreview?: boolean;
}) {
  const Icon = zone.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: isPreview ? 3 : -7, scale: isPreview ? 0.96 : 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      // [FIX] isPreview: fast fade-in without stagger; real switch: full stagger
      transition={isPreview
        ? { duration: 0.14, delay: index * 0.028 }
        : { ...SPRING, delay: 0.05 + index * 0.05 }
      }
      style={{ position: 'relative', flexShrink: 0 }}
    >
      <Link href={zone.href} style={{ textDecoration: 'none', display: 'block' }}>
        {isActive && (
          <motion.div
            layoutId="subzone-pill"
            style={{
              position: 'absolute', inset: 0, borderRadius: 100,
              background: `linear-gradient(135deg, ${zone.color}20 0%, ${zone.color}10 100%)`,
              border: `1px solid ${zone.color}30`,
              boxShadow: `0 0 18px ${zone.glow}, 0 2px 6px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.88)`,
            }}
            transition={SPRING}
          />
        )}
        <motion.div
          whileHover={!isActive ? { backgroundColor: 'rgba(0,0,0,0.04)' } : {}}
          whileTap={{ scale: 0.91 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 13px', borderRadius: 100, cursor: 'pointer',
          }}
        >
          <motion.div
            animate={{ scale: isActive ? 1 : 0.88, opacity: isActive ? 1 : 0.6 }}
            transition={SPRING}
          >
            <Icon size={12} color={isActive ? zone.color : '#636366'} strokeWidth={isActive ? 2.5 : 2} />
          </motion.div>
          <span style={{
            fontSize: 11.5, fontWeight: isActive ? 700 : 500,
            color: isActive ? zone.color : '#636366',
            letterSpacing: '-0.015em', whiteSpace: 'nowrap',
          }}>
            {isHe ? zone.labelHe : zone.label}
          </span>
          {isActive && (
            <motion.div
              layoutId="subzone-dot"
              style={{
                position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)',
                width: 4, height: 4, borderRadius: '50%', background: zone.color,
                boxShadow: `0 0 7px ${zone.color}, 0 0 14px ${zone.glow}`,
              }}
              transition={SPRING}
            />
          )}
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ── PLAN / MANAGE segmented control ──────────────────────────────────────────
// New: ambient light tracking, zone count badges, ⌘1/⌘2 kbd hints,
//      jelly squish, timeout cleanup, overflow fix, a11y improvements

function ModeSwitcher({
  mode, isHe, onSwitch, onHoverChange,
}: {
  mode: 'plan' | 'manage';
  isHe: boolean;
  onSwitch: (m: 'plan' | 'manage') => void;
  onHoverChange?: (m: 'plan' | 'manage' | null) => void;
}) {
  const [burstKey, setBurstKey]       = useState(0);
  const [burstColor, setBurstColor]   = useState('#007AFF');
  const [showBurst, setShowBurst]     = useState(false);
  const [rippleOn, setRippleOn]       = useState<'plan' | 'manage' | null>(null);
  const [hoveredMode, setHoveredMode] = useState<'plan' | 'manage' | null>(null);
  // [NEW] ambient light tracking — mouse X as percentage within container
  const [lightX, setLightX]           = useState(50);
  // [FIX] timeout refs for proper cleanup on unmount
  const burstTimerRef                  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rippleTimerRef                 = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    clearTimeout(burstTimerRef.current);
    clearTimeout(rippleTimerRef.current);
  }, []);

  const PLAN_COLOR   = '#007AFF';
  const MANAGE_COLOR = '#5E5CE6';

  const previewColor    = hoveredMode && hoveredMode !== mode ? hoveredMode : mode;
  const containerAccent = previewColor === 'plan' ? '0,122,255' : '94,92,230';

  function handleSwitch(m: 'plan' | 'manage') {
    if (m === mode) return;
    const col = m === 'plan' ? PLAN_COLOR : MANAGE_COLOR;
    setBurstColor(col);
    setBurstKey(k => k + 1);
    setShowBurst(true);
    setRippleOn(m);
    clearTimeout(burstTimerRef.current);
    clearTimeout(rippleTimerRef.current);
    burstTimerRef.current  = setTimeout(() => setShowBurst(false), 620);
    rippleTimerRef.current = setTimeout(() => setRippleOn(null),   520);
    onSwitch(m);
  }

  return (
    <motion.div style={{ perspective: '900px' }}>
      <motion.div
        onMouseMove={(e) => {
          // [NEW] ambient light: track cursor position inside container
          const rect = e.currentTarget.getBoundingClientRect();
          setLightX(((e.clientX - rect.left) / rect.width) * 100);
        }}
        onMouseLeave={() => setLightX(50)}
        whileHover={{ rotateX: 2, rotateY: -2.5, scale: 1.025 }}
        // [NEW] jelly squish deformation on tap — Tactile Digital style
        whileTap={{ scaleX: 1.05, scaleY: 0.91 }}
        transition={{
          default: SPRING_SLOW,
          // [NEW] bounce-back spring for squish axes
          scaleX: { type: 'spring', stiffness: 600, damping: 18 },
          scaleY: { type: 'spring', stiffness: 600, damping: 18 },
        }}
        style={{
          display: 'flex', alignItems: 'center',
          // [NEW] radial gradient follows mouse X — ambient light effect
          // [FIX] no CSS transition: string on motion.div
          background: `radial-gradient(ellipse at ${lightX}% 50%, rgba(${containerAccent}, 0.11) 0%, rgba(${containerAccent}, 0.04) 65%)`,
          borderRadius: 100, padding: '3px',
          border: `1px solid rgba(${containerAccent}, 0.12)`,
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Particle burst */}
        <AnimatePresence>
          {showBurst && <ParticleBurst key={burstKey} color={burstColor} />}
        </AnimatePresence>

        {(['plan', 'manage'] as const).map(m => {
          const isActive = mode === m;
          const color    = m === 'plan' ? PLAN_COLOR : MANAGE_COLOR;
          const label    = m === 'plan'
            ? (isHe ? 'תכנון' : 'Plan')
            : (isHe ? 'ניהול' : 'Manage');
          const ModeIcon = m === 'plan' ? Plane : CalendarDays;

          return (
            <button
              key={m}
              type="button"    // [FIX] always declare button type
              role="tab"
              aria-selected={isActive}
              aria-label={`${label} mode${isActive ? ' — active' : ''}`}
              onClick={() => handleSwitch(m)}
              onMouseEnter={() => {
                setHoveredMode(m);
                onHoverChange?.(m);
              }}
              onMouseLeave={() => {
                setHoveredMode(null);
                onHoverChange?.(null);
              }}
              style={{
                position: 'relative',
                padding: '6px 24px',
                borderRadius: 100,
                border: 'none', background: 'none',
                cursor: 'pointer', outline: 'none',
                // [FIX] overflow visible so ripple isn't clipped
                overflow: 'visible',
              }}
            >
              {/* [NEW] ⌘1 / ⌘2 keyboard shortcut badge — fades in on hover */}
              <AnimatePresence>
                {hoveredMode === m && (
                  <motion.span
                    key="kbd"
                    initial={{ opacity: 0, y: 4, scale: 0.72 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.72 }}
                    transition={{ duration: 0.16 }}
                    aria-hidden
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 4px)',
                      left: '50%', transform: 'translateX(-50%)',
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.02em',
                      color: color, whiteSpace: 'nowrap',
                      background: `rgba(${m === 'plan' ? '0,122,255' : '94,92,230'}, 0.10)`,
                      border: `1px solid rgba(${m === 'plan' ? '0,122,255' : '94,92,230'}, 0.22)`,
                      borderRadius: 4, padding: '2px 5px',
                      pointerEvents: 'none', zIndex: 30,
                    }}
                  >
                    {'⌘'}{m === 'plan' ? '1' : '2'}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Active thumb — elevated shadow + will-change */}
              {isActive && (
                <motion.div
                  layoutId="mode-thumb"
                  initial={{ scale: 0.84 }}
                  animate={{ scale: 1 }}
                  transition={{ ...SPRING_SLOW, scale: { type: 'spring', stiffness: 480, damping: 22 } }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 100,
                    background: `linear-gradient(135deg, ${color}1c 0%, ${color}10 100%)`,
                    border: `1px solid ${color}2c`,
                    // [FIX] elevated shadow + inner highlight instead of animated boxShadow
                    boxShadow: `0 3px 18px rgba(${m === 'plan' ? '0,122,255' : '94,92,230'}, 0.24), inset 0 1px 0 rgba(255,255,255,0.96)`,
                    // [FIX] GPU hint
                    willChange: 'transform',
                  }}
                >
                  {/* Breathing glow — [FIX] opacity only (no boxShadow animation), limited cycles */}
                  <motion.div
                    aria-hidden
                    animate={{ opacity: [0.35, 0.80, 0.35] }}
                    transition={{ duration: 2.8, repeat: 4, ease: 'easeInOut' }}
                    style={{
                      position: 'absolute', inset: -2, borderRadius: 100,
                      boxShadow: `0 0 22px ${color}30`,
                      pointerEvents: 'none',
                    }}
                  />
                </motion.div>
              )}

              {/* Ripple on click */}
              <AnimatePresence>
                {rippleOn === m && (
                  <motion.div
                    aria-hidden
                    key="ripple"
                    initial={{ scale: 0, opacity: 0.30 }}
                    animate={{ scale: 3.4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.50, ease: 'easeOut' }}
                    style={{
                      position: 'absolute', inset: 0,
                      borderRadius: '50%',
                      background: color,
                      pointerEvents: 'none', zIndex: 0,
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Icon + label + [NEW] zone count badge */}
              <motion.div
                style={{
                  position: 'relative', zIndex: 1,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <motion.div
                  animate={{ scale: isActive ? 1 : 0.80, opacity: isActive ? 1 : 0.60, rotate: isActive ? 0 : -12 }}
                  transition={SPRING}
                >
                  <ModeIcon size={11} color={isActive ? color : '#636366'} strokeWidth={isActive ? 2.5 : 2} />
                </motion.div>

                {/* [FIX] inactive contrast #8E8E93 → #636366 */}
                <motion.span
                  animate={{ color: isActive ? color : '#636366' }}
                  transition={{ duration: 0.22 }}
                  style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  {label}
                </motion.span>

                {/* Zone count badge — dynamic from actual zone arrays */}
                <motion.div
                  animate={{
                    background: isActive
                      ? `rgba(${m === 'plan' ? '0,122,255' : '94,92,230'}, 0.14)`
                      : 'rgba(0,0,0,0.07)',
                  }}
                  transition={{ duration: 0.24 }}
                  style={{
                    width: 15, height: 15, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, letterSpacing: '-0.02em',
                    color: isActive ? color : '#636366',
                    flexShrink: 0,
                  }}
                >
                  {m === 'plan' ? PLAN_ZONES.length : MANAGE_ZONES.length}
                </motion.div>
              </motion.div>
            </button>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ── More Options Menu ────────────────────────────────────────────────────────

function MoreOptionsMenu({
  trip,
  days,
}: {
  trip: { title: string; nights: number; startDate: string; endDate: string };
  days: Array<{ id: string; dayNumber: number; destination: string; entities: unknown[] }>;
}) {
  const [open, setOpen]      = useState(false);
  const router               = useRouter();
  const { success, info }    = useToast();
  const ref                  = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleShare = async () => {
    setOpen(false);
    const url = window.location.origin + '/zone/management';
    if (navigator.share) {
      try { await navigator.share({ title: trip.title || 'My Trip', url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); success('Trip link copied to clipboard'); } catch { info('Copy: ' + url); }
  };

  const handleExportICS = async () => {
    setOpen(false);
    try {
      const { downloadICS } = await import('@/utils/icsExport');
      downloadICS(days as Parameters<typeof downloadICS>[0], trip.title || 'My Trip');
      success('Calendar file downloaded');
    } catch { info('ICS export failed'); }
  };

  const handleNewTrip = () => {
    setOpen(false);
    router.push('/');
  };

  const MENU_ITEMS = [
    { icon: Share2,    label: 'Share trip',       onClick: handleShare,    color: '#007AFF' },
    { icon: Download,  label: 'Export to calendar', onClick: handleExportICS, color: '#5E5CE6' },
    { icon: RefreshCw, label: 'Plan new trip',     onClick: handleNewTrip,  color: '#30D158' },
  ];

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.10, background: open ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.08)' }}
        whileTap={{ scale: 0.86 }}
        transition={SPRING}
        onClick={() => setOpen(v => !v)}
        aria-label="More options"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 33, height: 33, borderRadius: '50%',
          background: open ? 'rgba(0,122,255,0.08)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${open ? 'rgba(0,122,255,0.20)' : 'rgba(0,0,0,0.08)'}`,
          cursor: 'pointer',
        }}
      >
        <MoreHorizontal size={14} color={open ? '#007AFF' : '#6E6E73'} strokeWidth={2} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0,   scale: 0.92, y: -6  }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              zIndex: 200, minWidth: 190,
              background: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.96)',
              borderRadius: 16,
              boxShadow: '0 12px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
              overflow: 'hidden',
              padding: '5px',
            }}
          >
            {MENU_ITEMS.map(({ icon: Icon, label, onClick, color }) => (
              <motion.button
                key={label}
                type="button"
                onClick={onClick}
                whileHover={{ background: `${color}0C` }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', padding: '9px 12px', borderRadius: 11,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: `${color}12`, border: `1px solid ${color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={11} color={color} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
                  {label}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Inner layout ──────────────────────────────────────────────────────────────

function ZoneLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const trip         = useTravelEngine(s => s.trip);
  const budget       = useTravelEngine(s => s.budget);
  const days         = useTravelEngine(s => s.days);
  const activeDay    = useTravelEngine(s => s.activeDay);
  const totalEntities = useMemo(() => days.reduce((s, d) => s + d.entities.length, 0), [days]);
  const { profile, toggleLocale }  = useLocaleEngine();
  const isHe         = profile.locale === 'he-IL';
  const { success: toastSuccess, info: toastInfo } = useToast();

  const isManageMode             = pathname.includes('/zone/management');
  const mode: 'plan' | 'manage'  = isManageMode ? 'manage' : 'plan';
  const modeColor                = mode === 'plan' ? '#007AFF' : '#5E5CE6';
  const modeColorRg              = mode === 'plan' ? '0,122,255' : '94,92,230';

  // [NEW] bar thud pulse on mode switch — imperative animation
  const [barRef, barAnimate] = useAnimate();

  // [NEW] hover sub-zone preview state
  const [previewMode, setPreviewMode] = useState<'plan' | 'manage' | null>(null);
  const previewTimerRef               = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // [NEW] stable ref for keyboard handler so effect deps are empty
  const handleModeSwitchRef = useRef<(m: 'plan' | 'manage') => void>(() => {});

  // [NEW] remember last visited plan zone — so PLAN toggle returns to it
  const lastPlanZoneRef = useRef('/zone/flights');

  useEffect(() => () => clearTimeout(previewTimerRef.current), []);

  // Track last plan zone on every pathname change
  useEffect(() => {
    if (!pathname.includes('/zone/management')) {
      lastPlanZoneRef.current = pathname;
    }
  }, [pathname]);

  // Derive search zone for OmniSelectorConsole left panel
  const SEARCH_ZONE_IDS = new Set(['flights', 'lodging', 'dining', 'attractions', 'transit']);
  const rawZoneId = (() => {
    const m = pathname.match(/\/zone\/([^/?]+)/);
    return m?.[1] ?? '';
  })();
  const isSearchZone  = SEARCH_ZONE_IDS.has(rawZoneId);
  const currentZoneId = rawZoneId as ZoneId;

  // Active sub-zone ID
  const activeSubId = (() => {
    if (isManageMode) {
      const tab = searchParams.get('tab');
      if (tab === 'budget')   return 'budget';
      if (tab === 'schedule') return 'schedule';
      return 'timeline';
    }
    const m = pathname.match(/\/zone\/([^/?]+)/);
    return m?.[1] ?? '';
  })();

  function handleModeSwitch(m: 'plan' | 'manage') {
    // always clear preview state on any deliberate switch
    clearTimeout(previewTimerRef.current);
    setPreviewMode(null);
    if (m === 'plan'   && mode !== 'plan') {
      if (barRef.current) barAnimate(barRef.current, { scale: [1, 1.004, 1] }, { duration: 0.22, ease: 'easeOut' });
      router.push(lastPlanZoneRef.current);
    }
    if (m === 'manage' && mode !== 'manage') {
      if (barRef.current) barAnimate(barRef.current, { scale: [1, 1.004, 1] }, { duration: 0.22, ease: 'easeOut' });
      router.push('/zone/management');
    }
  }
  // Keep ref current so keyboard handler always has latest version
  handleModeSwitchRef.current = handleModeSwitch;

  // [NEW] ⌘1 / ⌘2 keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '1') { e.preventDefault(); handleModeSwitchRef.current('plan'); }
      if (e.key === '2') { e.preventDefault(); handleModeSwitchRef.current('manage'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Global "Add to Trip" handler — catches zone-drag-commit events from all plan zones.
  // LiquidTimeline handles these on the management page; this handles all other zones.
  const activeDayRef = useRef(activeDay);
  const daysRef      = useRef(days);
  useEffect(() => { activeDayRef.current = activeDay; }, [activeDay]);
  useEffect(() => { daysRef.current = days; }, [days]);

  useEffect(() => {
    const handler = async (e: Event) => {
      // Management page: LiquidTimeline has its own listener — don't double-fire
      if (pathname.includes('/zone/management')) return;

      const detail      = (e as CustomEvent<TimelineDropPayload>).detail;
      const targetDayId = activeDayRef.current ?? daysRef.current[0]?.id;
      if (!targetDayId) {
        toastInfo('Set up your trip first to add items');
        return;
      }

      try {
        const { handleEntityDrop } = await import('@/utils/TimelineSync');
        await handleEntityDrop(detail, targetDayId);
        const dayNum = daysRef.current.find(d => d.id === targetDayId)?.dayNumber ?? 1;
        toastSuccess(`${detail.title} added to Day ${dayNum}`);
      } catch (err) {
        console.error('[ZoneLayout] add-to-trip failed:', err);
      }
    };

    document.addEventListener('unitravel:zone-drag-commit', handler);
    return () => document.removeEventListener('unitravel:zone-drag-commit', handler);
  // pathname changes but we use refs for activeDay/days to avoid re-subscribing constantly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // [NEW] hover preview handler — triggered from ModeSwitcher
  function handleHoverChange(m: 'plan' | 'manage' | null) {
    clearTimeout(previewTimerRef.current);
    if (m !== null && m !== mode) {
      previewTimerRef.current = setTimeout(() => setPreviewMode(m), 600);
    } else {
      setPreviewMode(null);
    }
  }

  const displayedMode    = previewMode ?? mode;
  const displayedZones   = displayedMode === 'plan' ? PLAN_ZONES : MANAGE_ZONES;
  const isPreview        = previewMode !== null;
  // sub-zone row border follows the DISPLAYED mode, not just the active mode
  const subZoneColorRg   = displayedMode === 'plan' ? '0,122,255' : '94,92,230';
  const subZoneAccent    = displayedMode === 'plan' ? '#007AFF' : '#5E5CE6';

  // Zone-specific ambient atmosphere — each zone bleeds its accent color into the background
  const ZONE_AMBIENT: Record<string, { rgb: string; hex: string; orb1: string; orb2: string }> = {
    flights:     { rgb: '0,122,255',    hex: '#007AFF', orb1: 'rgba(0,122,255,0.07)',    orb2: 'rgba(90,200,250,0.05)'   },
    lodging:     { rgb: '90,200,250',   hex: '#5AC8FA', orb1: 'rgba(90,200,250,0.08)',   orb2: 'rgba(0,199,190,0.05)'    },
    dining:      { rgb: '255,159,10',   hex: '#FF9F0A', orb1: 'rgba(255,159,10,0.08)',   orb2: 'rgba(255,69,58,0.04)'    },
    attractions: { rgb: '48,209,88',    hex: '#30D158', orb1: 'rgba(48,209,88,0.07)',    orb2: 'rgba(0,199,190,0.05)'    },
    transit:     { rgb: '191,90,242',   hex: '#BF5AF2', orb1: 'rgba(191,90,242,0.07)',   orb2: 'rgba(94,92,230,0.05)'    },
    management:  { rgb: '94,92,230',    hex: '#5E5CE6', orb1: 'rgba(94,92,230,0.07)',    orb2: 'rgba(191,90,242,0.04)'   },
    map:         { rgb: '0,199,190',    hex: '#00C7BE', orb1: 'rgba(0,199,190,0.07)',    orb2: 'rgba(48,209,88,0.04)'    },
    conditions:  { rgb: '255,69,58',    hex: '#FF453A', orb1: 'rgba(255,69,58,0.07)',    orb2: 'rgba(255,159,10,0.05)'   },
  };
  const zoneAtm = ZONE_AMBIENT[rawZoneId] ?? ZONE_AMBIENT[mode === 'plan' ? 'flights' : 'management'];

  const totalBudget  = budget?.total ?? 0;
  const spentBudget  = budget?.spent ?? 0;
  const spendPct     = totalBudget > 0 ? spentBudget / totalBudget : 0;

  // Adaptive color: green → yellow → red as budget fills up
  const budgetDotColor = spendPct >= 0.85
    ? '#FF453A'
    : spendPct >= 0.55
    ? '#FF9F0A'
    : '#30D158';
  const budgetBgColor  = spendPct >= 0.85
    ? 'rgba(255,69,58,0.10)'
    : spendPct >= 0.55
    ? 'rgba(255,159,10,0.10)'
    : 'rgba(48,209,88,0.10)';
  const budgetBorderColor = spendPct >= 0.85
    ? 'rgba(255,69,58,0.28)'
    : spendPct >= 0.55
    ? 'rgba(255,159,10,0.28)'
    : 'rgba(48,209,88,0.26)';
  const budgetTextColor = spendPct >= 0.85
    ? '#8B1A1A'
    : spendPct >= 0.55
    ? '#6B4200'
    : '#1A6B32';

  function fmtK(n: number) {
    return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : n > 0 ? `$${n}` : '$0';
  }

  // Show pill only if budget is configured
  const showBudgetPill = totalBudget > 0;
  // Label: if any spending happened show "spent / total", else just total
  const budgetLabel = spentBudget > 0
    ? `${fmtK(spentBudget)} / ${fmtK(totalBudget)}`
    : fmtK(totalBudget);

  return (
    // [NEW] MotionConfig: automatically disables all framer-motion animations
    // when OS setting prefers-reduced-motion is on — CRITICAL a11y fix
    <MotionConfig reducedMotion="user">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* [NEW] Screen-reader live region — announces mode switches */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic
          style={{
            position: 'absolute', width: 1, height: 1,
            margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap', border: 0, padding: 0,
            pointerEvents: 'none',
          }}
        >
          {isHe
            ? (mode === 'plan' ? 'מצב תכנון פעיל' : 'מצב ניהול פעיל')
            : (mode === 'plan' ? 'Planning mode' : 'Management mode')
          }
        </div>

        {/* ── Premium glass top bar ──────────────────────────────────────── */}
        <motion.div
          ref={barRef}  // [NEW] barAnimate target for thud effect
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 24, delay: 0.04 }}
          style={{
            flexShrink: 0,
            margin: '10px 12px 0',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 11px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(64px) saturate(220%)',
            WebkitBackdropFilter: 'blur(64px) saturate(220%)',
            border: '1px solid rgba(255,255,255,0.96)',
            boxShadow: `0 4px 32px rgba(0,0,0,0.09),
                        0 1px 6px rgba(0,0,0,0.04),
                        0 0 0 0.5px rgba(255,255,255,0.68),
                        inset 0 1.5px 0 rgba(255,255,255,1)`,
            position: 'relative', overflow: 'visible', minHeight: 54,
          }}
        >
          {/* Top specular line */}
          <div aria-hidden style={{
            position: 'absolute', left: '5%', right: '5%', top: 0, height: 1, zIndex: 4,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 28%, rgba(255,255,255,1) 72%, transparent)',
            borderRadius: 999, pointerEvents: 'none',
          }} />

          {/* Mode-tinted overlay */}
          <motion.div
            aria-hidden
            animate={{
              background: mode === 'plan'
                ? 'linear-gradient(125deg, rgba(0,122,255,0.032) 0%, transparent 55%)'
                : 'linear-gradient(125deg, rgba(94,92,230,0.032) 0%, transparent 55%)',
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none', zIndex: 1 }}
          />

          {/* Bottom accent line */}
          <motion.div
            aria-hidden
            animate={{
              background: isSearchZone && rawZoneId
                ? `linear-gradient(90deg, transparent 8%, rgba(${zoneAtm.rgb},0.48) 35%, rgba(${zoneAtm.rgb},0.60) 50%, rgba(${zoneAtm.rgb},0.48) 65%, transparent 92%)`
                : mode === 'plan'
                  ? 'linear-gradient(90deg, transparent 12%, rgba(0,122,255,0.42) 40%, rgba(0,122,255,0.42) 60%, transparent 88%)'
                  : 'linear-gradient(90deg, transparent 12%, rgba(94,92,230,0.42) 40%, rgba(94,92,230,0.42) 60%, transparent 88%)',
            }}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, pointerEvents: 'none', zIndex: 4 }}
          />

          {/* Left: back + trip chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, zIndex: 2 }}>
            <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <motion.div
                whileHover={{ scale: 1.10, background: 'rgba(0,122,255,0.14)' }}
                whileTap={{ scale: 0.86 }}
                transition={SPRING}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 33, height: 33, borderRadius: '50%',
                  background: 'rgba(0,122,255,0.08)',
                  border: '1px solid rgba(0,122,255,0.18)',
                  boxShadow: '0 2px 8px rgba(0,122,255,0.10), inset 0 1px 0 rgba(255,255,255,0.80)',
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={14} color="#007AFF" strokeWidth={2.5} />
              </motion.div>
            </Link>

            {trip?.title && (
              <motion.div
                initial={{ opacity: 0, scale: 0.84 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING, delay: 0.14 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 11px 4px 5px', borderRadius: 100,
                  background: 'rgba(0,0,0,0.038)',
                  border: '1px solid rgba(0,0,0,0.072)',
                  flexShrink: 1, minWidth: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MapPin size={9} color="white" strokeWidth={2.5} />
                </div>
                <span style={{
                  fontSize: 11.5, fontWeight: 600, color: '#3A3A3C',
                  letterSpacing: '-0.01em', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110,
                }}>
                  {trip.title}
                </span>
                {trip.nights > 0 && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, color: '#8E8E93',
                    letterSpacing: '-0.01em', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {trip.nights}n
                  </span>
                )}
              </motion.div>
            )}
          </div>

          {/* Center: PLAN / MANAGE hero control */}
          <div style={{ flexShrink: 0, zIndex: 2 }}>
            <ModeSwitcher
              mode={mode}
              isHe={isHe}
              onSwitch={handleModeSwitch}
              onHoverChange={handleHoverChange}
            />
          </div>

          {/* Right: budget + map + more */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, justifyContent: 'flex-end', minWidth: 0, zIndex: 2 }}>
            {showBudgetPill && (
              <Link href="/zone/management?tab=budget" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.84 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ ...SPRING, delay: 0.18 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 11px 5px 7px', borderRadius: 100,
                    background: budgetBgColor,
                    border: `1px solid ${budgetBorderColor}`,
                    flexShrink: 0, position: 'relative', cursor: 'pointer',
                    transition: 'background 0.4s ease, border-color 0.4s ease',
                  }}
                >
                  <div style={{ position: 'relative', width: 6, height: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BudgetPing dotColor={budgetDotColor} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: budgetTextColor, letterSpacing: '-0.01em', transition: 'color 0.4s ease' }}>
                    {budgetLabel}
                  </span>
                </motion.div>
              </Link>
            )}

            {/* Map icon — framer-motion animate for mode color, no CSS transition */}
            <Link href="/zone/map" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <motion.div
                animate={{ background: `rgba(${modeColorRg},0.08)` }}
                whileHover={{ scale: 1.10, background: `rgba(${modeColorRg},0.14)` }}
                whileTap={{ scale: 0.86 }}
                transition={{ default: SPRING, background: { duration: 0.40, ease: 'easeInOut' } }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 33, height: 33, borderRadius: '50%',
                  // border uses CSS transition (no framer conflict)
                  border: `1px solid rgba(${modeColorRg},0.18)`,
                  transition: 'border-color 0.40s ease',
                  cursor: 'pointer',
                }}
              >
                <Map size={14} color={modeColor} strokeWidth={2} />
              </motion.div>
            </Link>

            {/* Locale toggle — EN ↔ עב */}
            <motion.button
              type="button"
              onClick={toggleLocale}
              whileHover={{ scale: 1.10 }}
              whileTap={{ scale: 0.86, rotate: 15 }}
              transition={SPRING}
              aria-label={isHe ? 'Switch to English' : 'עבור לעברית'}
              title={isHe ? 'Switch to English' : 'Switch to Hebrew / עברית'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '0 9px', height: 33, borderRadius: 100, flexShrink: 0,
                background: isHe ? 'rgba(0,122,255,0.08)' : 'rgba(0,0,0,0.04)',
                border: isHe ? '1px solid rgba(0,122,255,0.20)' : '1px solid rgba(0,0,0,0.08)',
                cursor: 'pointer',
              }}
            >
              <Globe size={11} color={isHe ? '#007AFF' : '#6E6E73'} strokeWidth={2} />
              <span style={{ fontSize: 10, fontWeight: 800, color: isHe ? '#007AFF' : '#6E6E73', letterSpacing: '0.02em' }}>
                {isHe ? 'EN' : 'עב'}
              </span>
            </motion.button>

            <MoreOptionsMenu trip={trip} days={days} />
          </div>
        </motion.div>

        {/* ── Sub-zone row — preview + stagger + opacity-only crossfade ─── */}
        <div style={{
          flexShrink: 0, display: 'flex', justifyContent: 'center',
          padding: '7px 12px 0', overflow: 'visible', position: 'relative',
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={displayedMode}
              // [FIX] opacity-only crossfade — no scale jitter
              initial={{ opacity: 0 }}
              animate={{ opacity: isPreview ? 0.60 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="liquid-glass-shimmer"
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                padding: '4px 6px', borderRadius: 100,
                background: 'rgba(255,255,255,0.90)',
                backdropFilter: 'blur(48px) saturate(200%)',
                WebkitBackdropFilter: 'blur(48px) saturate(200%)',
                border: `1.5px solid rgba(${subZoneColorRg},0.18)`,
                boxShadow: `0 4px 24px rgba(${subZoneColorRg},0.10),
                            0 1px 4px rgba(0,0,0,0.04),
                            inset 0 1.5px 0 rgba(255,255,255,0.99)`,
                position: 'relative',
              }}
            >
              {/* Specular */}
              <div aria-hidden style={{
                position: 'absolute', left: '6%', right: '6%', top: 0, height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 30%, rgba(255,255,255,1) 70%, transparent)',
                borderRadius: 999, pointerEvents: 'none',
              }} />

              {/* [NEW] Preview label — shown when hovering inactive mode ≥600ms */}
              {isPreview && (
                <motion.div
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    position: 'absolute', top: -18, left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: subZoneAccent,
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                  }}
                >
                  {isHe ? 'תצוגה מקדימה' : 'preview'}
                </motion.div>
              )}

              {displayedZones.map((zone, index) => (
                <SubZoneTab
                  key={zone.id}
                  zone={zone}
                  isActive={!isPreview && activeSubId === zone.id}
                  isHe={isHe}
                  index={index}
                  isPreview={isPreview}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Planning strip — visible in PLAN mode when items exist ────── */}
        <AnimatePresence>
          {mode === 'plan' && totalEntities > 0 && (
            <motion.div
              key="planning-strip"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ flexShrink: 0, overflow: 'hidden', paddingInline: 14, paddingTop: 5 }}
            >
              <Link href="/zone/management" style={{ textDecoration: 'none', display: 'block' }}>
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '5px 14px', borderRadius: 100,
                    background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.20)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,122,255,0.08), inset 0 1px 0 rgba(255,255,255,0.90)',
                  }}
                >
                  <CalendarDays size={11} color="#007AFF" strokeWidth={2.5} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#007AFF', letterSpacing: '-0.01em' }}>
                    {totalEntities} item{totalEntities !== 1 ? 's' : ''} on timeline
                  </span>
                  {days.filter(d => d.entities.length > 0).slice(0, 4).map(d => (
                    <span
                      key={d.id}
                      style={{
                        fontSize: 9, fontWeight: 700, color: '#007AFF',
                        background: 'rgba(0,122,255,0.10)', borderRadius: 100, padding: '1px 6px',
                      }}
                    >
                      D{d.dayNumber}·{d.entities.length}
                    </span>
                  ))}
                  <ChevronRight size={10} color="#007AFF" strokeWidth={2.5} />
                </motion.div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Zone content — 3-column: [zone page] [AI concierge] ──────── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', marginTop: 8, position: 'relative' }}>

          {/* Zone-specific ambient atmosphere — transitions on zone change */}
          <AnimatePresence initial={false}>
            <motion.div
              key={rawZoneId || mode}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: `radial-gradient(ellipse at 62% 0%, rgba(${zoneAtm.rgb},0.10) 0%, rgba(${zoneAtm.rgb},0.04) 40%, transparent 70%)`,
              }}
            />
          </AnimatePresence>

          {/* Zone-tinted drifting ambient orbs */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            <div style={{
              position: 'absolute', top: '-18%', right: '-2%',
              width: '46%', height: '50%', borderRadius: '50%',
              background: `radial-gradient(ellipse, ${zoneAtm.orb1} 0%, transparent 65%)`,
              animation: 'ambient-drift-a 26s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', bottom: '-10%', left: '4%',
              width: '38%', height: '42%', borderRadius: '50%',
              background: `radial-gradient(ellipse, ${zoneAtm.orb2} 0%, transparent 65%)`,
              animation: 'ambient-drift-b 34s ease-in-out infinite',
              animationDelay: '5s',
            }} />
            <div style={{
              position: 'absolute', top: '30%', left: '-4%',
              width: '28%', height: '32%', borderRadius: '50%',
              background: `radial-gradient(ellipse, ${zoneAtm.orb1.replace(/[\d.]+\)$/, '0.04)')} 0%, transparent 65%)`,
              animation: 'ambient-drift-a 40s ease-in-out infinite',
              animationDelay: '12s',
            }} />
          </div>

          {/* LEFT: Engine selector — 220px, only for search zones */}
          {isSearchZone && (
            <motion.div
              key={currentZoneId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28, delay: 0.06 }}
              style={{
                width:         220,
                flexShrink:    0,
                position:      'relative',
                zIndex:        2,
                marginInlineEnd: 8,
                borderRadius:  20,
                background:    'rgba(255,255,255,0.86)',
                backdropFilter:'blur(56px) saturate(200%)',
                WebkitBackdropFilter: 'blur(56px) saturate(200%)',
                border:        '1px solid rgba(255,255,255,0.96)',
                boxShadow:     '0 8px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
                display:       'flex',
                flexDirection: 'column',
                overflow:      'hidden',
              }}
            >
              {/* Specular top line */}
              <div aria-hidden style={{
                position: 'absolute', left: '6%', right: '6%', top: 0, height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 35%, rgba(255,255,255,0.95) 65%, transparent)',
                zIndex: 4, borderRadius: 999, pointerEvents: 'none',
              }} />
              <OmniSelectorConsole zone={currentZoneId} />
            </motion.div>
          )}

          {/* CENTER: Zone page content — flex:1 */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname + (searchParams.get('tab') ?? '')}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: 'relative', zIndex: 1,
                  height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  willChange: 'opacity, transform',
                }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* RIGHT: AI Concierge — always 356px, Apple glass panel */}
          <aside
            style={{
              width:         356,
              flexShrink:    0,
              position:      'relative',
              zIndex:        2,
              marginInlineStart: 8,
              borderRadius:  20,
              background:    'rgba(255,255,255,0.88)',
              backdropFilter:'blur(56px) saturate(200%)',
              WebkitBackdropFilter: 'blur(56px) saturate(200%)',
              border:        '1px solid rgba(255,255,255,0.96)',
              boxShadow:     '0 8px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
            }}
          >
            {/* Specular top line */}
            <div aria-hidden style={{
              position: 'absolute', left: '6%', right: '6%', top: 0, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 35%, rgba(255,255,255,0.95) 65%, transparent)',
              zIndex: 4, borderRadius: 999, pointerEvents: 'none',
            }} />
            <ConciergePanel fitParent currentZone={rawZoneId || undefined} />
          </aside>

        </div>

      </div>
    </MotionConfig>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export default function ZoneLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ZoneLayoutInner>{children}</ZoneLayoutInner>
    </Suspense>
  );
}
