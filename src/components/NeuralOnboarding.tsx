'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTravelEngine } from '@/store/useTravelEngine';
import { FinancialEngine } from '@/utils/FinancialEngine';
import { useLocaleEngine } from '@/store/useLocaleEngine';

// ── Spring presets ─────────────────────────────────────────────────────────────

const SP  = { type: 'spring', stiffness: 380, damping: 30 } as const;
const SPP = { type: 'spring', stiffness: 460, damping: 24 } as const;

// ── Step types ────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

interface OnboardingState {
  paceIndex:          number;          // 0 (slow) – 1 (fast)
  diningSelections:   string[];
  basecampSelection:  'boutique' | 'design-hotel' | 'ultra-luxury';
  activitySelections: string[];
  tripTitle:          string;
  destination:        string;
  travelers:          number;
  budget:             number;
}

const DEFAULT: OnboardingState = {
  paceIndex:          0.5,
  diningSelections:   [],
  basecampSelection:  'design-hotel',
  activitySelections: [],
  tripTitle:          '',
  destination:        '',
  travelers:          2,
  budget:             5000,
};

// ── Step configs ───────────────────────────────────────────────────────────────

const PACE_OPTIONS = [
  {
    value: 0.15,
    label: 'Slow & Deep',
    sub: 'Linger, wander, absorb — quality over quantity',
    icon: '🌙',
    color: '#5E5CE6',
  },
  {
    value: 0.5,
    label: 'Balanced',
    sub: 'Mix of exploration and relaxation',
    icon: '⚖️',
    color: '#007AFF',
  },
  {
    value: 0.85,
    label: 'Full Throttle',
    sub: 'Every hour counts — maximize every day',
    icon: '⚡',
    color: '#FF9F0A',
  },
];

const DINING_OPTIONS = [
  { id: 'michelin',     label: 'Michelin Stars',    sub: 'Fine gastronomy, tasting menus', icon: '⭐', color: '#FF453A' },
  { id: 'fine-dining',  label: 'Fine Dining',        sub: 'Premium restaurants, curated wine', icon: '🍷', color: '#BF5AF2' },
  { id: 'contemporary', label: 'Contemporary',       sub: 'Creative chefs, modern concepts', icon: '🔥', color: '#FF9F0A' },
  { id: 'local',        label: 'Local & Authentic',  sub: 'Street food, hidden gems', icon: '🌮', color: '#30D158' },
];

const BASECAMP_OPTIONS = [
  {
    id: 'boutique' as const,
    label: 'Boutique Character',
    sub: 'Soul, story, curated personality',
    icon: '🏡',
    color: '#30D158',
  },
  {
    id: 'design-hotel' as const,
    label: 'Design Forward',
    sub: 'Architecture, art, elevated aesthetics',
    icon: '🏛️',
    color: '#007AFF',
  },
  {
    id: 'ultra-luxury' as const,
    label: 'Ultra-Luxury',
    sub: 'Rosewood, Four Seasons — no compromises',
    icon: '👑',
    color: '#FF9F0A',
  },
];

const ACTIVITY_OPTIONS = [
  { id: 'culture',    label: 'Culture & Art',    sub: 'Museums, galleries, heritage', icon: '🎭', color: '#5E5CE6' },
  { id: 'adventure',  label: 'Adventure',         sub: 'Hiking, diving, extreme sports', icon: '🧗', color: '#30D158' },
  { id: 'wellness',   label: 'Wellness',          sub: 'Spa, yoga, mindfulness retreats', icon: '🧘', color: '#00C7BE' },
  { id: 'nightlife',  label: 'Nightlife',         sub: 'Cocktail bars, rooftops, clubs', icon: '🌃', color: '#BF5AF2' },
  { id: 'culinary',   label: 'Culinary Tours',    sub: 'Markets, cooking classes, tastings', icon: '🍜', color: '#FF9F0A' },
  { id: 'nature',     label: 'Nature & Wildlife', sub: 'Safaris, parks, scenic landscapes', icon: '🌿', color: '#34C759' },
];

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: Step; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width:   i + 1 === step ? 22 : 6,
            background: i + 1 <= step ? '#007AFF' : 'rgba(0,0,0,0.12)',
          }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: 6, borderRadius: 3 }}
        />
      ))}
    </div>
  );
}

// ── Option card ────────────────────────────────────────────────────────────────

function OptionCard({
  icon, label, sub, color, selected, onClick, multiSelect,
}: {
  icon: string; label: string; sub: string; color: string;
  selected: boolean; onClick: () => void; multiSelect?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.025, y: -2 }}
      whileTap={{ scale: 0.97 }}
      animate={{
        background:   selected ? `${color}14` : 'rgba(0,0,0,0.03)',
        borderColor:  selected ? `${color}55` : 'rgba(0,0,0,0.08)',
        boxShadow:    selected ? `0 0 0 1.5px ${color}44, 0 6px 24px ${color}1A` : '0 1px 4px rgba(0,0,0,0.05)',
      }}
      transition={{ duration: 0.2 }}
      style={{
        width: '100%', padding: '14px 16px',
        borderRadius: 16, border: '1.5px solid',
        cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 14,
        fontFamily: 'inherit', position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: selected ? `${color}18` : 'rgba(0,0,0,0.05)',
        border: `1px solid ${selected ? color + '30' : 'rgba(0,0,0,0.07)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 19, transition: 'all 0.2s',
      }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.02em',
          color: selected ? color : '#1D1D1F', lineHeight: 1.2,
          transition: 'color 0.2s',
        }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 2, lineHeight: 1.35 }}>
          {sub}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPP}
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: `0 3px 10px ${color}44`,
            }}
          >
            <span style={{ color: 'white', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Budget slider ─────────────────────────────────────────────────────────────

const BUDGET_PRESETS = [
  { label: 'Budget',  value: 1500,  color: '#30D158', sub: 'Hostels, local food, free sights' },
  { label: 'Mid',     value: 4000,  color: '#007AFF', sub: '4-star hotels, restaurants' },
  { label: 'Luxury',  value: 10000, color: '#FF9F0A', sub: '5-star resorts, fine dining' },
  { label: 'No Limit',value: 25000, color: '#FF453A', sub: 'Ultra-luxury, private transfers' },
];

// ── Main component ─────────────────────────────────────────────────────────────

export function NeuralOnboarding({ onClose }: { onClose?: () => void }) {
  const [step,  setStep]  = useState<Step>(1);
  const [state, setState] = useState<OnboardingState>(DEFAULT);
  const [exiting, setExiting] = useState(false);

  const completeTravelDNA = useTravelEngine(s => s.completeTravelDNA);
  const setupTrip         = useTravelEngine(s => s.setupTrip);
  const router            = useRouter();
  const { profile }       = useLocaleEngine();
  const isHe = profile.locale === 'he-IL';

  const update = useCallback(<K extends keyof OnboardingState>(key: K, val: OnboardingState[K]) => {
    setState(prev => ({ ...prev, [key]: val }));
  }, []);

  const toggleDining = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      diningSelections: prev.diningSelections.includes(id)
        ? prev.diningSelections.filter(d => d !== id)
        : [...prev.diningSelections, id],
    }));
  }, []);

  const toggleActivity = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      activitySelections: prev.activitySelections.includes(id)
        ? prev.activitySelections.filter(a => a !== id)
        : [...prev.activitySelections, id],
    }));
  }, []);

  const canAdvance = useCallback((): boolean => {
    if (step === 2 && state.diningSelections.length === 0) return false;
    if (step === 4 && state.activitySelections.length === 0) return false;
    if (step === 5 && !state.destination.trim())            return false;
    return true;
  }, [step, state]);

  const handleFinish = useCallback(() => {
    const dna = FinancialEngine.deriveDNAFromSelections({
      paceIndex:          state.paceIndex,
      diningSelections:   state.diningSelections,
      basecampSelection:  state.basecampSelection,
      activitySelections: state.activitySelections,
    });
    completeTravelDNA(dna);
    const today     = new Date();
    const startDate = new Date(today); startDate.setDate(today.getDate() + 14);
    const endDate   = new Date(startDate); endDate.setDate(startDate.getDate() + 7);
    const fmt       = (d: Date) => d.toISOString().split('T')[0];
    setupTrip({
      title:       state.tripTitle || `Trip to ${state.destination || 'Anywhere'}`,
      travelers:   Array.from({ length: state.travelers }, (_, i) => `Traveler ${i + 1}`),
      startDate:   fmt(startDate),
      endDate:     fmt(endDate),
      nights:      7,
      totalBudget: state.budget,
    });
    setExiting(true);
    setTimeout(() => {
      onClose?.();
      router.push('/zone/management');
    }, 600);
  }, [state, completeTravelDNA, setupTrip, router, onClose]);

  const next = useCallback(() => {
    if (!canAdvance()) return;
    if (step === 5) { handleFinish(); return; }
    setStep(s => (s + 1) as Step);
  }, [step, canAdvance, handleFinish]);

  const back = useCallback(() => {
    if (step > 1) setStep(s => (s - 1) as Step);
  }, [step]);

  const STEP_META = [
    { title: isHe ? 'קצב הטיול שלך' : 'Your Travel Pace',    sub: isHe ? 'איך אתה אוהב לנסוע?' : 'How do you like to travel?' },
    { title: isHe ? 'חוויות אוכל'   : 'Dining Philosophy',    sub: isHe ? 'מה חשוב לך?'       : 'What dining experiences matter?' },
    { title: isHe ? 'הבסיס שלך'     : 'Your Basecamp',        sub: isHe ? 'היכן תישן?'         : 'Where do you recharge?' },
    { title: isHe ? 'מה תעשה?'       : 'Your Activities',      sub: isHe ? 'בחר הכל שרלוונטי'  : 'Select all that resonate' },
    { title: isHe ? 'הטיול שלך'     : 'Build Your Trip',       sub: isHe ? 'כמה פרטים אחרונים' : 'A few final details' },
  ];

  const meta = STEP_META[step - 1];

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.38)',
            backdropFilter: 'blur(28px) saturate(140%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.90, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={SP}
            style={{
              width: '100%', maxWidth: 540,
              borderRadius: 28,
              background: 'rgba(255,255,255,0.94)',
              backdropFilter: 'blur(64px) saturate(200%)',
              WebkitBackdropFilter: 'blur(64px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.98)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,1)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Specular top line */}
            <div aria-hidden style={{
              position: 'absolute', left: '6%', right: '6%', top: 0, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 35%, rgba(255,255,255,1) 65%, transparent)',
              zIndex: 4,
            }} />

            {/* Ambient glow */}
            <div aria-hidden style={{
              position: 'absolute', top: -80, left: '25%', right: '25%', height: 160,
              background: 'radial-gradient(ellipse, rgba(0,122,255,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            {/* ── Header ─────────────────────────────────────────────── */}
            <div style={{ padding: '28px 32px 20px', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <ProgressDots step={step} total={5} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
                  {step} / 5
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div style={{
                    fontSize: 22, fontWeight: 900, letterSpacing: '-0.035em',
                    color: '#1D1D1F', lineHeight: 1.15, marginBottom: 5,
                  }}>
                    {meta.title}
                  </div>
                  <div style={{ fontSize: 13, color: '#6E6E73', fontWeight: 500 }}>
                    {meta.sub}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Step content ────────────────────────────────────────── */}
            <div style={{
              padding: '0 32px 24px',
              maxHeight: 360, overflowY: 'auto',
              scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.06) transparent',
              position: 'relative', zIndex: 1,
            }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {/* Step 1 — Pace */}
                  {step === 1 && PACE_OPTIONS.map(opt => (
                    <OptionCard
                      key={opt.value}
                      icon={opt.icon} label={opt.label} sub={opt.sub} color={opt.color}
                      selected={state.paceIndex === opt.value}
                      onClick={() => update('paceIndex', opt.value)}
                    />
                  ))}

                  {/* Step 2 — Dining */}
                  {step === 2 && DINING_OPTIONS.map(opt => (
                    <OptionCard
                      key={opt.id}
                      icon={opt.icon} label={opt.label} sub={opt.sub} color={opt.color}
                      selected={state.diningSelections.includes(opt.id)}
                      onClick={() => toggleDining(opt.id)}
                      multiSelect
                    />
                  ))}

                  {/* Step 3 — Basecamp */}
                  {step === 3 && BASECAMP_OPTIONS.map(opt => (
                    <OptionCard
                      key={opt.id}
                      icon={opt.icon} label={opt.label} sub={opt.sub} color={opt.color}
                      selected={state.basecampSelection === opt.id}
                      onClick={() => update('basecampSelection', opt.id)}
                    />
                  ))}

                  {/* Step 4 — Activities */}
                  {step === 4 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {ACTIVITY_OPTIONS.map(opt => (
                        <OptionCard
                          key={opt.id}
                          icon={opt.icon} label={opt.label} sub={opt.sub} color={opt.color}
                          selected={state.activitySelections.includes(opt.id)}
                          onClick={() => toggleActivity(opt.id)}
                          multiSelect
                        />
                      ))}
                    </div>
                  )}

                  {/* Step 5 — Trip details */}
                  {step === 5 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Destination */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                          {isHe ? 'יעד' : 'Destination'}
                        </label>
                        <input
                          autoFocus
                          value={state.destination}
                          onChange={e => update('destination', e.target.value)}
                          placeholder={isHe ? 'לאן אתה נוסע?' : 'Where are you going?'}
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 12,
                            background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.08)',
                            fontSize: 14, fontWeight: 600, color: '#1D1D1F',
                            outline: 'none', fontFamily: 'inherit',
                            boxSizing: 'border-box',
                          }}
                          onFocus={e => { e.target.style.borderColor = 'rgba(0,122,255,0.40)'; e.target.style.background = 'rgba(0,122,255,0.04)'; }}
                          onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.background = 'rgba(0,0,0,0.04)'; }}
                        />
                      </div>

                      {/* Travelers */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                          {isHe ? 'מטיילים' : 'Travelers'}
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[1, 2, 3, 4, 5, 6].map(n => (
                            <motion.button
                              key={n}
                              onClick={() => update('travelers', n)}
                              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                              animate={{
                                background: state.travelers === n ? 'rgba(0,122,255,0.12)' : 'rgba(0,0,0,0.04)',
                                borderColor: state.travelers === n ? 'rgba(0,122,255,0.40)' : 'rgba(0,0,0,0.08)',
                                color: state.travelers === n ? '#007AFF' : '#3C3C43',
                              }}
                              style={{
                                width: 40, height: 40, borderRadius: 10, border: '1.5px solid',
                                cursor: 'pointer', fontFamily: 'inherit',
                                fontSize: 14, fontWeight: 700,
                              }}
                            >
                              {n}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Budget */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                          {isHe ? 'תקציב' : 'Total Budget'}
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {BUDGET_PRESETS.map(bp => (
                            <motion.button
                              key={bp.value}
                              onClick={() => update('budget', bp.value)}
                              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                              animate={{
                                background: state.budget === bp.value ? `${bp.color}14` : 'rgba(0,0,0,0.04)',
                                borderColor: state.budget === bp.value ? `${bp.color}44` : 'rgba(0,0,0,0.08)',
                              }}
                              style={{
                                flex: 1, minWidth: 80, padding: '10px 12px', borderRadius: 12,
                                border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit',
                                textAlign: 'left',
                              }}
                            >
                              <div style={{ fontSize: 11, fontWeight: 800, color: state.budget === bp.value ? bp.color : '#1D1D1F' }}>
                                {bp.label}
                              </div>
                              <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>
                                ${bp.value.toLocaleString()}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Footer ─────────────────────────────────────────────── */}
            <div style={{
              padding: '16px 32px 28px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderTop: '1px solid rgba(0,0,0,0.045)',
              position: 'relative', zIndex: 1,
              background: 'linear-gradient(0deg, rgba(255,255,255,0.60) 0%, transparent 100%)',
            }}>
              {step > 1 && (
                <motion.button
                  onClick={back}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{
                    padding: '11px 22px', borderRadius: 12,
                    background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)',
                    fontSize: 13, fontWeight: 700, color: '#3C3C43',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {isHe ? 'חזרה' : 'Back'}
                </motion.button>
              )}

              {step === 1 && (
                <motion.button
                  onClick={() => onClose?.()}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{
                    padding: '11px 22px', borderRadius: 12,
                    background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)',
                    fontSize: 13, fontWeight: 700, color: '#8E8E93',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {isHe ? 'דלג' : 'Skip'}
                </motion.button>
              )}

              <div style={{ flex: 1 }} />

              <motion.button
                onClick={next}
                disabled={!canAdvance()}
                whileHover={canAdvance() ? { scale: 1.04, boxShadow: '0 8px 28px rgba(0,122,255,0.40)' } : {}}
                whileTap={canAdvance() ? { scale: 0.97 } : {}}
                animate={{ opacity: canAdvance() ? 1 : 0.42 }}
                style={{
                  padding: '12px 30px', borderRadius: 14, border: 'none',
                  background: 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
                  color: 'white', fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em',
                  cursor: canAdvance() ? 'pointer' : 'default',
                  boxShadow: '0 4px 18px rgba(0,122,255,0.34), inset 0 1px 0 rgba(255,255,255,0.22)',
                  fontFamily: 'inherit', transition: 'box-shadow 0.2s',
                }}
              >
                {step === 5
                  ? (isHe ? 'בוא נתחיל ✦' : 'Build My Trip ✦')
                  : (isHe ? 'הבא →' : 'Next →')}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
