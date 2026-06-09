'use client';

import { useMemo, useState }            from 'react';
import { motion, AnimatePresence }      from 'framer-motion';
import { GripHorizontal }               from 'lucide-react';
import { useDraggable, DndContext }     from '@dnd-kit/core';
import type { DragEndEvent }            from '@dnd-kit/core';
import { useUserDNA }                   from '@/store/useUserDNA';
import { useCulinarySync }              from '@/store/useCulinarySync';
import type { AggregatedDining }        from '@/services/OmniAggregator';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 400, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;
const ORANGE     = '#FF9F0A';
const GOLD       = '#F5C518';

// ── Dish database ─────────────────────────────────────────────────────────────

const CUISINE_DISHES: Record<string, Array<{
  name:        string;
  description: string;
  price:       number;
  tags:        string[];
  emoji:       string;
}>> = {
  'Contemporary Mexican': [
    { name: 'Mole Madre',          description: 'Aged mole with duck confit',               price: 65,  tags: ['signature', 'omnivore'],              emoji: '🫕' },
    { name: 'Cochinita al pastor', description: 'Slow-roasted pork, pineapple tomatillo',   price: 55,  tags: ['omnivore', 'pork'],                   emoji: '🌮' },
    { name: 'Tlayuda de Hongos',   description: 'Wild mushroom, black beans, epazote',      price: 42,  tags: ['vegetarian', 'vegan'],                emoji: '🍄' },
  ],
  'Modern Mexican': [
    { name: 'Tostada de Atún',     description: 'Bluefin tuna, avocado, cilantro oil',      price: 48,  tags: ['pescatarian', 'gluten-free'],          emoji: '🐟' },
    { name: 'Gusanos de Maguey',   description: 'Maguey worms, guacamole, mezcal salt',     price: 38,  tags: ['signature', 'omnivore'],              emoji: '🌵' },
    { name: 'Caldo de Quelites',   description: 'Wild greens, hoja santa, epazote',         price: 32,  tags: ['vegan', 'vegetarian', 'gluten-free'], emoji: '🥬' },
  ],
  'Seafood Cliff-side': [
    { name: 'Lobster Thermidor',   description: 'Baja lobster, cognac cream, gruyère',      price: 95,  tags: ['pescatarian', 'signature'],            emoji: '🦞' },
    { name: 'Sea Bass Ceviche',    description: 'Pacific sea bass, yuzu, serrano',          price: 52,  tags: ['pescatarian', 'gluten-free'],          emoji: '🍋' },
    { name: 'Grilled Octopus',     description: 'Charred tentacle, salsa verde, potato',   price: 68,  tags: ['pescatarian', 'gluten-free'],          emoji: '🐙' },
  ],
  default: [
    { name: "Chef's Tasting",      description: 'Seasonal 7-course tasting menu',           price: 120, tags: ['signature', 'omnivore'],              emoji: '👨‍🍳' },
    { name: 'Garden Salad',        description: 'Local greens, seasonal vegetables',        price: 22,  tags: ['vegan', 'vegetarian', 'gluten-free'], emoji: '🥗' },
    { name: 'Grilled Catch',       description: 'Daily local fish, citrus butter',          price: 58,  tags: ['pescatarian', 'gluten-free'],         emoji: '🐠' },
  ],
};

type Dish = typeof CUISINE_DISHES.default[number];

// ── DNA match filter ──────────────────────────────────────────────────────────

function filterDishesForDNA(
  dishes:              Dish[],
  dietaryRestrictions: string[],
  filterDietary:       string[],
): Dish[] {
  const all = [
    ...dietaryRestrictions.map(d => d.toLowerCase()),
    ...filterDietary.map(d => d.toLowerCase()),
  ];
  if (all.length === 0) return dishes;
  const matched = dishes.filter(d =>
    all.some(r => d.tags.some(t => t.toLowerCase().includes(r.slice(0, 5))))
  );
  return matched.length > 0 ? matched : dishes;
}

// ── DNA match badge ───────────────────────────────────────────────────────────

function MatchBadge({
  tags, restrictions, color,
}: { tags: string[]; restrictions: string[]; color: string }) {
  if (restrictions.length === 0) return null;
  const matched = restrictions.filter(r =>
    tags.some(t => t.toLowerCase().includes(r.toLowerCase().slice(0, 5)))
  );
  if (matched.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      paddingBlock: 2, paddingInline: 6,
      borderRadius: 6,
      background: `${color}18`,
      border: `1px solid ${color}30`,
    }}>
      <span style={{ fontSize: 8, color }}>✓</span>
      <span style={{ fontSize: 9, fontWeight: 800, color, fontFamily: 'inherit', letterSpacing: '-0.01em' }}>
        Matched: {matched[0]}
      </span>
    </div>
  );
}

// ── @dnd-kit drag handle for each dish ───────────────────────────────────────
// The user drags THIS specific dish into the LiquidTimeline.

function DishDragHandle({
  dish,
  restaurant,
  color,
}: {
  dish:       Dish;
  restaurant: AggregatedDining;
  color:      string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `dish-drag-${restaurant.id}-${dish.name}`,
    data: {
      type:       'dish',
      dish,
      restaurant,
      summary: {
        id:          `${restaurant.id}-${dish.name.replace(/\s+/g, '-').toLowerCase()}`,
        name:        `${dish.name} — ${restaurant.name}`,
        price:       dish.price,
        category:    'dining',
        description: dish.description,
        emoji:       dish.emoji,
      },
    },
  });

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      animate={{
        scale:     isDragging ? 1.18 : 1,
        background: isDragging ? `${color}22` : `rgba(0,0,0,0.05)`,
        boxShadow:  isDragging ? `0 4px 14px ${color}44` : 'none',
      }}
      whileHover={{ scale: 1.12, background: `${color}14` }}
      transition={SPRING_POP}
      style={{
        width:          24, height: 24,
        borderRadius:   7,
        border:         `1px solid rgba(0,0,0,0.07)`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        cursor:         isDragging ? 'grabbing' : 'grab',
        color:          `${color}AA`,
        flexShrink:     0,
        touchAction:    'none',
      }}
      title={`Drag "${dish.name}" to timeline`}
      aria-label={`Drag ${dish.name} to timeline`}
    >
      <GripHorizontal size={12} strokeWidth={2.2} aria-hidden />
    </motion.div>
  );
}

// ── Dish micro-card ───────────────────────────────────────────────────────────

function DishCard({
  dish,
  rank,
  color,
  restaurant,
  restrictions,
}: {
  dish:         Dish;
  rank:         number;
  color:        string;
  restaurant:   AggregatedDining;
  restrictions: string[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
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
        boxShadow:      `inset 0 1px 0 rgba(255,255,255,0.90), 0 4px 16px ${color}15`,
      }}
    >
      {/* Blurred emoji background */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 80, opacity: 0.07,
        filter: 'blur(8px)',
        userSelect: 'none', pointerEvents: 'none',
      }} aria-hidden>
        {dish.emoji}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* AI pick indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: rank * 0.3 }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
            aria-hidden
          />
          <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
            AI Pick #{rank + 1}
          </span>
        </div>

        {/* Dish name in stark white-contrast style */}
        <span style={{ fontSize: 12, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: 'inherit' }}>
          {dish.emoji} {dish.name}
        </span>

        {/* Description */}
        <span style={{ fontSize: 10, fontWeight: 500, color: '#6E6E73', lineHeight: 1.4, fontFamily: 'inherit' }}>
          {dish.description}
        </span>

        {/* Tags + DNA match + price row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {dish.tags.slice(0, 2).map(tag => (
              <span key={tag} style={{
                fontSize: 9, fontWeight: 700, color,
                background: `${color}12`, border: `1px solid ${color}25`,
                borderRadius: 6, paddingBlock: 2, paddingInline: 5,
                textTransform: 'capitalize', fontFamily: 'inherit',
              }}>
                {tag}
              </span>
            ))}
            <MatchBadge tags={dish.tags} restrictions={restrictions} color={color} />
          </div>

          {/* Price — `bg-black/40 backdrop-blur-md` badge */}
          <div style={{
            paddingBlock:  2, paddingInline: 8,
            borderRadius:  6,
            background:    'rgba(0,0,0,0.40)',
            backdropFilter:'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            flexShrink:    0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'white', letterSpacing: '-0.02em', fontFamily: 'inherit' }}>
              ${dish.price}
            </span>
          </div>
        </div>

        {/* @dnd-kit drag handle — bottom-right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBlockStart: 2 }}>
          <DishDragHandle dish={dish} restaurant={restaurant} color={color} />
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
  const [isOpen, setIsOpen]       = useState(false);
  const { profile: dnaProfile }   = useUserDNA();
  const { filters }               = useCulinarySync();

  const dishes = useMemo(() => {
    const key = Object.keys(CUISINE_DISHES).find(k =>
      restaurant.cuisine.toLowerCase().includes(k.toLowerCase().split(' ')[0]!.toLowerCase())
    ) ?? 'default';
    const raw      = CUISINE_DISHES[key] ?? CUISINE_DISHES.default!;
    const filtered = filterDishesForDNA(raw, dnaProfile.dietaryRestrictions, filters.dietaryRestrictions);
    return filtered.slice(0, 3);
  }, [restaurant.cuisine, dnaProfile.dietaryRestrictions, filters.dietaryRestrictions]);

  const allRestrictions  = [...dnaProfile.dietaryRestrictions, ...filters.dietaryRestrictions];
  const hasDietaryCtx    = allRestrictions.length > 0;
  const michelinColor    = restaurant.michelinStars ? GOLD : ORANGE;

  // onDragEnd: when a dish is dropped onto the LiquidTimeline's droppable zone,
  // the dish summary is available in e.active.data.current.summary.
  const handleDragEnd = (_e: DragEndEvent) => {
    // Drop handling is done by the higher-level DndContext in LiquidTimeline.
    // This local handler exists only to prevent event bubbling issues.
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
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
          aria-expanded={isOpen}
        >
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={SPRING}
            style={{ display: 'inline-block', fontSize: 10 }}
            aria-hidden
          >
            ▶
          </motion.span>
          {isOpen ? 'Hide AI Dishes' : '✦ AI Dish Recommendations'}
          {hasDietaryCtx && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              background: `${ORANGE}15`, border: `1px solid ${ORANGE}30`,
              borderRadius: 6, paddingBlock: 2, paddingInline: 5, color: ORANGE,
            }}>
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
                {/* DNA filter context note */}
                {hasDietaryCtx && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ margin: 0, marginBlockEnd: 8, fontSize: 10, fontWeight: 600, color: ORANGE, fontFamily: 'inherit', lineHeight: 1.5 }}
                  >
                    ✦ Filtered for: {allRestrictions.join(', ')}
                  </motion.p>
                )}

                {/* 3-card grid — each with drag handle */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                  <AnimatePresence>
                    {dishes.map((dish, i) => (
                      <DishCard
                        key={dish.name}
                        dish={dish}
                        rank={i}
                        color={michelinColor}
                        restaurant={restaurant}
                        restrictions={allRestrictions}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Michelin note */}
                {restaurant.michelinStars != null && restaurant.michelinStars > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 0.3 } }}
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
    </DndContext>
  );
}
