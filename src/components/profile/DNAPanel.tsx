'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useUserDNA }              from '@/store/useUserDNA';
import { useLocaleEngine }         from '@/store/useLocaleEngine';
import type { UserDNAProfile, DNATrait } from '@/store/useUserDNA';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 400, damping: 30 } as const;
const SPRING_POP = { type: 'spring', stiffness: 480, damping: 24 } as const;

// ── Tag colors per trait category ─────────────────────────────────────────────

const TRAIT_COLOR: Partial<Record<DNATrait, string>> = {
  preferredAirlines:    '#007AFF',
  bannedAirlines:       '#FF453A',
  budgetTier:           '#FF9F0A',
  dietaryRestrictions:  '#30D158',
  maxLayoverHours:      '#5E5CE6',
  interests:            '#BF5AF2',
  seatPreference:       '#00C7BE',
  partyType:            '#FF2D55',
  tripPace:             '#FF9F0A',
  loyaltyPrograms:      '#007AFF',
  homeCurrency:         '#6E6E73',
};

const TRAIT_LABEL: Partial<Record<DNATrait, string>> = {
  preferredAirlines:    'Preferred Airlines',
  bannedAirlines:       'Banned Airlines',
  budgetTier:           'Budget Tier',
  dietaryRestrictions:  'Dietary',
  maxLayoverHours:      'Max Layover',
  interests:            'Interests',
  seatPreference:       'Seat',
  partyType:            'Traveler Type',
  tripPace:             'Trip Pace',
  loyaltyPrograms:      'Loyalty Programs',
  homeCurrency:         'Currency',
  budgetRange:          'Budget',
  flightPref:           'Flight Pref',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function GlassTag({ label, color, onRemove }: {
  label:    string;
  color:    string;
  onRemove: () => void;
}) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={SPRING_POP}
      // ── Dictated tag CSS ──────────────────────────────────────────────────
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/50 border border-white/80 shadow-sm text-sm font-medium text-slate-700"
      style={{
        backdropFilter:       'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        userSelect:           'none',
        flexShrink:           0,
      }}
    >
      {/* Per-trait color dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, boxShadow: `0 0 4px ${color}88`,
        flexShrink: 0,
      }} />
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, lineHeight: 1, color: 'rgba(100,116,139,0.5)',
          fontSize: 14, fontFamily: 'inherit', marginInlineStart: 2,
        }}
      >
        ×
      </button>
    </motion.span>
  );
}

function TraitSection({ trait, label, tags, color, onRemoveTag }: {
  trait:       DNATrait;
  label:       string;
  tags:        string[];
  color:       string;
  onRemoveTag: (trait: DNATrait, value: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <motion.div layout style={{ marginBlockEnd: 16 }}>
      <p style={{
        fontSize: 9.5, fontWeight: 800, color: '#6E6E73',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBlockEnd: 6, fontFamily: 'inherit',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <AnimatePresence>
          {tags.map(tag => (
            <GlassTag
              key={tag}
              label={tag}
              color={color}
              onRemove={() => onRemoveTag(trait, tag)}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Panel close button ────────────────────────────────────────────────────────

function CloseButton({ onClose, isRtl }: { onClose: () => void; isRtl: boolean }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close DNA panel"
      style={{
        position:  'absolute',
        insetBlockStart:  20,
        insetInlineEnd:   20,
        width: 28, height: 28,
        borderRadius: 8,
        background:   'rgba(0,0,0,0.06)',
        border:       '1px solid rgba(0,0,0,0.07)',
        cursor:       'pointer',
        display:      'flex', alignItems: 'center', justifyContent: 'center',
        fontSize:     14, color: '#6E6E73',
        fontFamily:   'inherit',
      }}
    >
      ×
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DNAPanelProps {
  isOpen:   boolean;
  onClose:  () => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DNAPanel({ isOpen, onClose }: DNAPanelProps) {
  const { profile, mutateDNA, reset } = useUserDNA();
  const { profile: locProfile } = useLocaleEngine();
  const isRtl = locProfile.direction === 'rtl';

  // Remove a single tag from an array trait
  const handleRemoveTag = (trait: DNATrait, value: string) => {
    const current = profile[trait];
    if (Array.isArray(current)) {
      mutateDNA(trait, (current as string[]).filter(v => v !== value) as UserDNAProfile[DNATrait]);
    }
  };

  // Scalar to tag helper
  const scalar = (val: string | null | number | undefined, suffix = ''): string[] =>
    val !== null && val !== undefined ? [`${val}${suffix}`] : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="dna-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position:   'fixed', inset: 0, zIndex: 49,
              background: 'rgba(0,0,0,0.08)',
            }}
          />

          {/* Panel — dictated CSS */}
          <motion.aside
            key="dna-panel"
            initial={{ x: isRtl ? '-100%' : '100%', opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isRtl ? '-100%' : '100%', opacity: 0.85 }}
            transition={SPRING}
            // border-s = border-inline-start (left in LTR, right in RTL — always the inner edge)
            className="fixed top-0 h-full w-96 bg-white/40 backdrop-blur-3xl border-s border-white/60 p-8"
            style={{
              insetInlineEnd:  0,
              insetBlockStart: 0,
              zIndex:          100,
              overflowY:       'auto',
              overscrollBehavior: 'contain',
              direction:       isRtl ? 'rtl' : 'ltr',
              // dictated shadow
              boxShadow:       isRtl
                ? '20px 0 50px rgba(0,0,0,0.05)'
                : '-20px 0 50px rgba(0,0,0,0.05)',
            }}
            role="complementary"
            aria-label="Travel DNA Profile"
          >
            <CloseButton onClose={onClose} isRtl={isRtl} />

            {/* Header — glowing avatar + title */}
            <div style={{ marginBlockEnd: 28 }}>

              {/* Glowing avatar placeholder */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...SPRING, delay: 0.05 }}
                style={{ position: 'relative', width: 56, height: 56, marginBlockEnd: 16 }}
              >
                {/* Outer glow ring — pulses */}
                <motion.div
                  animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.65, 0.35] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', inset: -6,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,122,255,0.22) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
                {/* Avatar circle */}
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #007AFF 0%, #BF5AF2 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                  boxShadow: '0 4px 20px rgba(0,122,255,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
                  border: '2px solid rgba(255,255,255,0.6)',
                  position: 'relative',
                }}>
                  🧬
                </div>
              </motion.div>

              <h2 style={{
                margin: 0, fontSize: 18, fontWeight: 900,
                color: 'var(--text-primary)', letterSpacing: '-0.04em',
                fontFamily: 'inherit',
              }}>
                Travel DNA
              </h2>
              <p style={{
                margin: 0, marginBlockStart: 4,
                fontSize: 11, color: '#6E6E73', fontWeight: 500,
                fontFamily: 'inherit', lineHeight: 1.5,
              }}>
                What the AI has learned about you across conversations.
              </p>
            </div>

            {/* Traits */}
            <motion.div layout>
              <TraitSection
                trait="budgetTier"
                label={TRAIT_LABEL.budgetTier!}
                tags={scalar(profile.budgetTier)}
                color={TRAIT_COLOR.budgetTier!}
                onRemoveTag={handleRemoveTag}
              />
              <TraitSection
                trait="partyType"
                label={TRAIT_LABEL.partyType!}
                tags={scalar(profile.partyType)}
                color={TRAIT_COLOR.partyType!}
                onRemoveTag={handleRemoveTag}
              />
              <TraitSection
                trait="tripPace"
                label={TRAIT_LABEL.tripPace!}
                tags={scalar(profile.tripPace)}
                color={TRAIT_COLOR.tripPace!}
                onRemoveTag={handleRemoveTag}
              />
              <TraitSection
                trait="seatPreference"
                label={TRAIT_LABEL.seatPreference!}
                tags={scalar(profile.seatPreference)}
                color={TRAIT_COLOR.seatPreference!}
                onRemoveTag={handleRemoveTag}
              />
              <TraitSection
                trait="maxLayoverHours"
                label={TRAIT_LABEL.maxLayoverHours!}
                tags={profile.maxLayoverHours !== null
                  ? [profile.maxLayoverHours === 0 ? 'Non-stop only' : `≤ ${profile.maxLayoverHours}h`]
                  : []}
                color={TRAIT_COLOR.maxLayoverHours!}
                onRemoveTag={() => mutateDNA('maxLayoverHours', null)}
              />
              <TraitSection
                trait="preferredAirlines"
                label={TRAIT_LABEL.preferredAirlines!}
                tags={profile.preferredAirlines}
                color={TRAIT_COLOR.preferredAirlines!}
                onRemoveTag={handleRemoveTag}
              />
              <TraitSection
                trait="bannedAirlines"
                label={TRAIT_LABEL.bannedAirlines!}
                tags={profile.bannedAirlines}
                color={TRAIT_COLOR.bannedAirlines!}
                onRemoveTag={handleRemoveTag}
              />
              <TraitSection
                trait="dietaryRestrictions"
                label={TRAIT_LABEL.dietaryRestrictions!}
                tags={profile.dietaryRestrictions}
                color={TRAIT_COLOR.dietaryRestrictions!}
                onRemoveTag={handleRemoveTag}
              />
              <TraitSection
                trait="interests"
                label={TRAIT_LABEL.interests!}
                tags={profile.interests}
                color={TRAIT_COLOR.interests!}
                onRemoveTag={handleRemoveTag}
              />
              <TraitSection
                trait="loyaltyPrograms"
                label={TRAIT_LABEL.loyaltyPrograms!}
                tags={profile.loyaltyPrograms}
                color={TRAIT_COLOR.loyaltyPrograms!}
                onRemoveTag={handleRemoveTag}
              />
            </motion.div>

            {/* Empty state */}
            {Object.values({
              a: profile.budgetTier,
              b: profile.partyType,
              c: profile.tripPace,
              d: profile.bannedAirlines.length,
              e: profile.preferredAirlines.length,
              f: profile.dietaryRestrictions.length,
              g: profile.interests.length,
            }).every(v => !v) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  textAlign:   'center',
                  paddingBlock: 40,
                  color:        '#6E6E73',
                }}
              >
                <div style={{ fontSize: 32, marginBlockEnd: 8 }}>🌱</div>
                <p style={{ fontSize: 12, fontWeight: 600, margin: 0, fontFamily: 'inherit' }}>
                  Start chatting with the AI concierge.
                </p>
                <p style={{ fontSize: 11, fontWeight: 400, margin: 0, marginBlockStart: 4, fontFamily: 'inherit' }}>
                  Your preferences will appear here as the AI learns about you.
                </p>
              </motion.div>
            )}

            {/* Reset */}
            {(profile.bannedAirlines.length > 0 ||
              profile.preferredAirlines.length > 0 ||
              profile.dietaryRestrictions.length > 0) && (
              <motion.button
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={reset}
                style={{
                  marginBlockStart: 24, width: '100%',
                  paddingBlock: 10,
                  borderRadius: 12,
                  border: '1px solid rgba(255,69,58,0.25)',
                  background: 'rgba(255,69,58,0.06)',
                  color: '#FF453A',
                  fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  letterSpacing: '-0.01em',
                }}
              >
                Reset DNA Profile
              </motion.button>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
