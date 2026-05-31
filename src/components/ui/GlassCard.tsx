'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef, ReactNode } from 'react';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: 'default' | 'strong' | 'deep' | 'light';
  glow?: 'blue' | 'teal' | 'gold' | 'coral' | 'emerald' | 'indigo' | 'none';
  specular?: boolean;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  children?: ReactNode;
}

const glowMap = {
  blue:    '0 0 40px rgba(0,122,255,0.3),   0 0 80px rgba(0,122,255,0.12)',
  teal:    '0 0 40px rgba(0,199,190,0.3),   0 0 80px rgba(0,199,190,0.12)',
  gold:    '0 0 40px rgba(255,214,10,0.25),  0 0 80px rgba(255,214,10,0.08)',
  coral:   '0 0 40px rgba(255,107,107,0.3),  0 0 80px rgba(255,107,107,0.12)',
  emerald: '0 0 40px rgba(48,209,88,0.3),    0 0 80px rgba(48,209,88,0.12)',
  indigo:  '0 0 40px rgba(94,92,230,0.3),    0 0 80px rgba(94,92,230,0.12)',
  none: '',
} as const;

const variantMap = {
  default: 'bg-white/[0.06] backdrop-blur-2xl border border-white/10',
  strong:  'bg-white/[0.10] backdrop-blur-[40px] border border-white/[0.15]',
  deep:    'bg-[#080B14]/75 backdrop-blur-[48px] border border-white/[0.07]',
  light:   'bg-white/[0.72] backdrop-blur-3xl border border-white/90',
} as const;

const roundedMap = {
  sm:  'rounded-sm',
  md:  'rounded-md',
  lg:  'rounded-lg',
  xl:  'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
} as const;

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({
  variant  = 'default',
  glow     = 'none',
  specular = true,
  rounded  = '2xl',
  className = '',
  children,
  style,
  ...props
}, ref) => {
  const shadow = [
    variant === 'light'
      ? '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)'
      : variant === 'deep'
        ? '0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)'
        : variant === 'strong'
          ? '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)'
          : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
    glow !== 'none' ? glowMap[glow] : '',
  ].filter(Boolean).join(', ');

  return (
    <motion.div
      ref={ref}
      className={`relative overflow-hidden ${variantMap[variant]} ${roundedMap[rounded]} ${className}`}
      style={{ boxShadow: shadow, ...style }}
      {...props}
    >
      {specular && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%)',
            borderRadius: 'inherit',
          }}
        />
      )}
      {children}
    </motion.div>
  );
});

GlassCard.displayName = 'GlassCard';
