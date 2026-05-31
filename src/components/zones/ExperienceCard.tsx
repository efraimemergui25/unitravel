'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { AttractionEntity, ExperienceType, WeatherMatch } from '@/types/attractions';

const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

// ── Type badge colors ─────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ExperienceType, { bg: string; fg: string; label: string }> = {
  cultural:  { bg: '#5E5CE618', fg: '#5E5CE6', label: 'Cultural'  },
  outdoor:   { bg: '#30D15818', fg: '#30D158', label: 'Outdoor'   },
  culinary:  { bg: '#FF9F0A18', fg: '#FF9F0A', label: 'Culinary'  },
  adventure: { bg: '#FF453A18', fg: '#FF453A', label: 'Adventure' },
  wellness:  { bg: '#00C7BE18', fg: '#00C7BE', label: 'Wellness'  },
};

// ── Weather badge ─────────────────────────────────────────────────────────────

const WeatherBadge = memo(function WeatherBadge({ match }: { match: WeatherMatch }) {
  const isPerfect = match.quality === 'perfect';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: 8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={SPRING}
    >
      <motion.div
        animate={isPerfect ? {
          boxShadow: [
            '0 0 0px rgba(255,159,10,0)',
            '0 0 14px rgba(255,159,10,0.7)',
            '0 0 0px rgba(255,159,10,0)',
          ],
        } : undefined}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             4,
          paddingBlock:    4,
          paddingInline:   8,
          borderRadius:    9,
          background:      isPerfect
            ? 'linear-gradient(135deg, rgba(255,159,10,0.92), rgba(255,214,10,0.88))'
            : 'linear-gradient(135deg, rgba(48,209,88,0.88), rgba(0,199,190,0.82))',
          backdropFilter:  'blur(12px)',
          border:          `1px solid ${isPerfect ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.25)'}`,
        }}
      >
        {isPerfect && (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            style={{ fontSize: 8, display: 'inline-block' }}
          >
            ✦
          </motion.span>
        )}
        <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>
          {isPerfect ? `Perfect · ${match.dayLabel}` : `${match.dayLabel}`}
        </span>
        <span style={{ fontSize: 9 }}>{match.icon}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
          {match.tempC}°C
        </span>
      </motion.div>
    </motion.div>
  );
});

// ── Provider dots ─────────────────────────────────────────────────────────────

const ProviderDots = memo(function ProviderDots({ providers }: { providers: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {providers.slice(0, 5).map((p, i) => (
        <div
          key={p}
          title={p}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: `hsl(${(i * 67 + 200) % 360}, 65%, 55%)`,
            flexShrink: 0,
          }}
        />
      ))}
      {providers.length > 5 && (
        <span style={{ fontSize: 8, color: '#8E8E93' }}>+{providers.length - 5}</span>
      )}
      <span style={{ fontSize: 9, color: '#AEAEB2', marginLeft: 2 }}>
        {providers.length} platform{providers.length !== 1 ? 's' : ''}
      </span>
    </div>
  );
});

// ── Difficulty pill ───────────────────────────────────────────────────────────

const DIFF_STYLE: Record<string, { color: string }> = {
  easy:        { color: '#30D158' },
  moderate:    { color: '#FF9F0A' },
  challenging: { color: '#FF453A' },
};

// ── ExperienceCard ────────────────────────────────────────────────────────────

export const ExperienceCard = memo(function ExperienceCard({
  entity, index,
}: {
  entity: AttractionEntity;
  index:  number;
}) {
  const typeStyle = TYPE_COLORS[entity.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: index * 0.06 }}
      style={{
        background:          'rgba(255,255,255,0.84)',
        backdropFilter:      'blur(32px) saturate(1.8)',
        WebkitBackdropFilter:'blur(32px) saturate(1.8)',
        borderRadius:        16,
        border:              '1px solid rgba(255,255,255,0.72)',
        boxShadow:           '0 2px 14px rgba(0,0,0,0.06)',
        overflow:            'hidden',
        display:             'flex',
        flexDirection:       'column',
      }}
    >
      {/* Gradient image area */}
      <div style={{ position: 'relative', height: 86, background: entity.gradient, flexShrink: 0 }}>
        {/* Overlay shimmer */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.35) 100%)' }} />

        {/* Type badge (bottom-left of image) */}
        <div style={{
          position:     'absolute', insetBlockEnd: 8, insetInlineStart: 10,
          background:   typeStyle.bg, border: `1px solid ${typeStyle.fg}40`,
          borderRadius: 6, paddingBlock: 2, paddingInline: 7,
          backdropFilter: 'blur(8px)',
          fontSize: 9, fontWeight: 700, color: typeStyle.fg,
        }}>
          {typeStyle.label}
        </div>

        {/* Weather badge (top-right) */}
        {entity.weatherMatch && (entity.weatherMatch.quality === 'perfect' || entity.weatherMatch.quality === 'good') && (
          <div style={{ position: 'absolute', insetBlockStart: 8, insetInlineEnd: 8 }}>
            <WeatherBadge match={entity.weatherMatch} />
          </div>
        )}

        {/* Instant book tag */}
        {entity.instantBook && (
          <div style={{
            position: 'absolute', insetBlockStart: 8, insetInlineStart: 10,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            borderRadius: 5, paddingBlock: 2, paddingInline: 6,
            fontSize: 8, fontWeight: 700, color: '#30D158',
          }}>
            ⚡ Instant
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
          {entity.title}
        </div>

        {/* Provider dots */}
        <ProviderDots providers={entity.providers} />

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: '#636366' }}>⏱ {entity.durationHours}h</span>
          <span style={{ fontSize: 9, color: DIFF_STYLE[entity.difficulty].color, fontWeight: 600 }}>
            {entity.difficulty}
          </span>
          <span style={{ fontSize: 9, color: '#636366' }}>
            ★ {entity.rating.toFixed(2)}
            <span style={{ color: '#AEAEB2' }}> ({entity.reviewCount.toLocaleString()})</span>
          </span>
        </div>

        {/* AI highlight (truncated) */}
        <p style={{
          fontSize: 10, color: '#636366', lineHeight: 1.4, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {entity.aiHighlight}
        </p>

        {/* Price + CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.03em' }}>
              ${entity.pricePerPerson.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: '#8E8E93' }}>/person</span>
          </div>
          <button style={{
            fontSize: 10, fontWeight: 700, color: typeStyle.fg,
            background: typeStyle.bg, border: `1px solid ${typeStyle.fg}30`,
            borderRadius: 8, paddingBlock: 5, paddingInline: 12, cursor: 'pointer',
          }}>
            {entity.instantBook ? 'Book →' : 'Check →'}
          </button>
        </div>
      </div>
    </motion.div>
  );
});
