'use client';

import { useMemo, useState }        from 'react';
import { motion, AnimatePresence }   from 'framer-motion';
import { useUserDNA }                from '@/store/useUserDNA';
import { useCulinarySync }           from '@/store/useCulinarySync';
import type { AggregatedDining }     from '@/services/OmniAggregator';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 400, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;
const ORANGE     = '#FF9F0A';
const GOLD       = '#F5C518';

// ── Dish database by cuisine (representative, not hardcoded to a trip) ─────────

const CUISINE_DISHES: Record<string, Array<{ name: string; description: string; price: number; tags: string[]; emoji: string }>> = {
  'Contemporary Mexican': [
    { name: 'Mole Madre',       description: 'Aged mole with duck confit', price: 65, tags: ['signature', 'omnivore'], emoji: '🫕' },
    { name: 'Cochinita al pastor', description: 'Slow-roasted pork, pineapple tomatillo', price: 55, tags: ['omnivore', 'pork'], emoji: '🌮' },
    { name: 'Tlayuda de Hongos', description: 'Wild mushroom, black beans, epazote', price: 42, tags: ['vegetarian', 'vegan'], emoji: '🍄' },
  ],
  'Modern Mexican': [
    { name: 'Tostada de Atún',  description: 'Bluefin tuna, avocado, cilantro oil', price: 48, tags: ['pescatarian', 'gluten-free'], emoji: '🐟' },
    { name: 'Gusanos de Maguey', description: 'Maguey worms, guacamole, mezcal salt', price: 38, tags: ['signature', 'omnivore'], emoji: '🌵' },
    { name: 'Caldo de Quelites', description: 'Wild greens, hoja santa, epazote', price: 32, tags: ['vegan', 'vegetarian', 'gluten-free'], emoji: '🥬' },
  ],
  'Seafood Cliff-side': [
    { name: 'Lobster Thermidor', description: 'Baja lobster, cognac cream, gruyère', price: 95, tags: ['pescatarian', 'signature'], emoji: '🦞' },
    { name: 'Sea Bass Ceviche',  description: 'Pacific sea bass, yuzu, serrano', price: 52, tags: ['pescatarian', 'gluten-free'], emoji: '🍋' },
    { name: 'Grilled Octopus',   description: 'Charred tentacle, salsa verde, potato', price: 68, tags: ['pescatarian', 'gluten-free'], emoji: '🐙' },
  ],
  default: [
    { name: 'Chef\'s Tasting',   description: 'Seasonal 7-course tasting menu', price: 120, tags: ['signature', 'omnivore'], emoji: '👨‍🍳' },
    { name: 'Garden Salad',      description: 'Local greens, seasonal vegetables', price: 22, tags: ['vegan', 'vegetarian', 'gluten-free'], emoji: '🥗' },
    { name: 'Grilled Catch',     description: 'Daily local fish, citrus butter', price: 58, tags: ['pescatarian', 'gluten-free'], emoji: '🐠' },
  ],
};

// ── AI dish filtering logic ───────────────────────────────────────────────────

function filterDishesForDNA(
  dishes: typeof CUISINE_DISHES.default,
  dietaryRestrictions: string[],
  filterDietary: string[],
): typeof CUISINE_DISHES.default {
  const allRestrictions = [
    ...dietaryRestrictions.map(d => d.toLowerCase()),
    ...filterDietary.map(d => d.toLowerCase()),
  ];

  if (allRestrictions.length === 0) return dishes;

  const filtered = dishes.filter(d =>
    allRestrictions.some(r => d.tags.some(t => t.toLowerCase().includes(r.toLowerCase().slice(0, 5))))
  );
  return filtered.length > 0 ? filtered : dishes;
}

// ── Dish micro-card ───────────────────────────────────────────────────────────

function DishCard({ dish, rank, color }: {
  dish:  { name: string; description: string; price: number; tags: string[]; emoji: string };
  rank:  number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ ...SPRING_POP, delay: rank * 0.07 }}
      style={{
        position:       'relative',
        borderRadius:   16,
        overflow:       'hidden',
        border:         `1.5px solid ${color}30`,
        background:     'rgba(255,255,255,0.30)',
        backdropFilter: 'blur(20px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.7)',
        boxShadow:      `inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px ${color}15`,
      }}
    >
      {/* Soft blurred emoji background */}
      <div style={{
        position:   'absolute', inset: 0,
        display:    'flex', alignItems: 'center', justifyContent: 'center',
        fontSize:   80, opacity: 0.07,
        filter:     'blur(8px)',
        userSelect: 'none',
        pointerEvents: 'none',
      }}>
        {dish.emoji}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* AI pick badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: rank * 0.3 }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}cc`, flexShrink: 0 }}
          />
          <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
            AI Pick #{rank + 1}
          </span>
        </div>

        {/* Dish name */}
        <span style={{ fontSize: 12, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: 'inherit' }}>
          {dish.emoji} {dish.name}
        </span>

        {/* Description */}
        <span style={{ fontSize: 10, fontWeight: 500, color: '#6E6E73', lineHeight: 1.4, fontFamily: 'inherit' }}>
          {dish.description}
        </span>

        {/* Tags + price */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockStart: 2 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {dish.tags.slice(0, 2).map(tag => (
              <span key={tag} style={{
                fontSize: 8.5, fontWeight: 700, color: color,
                background: `${color}12`, border: `1px solid ${color}25`,
                borderRadius: 6, paddingBlock: 2, paddingInline: 5,
                textTransform: 'capitalize', fontFamily: 'inherit',
              }}>
                {tag}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 12, fontWeight: 900, color, letterSpacing: '-0.02em', fontFamily: 'inherit' }}>
            ${dish.price}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MenuVisualizerProps {
  restaurant: AggregatedDining;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MenuVisualizer({ restaurant }: MenuVisualizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { profile: dnaProfile } = useUserDNA();
  const { filters } = useCulinarySync();

  const dishes = useMemo(() => {
    const cuisineKey = Object.keys(CUISINE_DISHES).find(k =>
      restaurant.cuisine.toLowerCase().includes(k.toLowerCase().split(' ')[0]!.toLowerCase())
    ) ?? 'default';
    const raw = CUISINE_DISHES[cuisineKey] ?? CUISINE_DISHES.default!;
    const filtered = filterDishesForDNA(raw, dnaProfile.dietaryRestrictions, filters.dietaryRestrictions);
    return filtered.slice(0, 3);
  }, [restaurant.cuisine, dnaProfile.dietaryRestrictions, filters.dietaryRestrictions]);

  const hasDietaryContext = dnaProfile.dietaryRestrictions.length > 0 || filters.dietaryRestrictions.length > 0;
  const michelinColor = restaurant.michelinStars ? GOLD : ORANGE;

  return (
    <div>
      {/* Toggle button */}
      <motion.button
        onClick={() => setIsOpen(v => !v)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingBlock: 7, paddingInline: 14,
          borderRadius: 10,
          border: `1px solid ${ORANGE}30`,
          background: `${ORANGE}08`,
          color: ORANGE, fontSize: 10.5,
          fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', letterSpacing: '-0.01em',
        }}
      >
        <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={SPRING} style={{ display: 'inline-block', fontSize: 10 }}>▶</motion.span>
        {isOpen ? 'Hide AI Dishes' : '✦ AI Dish Recommendations'}
        {hasDietaryContext && (
          <span style={{ fontSize: 8.5, fontWeight: 700, background: `${ORANGE}15`, border: `1px solid ${ORANGE}30`, borderRadius: 6, paddingBlock: 2, paddingInline: 5, color: ORANGE }}>
            DNA-filtered
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ ...SPRING, duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingBlockStart: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Context note */}
              {hasDietaryContext && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ margin: 0, marginBlockEnd: 8, fontSize: 10, fontWeight: 600, color: ORANGE, fontFamily: 'inherit', lineHeight: 1.5 }}
                >
                  ✦ Filtered for: {[...dnaProfile.dietaryRestrictions, ...filters.dietaryRestrictions].join(', ')}
                </motion.p>
              )}

              {/* Dish cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                <AnimatePresence>
                  {dishes.map((dish, i) => (
                    <DishCard key={dish.name} dish={dish} rank={i} color={michelinColor} />
                  ))}
                </AnimatePresence>
              </div>

              {/* Michelin note */}
              {restaurant.michelinStars && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, marginBlockStart: 6, fontSize: 9.5, fontWeight: 600, color: GOLD, fontFamily: 'inherit' }}
                >
                  {'⭐'.repeat(restaurant.michelinStars)} Michelin {restaurant.michelinStars === 1 ? 'Star' : 'Stars'}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
