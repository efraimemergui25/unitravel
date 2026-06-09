'use client';

import { motion }                                          from 'framer-motion';
import { Plane, Hotel, UtensilsCrossed, Compass, Train }  from 'lucide-react';
import { EntityCategory }                                 from '@/types';

const ICONS: Record<EntityCategory, {
  icon:  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  bg:    string;
}> = {
  flight:     { icon: Plane,           color: '#007AFF', bg: 'rgba(0,122,255,0.15)'   },
  hotel:      { icon: Hotel,           color: '#00C7BE', bg: 'rgba(0,199,190,0.15)'  },
  restaurant: { icon: UtensilsCrossed, color: '#FF9F0A', bg: 'rgba(255,214,10,0.12)' },
  activity:   { icon: Compass,         color: '#30D158', bg: 'rgba(48,209,88,0.15)'   },
  transport:  { icon: Train,           color: '#5E5CE6', bg: 'rgba(94,92,230,0.15)'   },
};

interface CategoryIconProps {
  category: EntityCategory;
  size?:    'sm' | 'md' | 'lg';
  pulse?:   boolean;
}

const sizeMap     = { sm: 28, md: 36, lg: 48 };
const iconSizeMap = { sm: 13, md: 17, lg: 22 };

export function CategoryIcon({ category, size = 'md', pulse = false }: CategoryIconProps) {
  const { icon: Icon, color, bg } = ICONS[category];
  const px = sizeMap[size];
  const is = iconSizeMap[size];

  return (
    <motion.div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{
        width:        px,
        height:       px,
        borderRadius: px * 0.35,
        background:   bg,
        border:       `1px solid ${color}30`,
        boxShadow:    `0 0 16px ${color}20`,
      }}
      whileHover={{ scale: 1.1, boxShadow: `0 0 24px ${color}40` }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Icon size={is} color={color} strokeWidth={1.8} />
      {pulse && (
        <motion.div
          className="absolute inset-0"
          style={{ borderRadius: 'inherit', border: `1px solid ${color}` }}
          animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </motion.div>
  );
}

export function getCategoryColor(category: EntityCategory): string {
  return ICONS[category].color;
}

export function getCategoryLabel(category: EntityCategory): string {
  const labels: Record<EntityCategory, string> = {
    flight: 'Flight', hotel: 'Hotel',
    restaurant: 'Dining', activity: 'Activity', transport: 'Transport',
  };
  return labels[category];
}

export function getCategoryIcon(category: EntityCategory) {
  return ICONS[category].icon;
}
