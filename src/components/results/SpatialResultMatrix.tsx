'use client';

import { useState, useEffect }                  from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { HeroCard }                             from './HeroCard';
import { FlightDetailsView }                    from './FlightDetailsView';
import { GlassShimmer }                         from '@/components/ui/GlassShimmer';
import type { AggregatedFlight, AggregatedResult } from '@/services/OmniAggregator';

// ── Shared types ───────────────────────────────────────────────────────────────

export type HeroCategory = 'time-saver' | 'smart-value' | 'premium';

export interface HeroDefinition {
  category:  HeroCategory;
  layoutId:  string;
  label:     string;
  subLabel:  string;
  icon:      string;
  color:     string;
  gradient:  string;
  result:    AggregatedFlight;
  secondary: AggregatedFlight[];
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface SpatialResultMatrixProps {
  results:   AggregatedFlight[];
  isLoading: boolean;
  onStage:   (source: AggregatedResult) => void;
}

// ── Hero derivation ────────────────────────────────────────────────────────────

function deriveHeroes(results: AggregatedFlight[]): HeroDefinition[] {
  if (results.length === 0) return [];

  const parseMins = (label: string): number => {
    const h = parseInt(label.match(/(\d+)h/)?.[1] ?? '0');
    const m = parseInt(label.match(/(\d+)m/)?.[1] ?? '0');
    return h * 60 + m;
  };

  // Time-Saver: fastest nonstop (by durationLabel)
  const fastest = [...results].sort(
    (a, b) => parseMins(a.durationLabel) - parseMins(b.durationLabel),
  )[0];

  // Smart Value: best confidence × value score
  const maxPrice = Math.max(...results.map(r => r.price));
  const bestValue = [...results].sort((a, b) => {
    const sa = a.aiConfidence * 0.55 + (1 - a.price / maxPrice) * 0.45;
    const sb = b.aiConfidence * 0.55 + (1 - b.price / maxPrice) * 0.45;
    return sb - sa;
  })[0];

  // Absolute Premium: highest confidence, prefer business class
  const premium = [...results].sort((a, b) => {
    const pa = a.aiConfidence + (a.class.toLowerCase().includes('business') ? 0.3 : 0);
    const pb = b.aiConfidence + (b.class.toLowerCase().includes('business') ? 0.3 : 0);
    return pb - pa;
  })[0];

  const usedIds = new Set([fastest.id, bestValue.id, premium.id]);
  const pool    = results.filter(r => !usedIds.has(r.id));

  return [
    {
      category:  'time-saver',
      layoutId:  'hero-time-saver',
      label:     'The Time-Saver',
      subLabel:  'Fastest nonstop to your destination',
      icon:      '⚡',
      color:     '#007AFF',
      gradient:  'linear-gradient(90deg, #007AFF 0%, #5E5CE6 100%)',
      result:    fastest,
      secondary: pool.slice(0, 5),
    },
    {
      category:  'smart-value',
      layoutId:  'hero-smart-value',
      label:     'The Smart Value',
      subLabel:  'Best price-to-experience ratio',
      icon:      '✦',
      color:     '#30D158',
      gradient:  'linear-gradient(90deg, #30D158 0%, #00C7BE 100%)',
      result:    bestValue,
      secondary: pool.slice(5, 10),
    },
    {
      category:  'premium',
      layoutId:  'hero-premium',
      label:     'The Absolute Premium',
      subLabel:  'Uncompromising luxury in the sky',
      icon:      '👑',
      color:     '#FF9500',
      gradient:  'linear-gradient(90deg, #FFD60A 0%, #FF9500 100%)',
      result:    premium,
      secondary: pool.slice(10, 15),
    },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SpatialResultMatrix({ results, isLoading, onStage }: SpatialResultMatrixProps) {
  const [visibleHeroes, setVisibleHeroes] = useState<HeroDefinition[]>([]);
  const [expandedHero,  setExpandedHero]  = useState<string | null>(null);

  // Pop heroes in with 220 ms stagger to simulate streaming API responses
  useEffect(() => {
    if (!results.length) { setVisibleHeroes([]); return; }
    const heroes = deriveHeroes(results);
    const timers: ReturnType<typeof setTimeout>[] = [];
    heroes.forEach((h, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleHeroes(prev => {
            if (prev.find(x => x.layoutId === h.layoutId)) return prev;
            return [...prev, h];
          });
        }, i * 220),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [results]);

  const expandedDef = visibleHeroes.find(h => h.layoutId === expandedHero) ?? null;

  if (!isLoading && results.length === 0) return null;

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-4">

        {/* ── Section header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#6E6E73]">
            Spatial Stacks
            {results.length > 0
              ? ` · ${results.length} results distilled`
              : ' · Scanning engines…'}
          </span>
          {visibleHeroes.length > 0 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-[#30D158] font-semibold"
            >
              ✓ AI distillation complete
            </motion.span>
          )}
        </div>

        {/* ── Bento grid ──────────────────────────────────────────────────────── */}
        <AnimatePresence mode="sync">
          {!expandedHero && (
            <motion.div
              key="bento-grid"
              className="grid gap-3"
              style={{
                gridTemplateColumns: '1.7fr 1fr',
                gridTemplateRows:    '260px 260px',
                minHeight:            536,
              }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
              transition={{ duration: 0.25 }}
            >
              {/* Time-Saver — spans both rows */}
              {visibleHeroes[0] ? (
                <motion.div
                  key="hero-0"
                  style={{ gridRow: '1 / span 2' }}
                  initial={{ opacity: 0, scale: 0.93, y: 16 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0 }}
                >
                  <HeroCard
                    hero={visibleHeroes[0]}
                    onClick={() => setExpandedHero(visibleHeroes[0].layoutId)}
                    onStage={onStage}
                    className="h-full"
                  />
                </motion.div>
              ) : (
                <GlassShimmer
                  key="sk-0"
                  style={{ gridRow: '1 / span 2' }}
                  className="h-full rounded-3xl"
                />
              )}

              {/* Smart Value — top right */}
              {visibleHeroes[1] ? (
                <motion.div
                  key="hero-1"
                  initial={{ opacity: 0, scale: 0.93, y: 16 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.08 }}
                >
                  <HeroCard
                    hero={visibleHeroes[1]}
                    onClick={() => setExpandedHero(visibleHeroes[1].layoutId)}
                    onStage={onStage}
                    className="h-full"
                  />
                </motion.div>
              ) : (
                <GlassShimmer
                  key="sk-1"
                  className="h-full rounded-3xl"
                  delay={0.15}
                />
              )}

              {/* Absolute Premium — bottom right */}
              {visibleHeroes[2] ? (
                <motion.div
                  key="hero-2"
                  initial={{ opacity: 0, scale: 0.93, y: 16 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.16 }}
                >
                  <HeroCard
                    hero={visibleHeroes[2]}
                    onClick={() => setExpandedHero(visibleHeroes[2].layoutId)}
                    onStage={onStage}
                    className="h-full"
                  />
                </motion.div>
              ) : (
                <GlassShimmer
                  key="sk-2"
                  className="h-full rounded-3xl"
                  delay={0.3}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Expanded details view ────────────────────────────────────────────── */}
        <AnimatePresence>
          {expandedHero && expandedDef && (
            <FlightDetailsView
              key="details"
              hero={expandedDef}
              allResults={results}
              onClose={() => setExpandedHero(null)}
              onStage={onStage}
            />
          )}
        </AnimatePresence>

      </div>
    </LayoutGroup>
  );
}
