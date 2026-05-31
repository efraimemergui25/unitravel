'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useMotionValueEvent,
} from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTravelEngine } from '@/store/useTravelEngine';
import { FinancialEngine } from '@/utils/FinancialEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4 | 5;

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_VARIANTS = {
  enter:  (dir: 1 | -1) => ({ x: `${dir * 60}%`, opacity: 0, filter: 'blur(12px)', scale: 0.96 }),
  center: { x: '0%', opacity: 1, filter: 'blur(0px)', scale: 1 },
  exit:   (dir: 1 | -1) => ({ x: `${-dir * 60}%`, opacity: 0, filter: 'blur(12px)', scale: 0.96 }),
};

const PAGE_TRANSITION = { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.9 };

const CULINARY_OPTIONS = [
  { id: 'street',       icon: '🛒', labelKey: 'street',       color: '#30D158' },
  { id: 'local',        icon: '🍽',  labelKey: 'local',        color: '#00C7BE' },
  { id: 'contemporary', icon: '👨‍🍳', labelKey: 'contemporary', color: '#007AFF' },
  { id: 'fine-dining',  icon: '🥂',  labelKey: 'fineDining',   color: '#5E5CE6' },
  { id: 'michelin',     icon: '⭐',  labelKey: 'michelin',     color: '#FFD60A' },
] as const;

const BASECAMP_OPTIONS = [
  { id: 'boutique',     icon: '🏡', labelKey: 'boutique',    color: '#30D158', desc: 'Authentic, character-rich stays'   },
  { id: 'design-hotel', icon: '🏙',  labelKey: 'designHotel', color: '#007AFF', desc: 'Curated aesthetics, prime location' },
  { id: 'ultra-luxury', icon: '👑', labelKey: 'ultraLuxury', color: '#FFD60A', desc: 'Total immersion, zero compromise'   },
] as const;

const ACTIVITY_OPTIONS = [
  { id: 'adventure',   icon: '🧗', labelKey: 'adventure',   color: '#FF6B6B' },
  { id: 'culture',     icon: '🎨', labelKey: 'culture',     color: '#007AFF' },
  { id: 'wellness',    icon: '🧘', labelKey: 'wellness',    color: '#30D158' },
  { id: 'nightlife',   icon: '🌆', labelKey: 'nightlife',   color: '#5E5CE6' },
  { id: 'exploration', icon: '🔍', labelKey: 'exploration', color: '#00C7BE' },
] as const;

// ── Radar helpers ─────────────────────────────────────────────────────────────

const RADAR_ANGLES_DEG = [-90, -90 + 72, -90 + 144, -90 + 216, -90 + 288];
const RADAR_CENTER     = 100;
const RADAR_MAX_R      = 72;

function polarToXY(angleDeg: number, r: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [
    RADAR_CENTER + r * Math.cos(rad),
    RADAR_CENTER + r * Math.sin(rad),
  ];
}

function buildPolygonPoints(values: number[]): string {
  return RADAR_ANGLES_DEG.map((angle, i) => {
    const r = values[i] * RADAR_MAX_R;
    const [x, y] = polarToXY(angle, r);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function buildRefHexPoints(fraction: number): string {
  return RADAR_ANGLES_DEG.map(angle => {
    const r = fraction * RADAR_MAX_R;
    const [x, y] = polarToXY(angle, r);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

// ── Main component ────────────────────────────────────────────────────────────

export function NeuralOnboarding() {
  const { completeTravelDNA } = useTravelEngine();
  const t = useTranslations('DNA');

  // Step + direction state
  const [[step, direction], setStepState] = useState<[Step, 1 | -1]>([0, 1]);
  const goTo = useCallback((target: Step) => {
    setStepState(prev => [target, target > prev[0] ? 1 : -1]);
  }, []);

  // DNA draft state
  const [paceIndex,        setPaceIndex]    = useState(0.5);
  const [diningSelections, setDiningSelections] = useState<string[]>([]);
  const [basecampSelection, setBasecamp]    = useState<'boutique' | 'design-hotel' | 'ultra-luxury' | null>(null);
  const [activitySelections, setActivities] = useState<string[]>([]);

  // ── Step validation ──────────────────────────────────────────────────────────
  const canProceed =
    step === 1 ? true :
    step === 2 ? diningSelections.length > 0 :
    step === 3 ? basecampSelection !== null :
    step === 4 ? true :
    false;

  // ── Inner step components (closures over state) ───────────────────────────

  // ── Step 0 — Welcome ────────────────────────────────────────────────────────
  function StepInit() {
    const subtitle = t('initTitle');
    const letters = subtitle.split('');

    return (
      <div className="flex flex-col items-center gap-8 text-center">
        {/* Wordmark */}
        <motion.h1
          className="text-4xl font-black tracking-[0.12em] text-white uppercase"
          initial={{ letterSpacing: '0.6em', opacity: 0 }}
          animate={{ letterSpacing: '0.12em', opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          UNITRAVEL
        </motion.h1>

        {/* Subtitle with per-character stagger */}
        <div className="flex flex-wrap justify-center gap-0" aria-label={subtitle}>
          {letters.map((char, i) => (
            <motion.span
              key={i}
              className="text-[10px] font-black tracking-[0.2em] uppercase"
              style={{ color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 + i * 0.04, duration: 0.3 }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Scanning dot rows */}
        <div className="flex flex-col gap-2 w-full max-w-[240px]">
          {[
            { color: '#007AFF' },
            { color: '#5E5CE6' },
            { color: '#30D158' },
          ].map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1.5 justify-center">
              {Array.from({ length: 8 }).map((_, dotIdx) => (
                <motion.div
                  key={dotIdx}
                  className="w-[3px] h-[3px] rounded-full"
                  style={{ backgroundColor: row.color }}
                  animate={{ opacity: [0.1, 0.9, 0.1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: rowIdx * 0.3 + dotIdx * 0.2,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Begin button */}
        <motion.button
          className="px-10 py-3.5 rounded-full text-sm font-black tracking-[0.1em] uppercase text-white"
          style={{
            background: 'linear-gradient(135deg, #007AFF, #5E5CE6)',
            boxShadow: '0 0 40px rgba(0,122,255,0.35)',
          }}
          whileHover={{ scale: 1.04, boxShadow: '0 0 60px rgba(0,122,255,0.5)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => goTo(1)}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          {t('begin')}
        </motion.button>
      </div>
    );
  }

  // ── Step 1 — Pace Dial ───────────────────────────────────────────────────────
  function StepPace() {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragX    = useMotionValue(0);

    useEffect(() => {
      if (trackRef.current) {
        const w = trackRef.current.clientWidth - 48;
        dragX.set(paceIndex * w);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useMotionValueEvent(dragX, 'change', (v) => {
      if (trackRef.current) {
        const w = trackRef.current.clientWidth - 48;
        setPaceIndex(Math.max(0, Math.min(1, v / w)));
      }
    });

    const trackWidth = trackRef.current?.clientWidth ?? 300;
    const pillColor  = useTransform(dragX, [0, trackWidth - 48], ['#00C7BE', '#FFD60A']);

    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-white tracking-wide mb-1">
            {t('stepPace')}
          </h2>
          <p className="text-sm text-white/50">{t('paceQuestion')}</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Track */}
          <div
            ref={trackRef}
            className="relative w-full h-3 rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            {/* Gradient fill behind */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: 'linear-gradient(to right, #00C7BE, #5E5CE6, #FFD60A)' }}
            />
            {/* Pill */}
            <motion.div
              className="absolute top-1/2 w-12 h-12 rounded-full cursor-grab active:cursor-grabbing"
              style={{
                x: dragX,
                y: '-50%',
                background: pillColor,
                boxShadow: '0 0 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
              }}
              drag="x"
              dragConstraints={trackRef}
              dragMomentum={false}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95, cursor: 'grabbing' }}
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between">
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: '#00C7BE' }}
            >
              {t('agile')}
            </span>
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: '#FFD60A' }}
            >
              {t('luxury')}
            </span>
          </div>

          {/* Numeric display */}
          <motion.div
            className="text-center text-2xl font-black text-white/80 tabular-nums"
            key={Math.round(paceIndex * 100)}
            animate={{ opacity: [0, 1] }}
            transition={{ duration: 0.15 }}
          >
            {Math.round(paceIndex * 100)}%
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Step 2 — Culinary DNA ────────────────────────────────────────────────────
  function StepCulinary() {
    const toggleDining = (id: string) => {
      setDiningSelections(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-white tracking-wide mb-1">
            {t('stepCulinary')}
          </h2>
          <p className="text-sm text-white/50">{t('culinaryQuestion')}</p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {CULINARY_OPTIONS.map(opt => {
            const isSelected = diningSelections.includes(opt.id);
            return (
              <motion.div
                key={opt.id}
                onClick={() => toggleDining(opt.id)}
                animate={{ scale: isSelected ? 1.06 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="cursor-pointer"
                style={{ width: 128 }}
              >
                <GlassCard
                  variant={isSelected ? 'strong' : 'default'}
                  glow={isSelected
                    ? opt.color === '#30D158' ? 'emerald'
                    : opt.color === '#00C7BE' ? 'teal'
                    : opt.color === '#007AFF' ? 'blue'
                    : opt.color === '#5E5CE6' ? 'indigo'
                    : 'gold'
                    : 'none'
                  }
                  rounded="xl"
                  className="relative p-3 flex flex-col items-center gap-2 text-center select-none"
                  style={{ minHeight: 90 }}
                >
                  {/* Checkmark */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        className="absolute text-xs font-black text-white"
                        style={{ insetBlockStart: 8, insetInlineEnd: 8 }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        ✓
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-wide text-white/80 leading-tight">
                    {t(opt.labelKey as Parameters<typeof t>[0])}
                  </span>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 3 — Base Camp ───────────────────────────────────────────────────────
  function StepBasecamp() {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-white tracking-wide mb-1">
            {t('stepAccom')}
          </h2>
          <p className="text-sm text-white/50">{t('accomQuestion')}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          {BASECAMP_OPTIONS.map(opt => {
            const isSelected = basecampSelection === opt.id;
            return (
              <motion.div
                key={opt.id}
                onClick={() => setBasecamp(opt.id as typeof basecampSelection)}
                animate={{ scale: isSelected ? 1.02 : 1 }}
                whileHover={{ scale: isSelected ? 1.02 : 1.015 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-full max-w-xs cursor-pointer"
              >
                <GlassCard
                  variant={isSelected ? 'strong' : 'default'}
                  glow={isSelected
                    ? opt.color === '#30D158' ? 'emerald'
                    : opt.color === '#007AFF' ? 'blue'
                    : 'gold'
                    : 'none'
                  }
                  rounded="xl"
                  className="p-5 flex flex-row items-center gap-4 select-none"
                  style={isSelected ? { borderInlineStart: `3px solid ${opt.color}` } : {}}
                >
                  {/* Icon box */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${opt.color}22` }}
                  >
                    {opt.icon}
                  </div>
                  {/* Text */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-black text-white tracking-wide">
                      {t(opt.labelKey as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-[11px] text-white/45 leading-snug">
                      {opt.desc}
                    </span>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 4 — Activities ──────────────────────────────────────────────────────
  function StepActivities() {
    const toggleActivity = (id: string) => {
      setActivities(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-white tracking-wide mb-1">
            {t('stepActivities')}
          </h2>
          <p className="text-sm text-white/50">{t('activitiesQuestion')}</p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {ACTIVITY_OPTIONS.map(opt => {
            const isSelected = activitySelections.includes(opt.id);
            return (
              <motion.div
                key={opt.id}
                onClick={() => toggleActivity(opt.id)}
                animate={{ scale: isSelected ? 1.06 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="cursor-pointer"
                style={{ width: 128 }}
              >
                <GlassCard
                  variant={isSelected ? 'strong' : 'default'}
                  glow={isSelected
                    ? opt.color === '#30D158' ? 'emerald'
                    : opt.color === '#00C7BE' ? 'teal'
                    : opt.color === '#007AFF' ? 'blue'
                    : opt.color === '#5E5CE6' ? 'indigo'
                    : opt.color === '#FF6B6B' ? 'coral'
                    : 'none'
                    : 'none'
                  }
                  rounded="xl"
                  className="relative p-3 flex flex-col items-center gap-2 text-center select-none"
                  style={{ minHeight: 90 }}
                >
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        className="absolute text-xs font-black text-white"
                        style={{ insetBlockStart: 8, insetInlineEnd: 8 }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        ✓
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-wide text-white/80 leading-tight">
                    {t(opt.labelKey as Parameters<typeof t>[0])}
                  </span>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 5 — DNA Reveal ──────────────────────────────────────────────────────
  function StepReveal() {
    const finalDNA = FinancialEngine.deriveDNAFromSelections({
      paceIndex,
      diningSelections,
      basecampSelection: basecampSelection!,
      activitySelections,
    });

    const radarValues = [
      finalDNA.paceIndex,
      finalDNA.culinaryAffinity,
      finalDNA.accommodationTier,
      Math.min(1, finalDNA.experienceWeight),
      finalDNA.flexibilityScore,
    ];

    const zeroPoints  = '100,100 100,100 100,100 100,100 100,100';
    const finalPoints = buildPolygonPoints(radarValues);

    const optimalDaily = Math.round((42000 / 21) * (1 + paceIndex * 0.4));

    const handleActivate = () => {
      completeTravelDNA(finalDNA);
    };

    return (
      <div className="flex flex-col gap-6 items-center">
        <div className="text-center">
          <h2 className="text-xl font-black text-white tracking-widest mb-1 uppercase">
            {t('revealTitle')}
          </h2>
          <p className="text-sm text-white/50">{t('revealSub')}</p>
        </div>

        {/* Radar chart */}
        <svg
          viewBox="0 0 200 200"
          width={200}
          height={200}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="dna-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#007AFF" />
              <stop offset="50%"  stopColor="#5E5CE6" />
              <stop offset="100%" stopColor="#30D158" />
            </linearGradient>
          </defs>

          {/* Reference rings */}
          {[0.33, 0.66, 1.0].map(frac => (
            <polygon
              key={frac}
              points={buildRefHexPoints(frac)}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}

          {/* Axis lines */}
          {RADAR_ANGLES_DEG.map((angle, i) => {
            const [x, y] = polarToXY(angle, RADAR_MAX_R);
            return (
              <line
                key={i}
                x1={RADAR_CENTER} y1={RADAR_CENTER}
                x2={x} y2={y}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={1}
              />
            );
          })}

          {/* Axis labels */}
          {[
            t('stepPace'),
            t('stepCulinary'),
            t('stepAccom'),
            t('stepActivities'),
            'Flex',
          ].map((label, i) => {
            const [x, y] = polarToXY(RADAR_ANGLES_DEG[i], RADAR_MAX_R * 1.18);
            return (
              <text
                key={i}
                x={x} y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.45)"
                fontSize={7}
                fontWeight={700}
              >
                {label.length > 8 ? label.slice(0, 8) : label}
              </text>
            );
          })}

          {/* Glow fill polygon */}
          <motion.polygon
            points={zeroPoints}
            fill="url(#dna-gradient)"
            fillOpacity={0.20}
            stroke="none"
            animate={{ points: finalPoints }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />

          {/* Data polygon */}
          <motion.polygon
            points={zeroPoints}
            fill="none"
            stroke="url(#dna-gradient)"
            strokeWidth={2}
            animate={{ points: finalPoints }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>

        {/* Summary card */}
        <GlassCard
          variant="deep"
          rounded="xl"
          className="w-full p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 font-medium">
              {t('optimalDaily', { amount: `$${optimalDaily.toLocaleString()}` })}
            </span>
            {/* HENRY badge */}
            <motion.span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #FFD60A, #FF9F0A)',
                color: '#000',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 400, damping: 20 }}
            >
              {t('henryBadge')}
            </motion.span>
          </div>

          <div className="text-xs text-white/40">
            {t('curveLabel', { curve: finalDNA.spendingCurve })}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {activitySelections.map(id => {
              const opt = ACTIVITY_OPTIONS.find(o => o.id === id);
              return opt ? (
                <span
                  key={id}
                  className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${opt.color}22`, color: opt.color }}
                >
                  {opt.icon} {id}
                </span>
              ) : null;
            })}
          </div>
        </GlassCard>

        {/* Activate button */}
        <motion.div
          className="w-full"
          whileHover={{
            scale: 1.02,
            transition: { type: 'spring', stiffness: 400, damping: 20 },
          }}
        >
          <motion.button
            onClick={handleActivate}
            className="w-full py-4 rounded-2xl text-sm font-black tracking-[0.1em] uppercase text-white"
            style={{
              background: 'linear-gradient(135deg, #007AFF, #30D158)',
              boxShadow: '0 0 40px rgba(0,122,255,0.3)',
            }}
            whileHover={{ boxShadow: '0 0 60px rgba(0,122,255,0.5)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {t('activate')}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Navigation footer ────────────────────────────────────────────────────────
  function NavFooter() {
    const isLastDataStep = step === 4;
    const showBack       = step >= 2 && step <= 4;

    return (
      <div className="flex flex-col items-center gap-4 pb-8 pt-2">
        {/* Step dots (steps 1–4) */}
        <div className="flex gap-2">
          {([1, 2, 3, 4] as Step[]).map(s => (
            <motion.div
              key={s}
              className="rounded-full"
              animate={{
                width:           s === step ? 20 : 6,
                height:          6,
                backgroundColor: s === step ? '#007AFF' : 'rgba(255,255,255,0.2)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            />
          ))}
        </div>

        {/* Buttons row */}
        <div className="flex gap-3 items-center">
          {showBack && (
            <motion.button
              onClick={() => goTo((step - 1) as Step)}
              className="px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest text-white/60"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {t('back')}
            </motion.button>
          )}

          <motion.button
            onClick={() => goTo((step + 1) as Step)}
            disabled={!canProceed}
            className="px-8 py-2.5 rounded-full text-xs font-black uppercase tracking-widest text-white"
            style={{
              background: canProceed
                ? 'linear-gradient(135deg, #007AFF, #5E5CE6)'
                : 'rgba(255,255,255,0.08)',
              boxShadow: canProceed ? '0 0 30px rgba(0,122,255,0.3)' : 'none',
              opacity: canProceed ? 1 : 0.4,
            }}
            whileHover={canProceed ? { scale: 1.04, boxShadow: '0 0 40px rgba(0,122,255,0.5)' } : {}}
            whileTap={canProceed ? { scale: 0.97 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {isLastDataStep ? t('revealTitle') : t('next')}
          </motion.button>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'rgba(8,11,20,0.96)', backdropFilter: 'blur(64px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: 'blur(16px)' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={PAGE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={PAGE_TRANSITION}
          className="w-full max-w-lg px-6 flex flex-col gap-6"
        >
          {step === 0 && <StepInit />}
          {step === 1 && <StepPace />}
          {step === 2 && <StepCulinary />}
          {step === 3 && <StepBasecamp />}
          {step === 4 && <StepActivities />}
          {step === 5 && <StepReveal />}
        </motion.div>
      </AnimatePresence>

      {/* Navigation footer for steps 1–4 */}
      {step >= 1 && step <= 4 && <NavFooter />}
    </motion.div>
  );
}
