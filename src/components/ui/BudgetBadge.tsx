'use client';

import { motion } from 'framer-motion';

interface BudgetBadgeProps {
  amount: number;
  currency?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  size?: 'sm' | 'md';
  label?: string;
}

const variantStyles = {
  default: { color: 'rgba(255,255,255,0.85)', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)', glow: 'none' },
  warning: { color: '#FFD60A', bg: 'rgba(255,214,10,0.12)', border: 'rgba(255,214,10,0.3)', glow: '0 0 12px rgba(255,214,10,0.25)' },
  danger:  { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)', border: 'rgba(255,107,107,0.3)', glow: '0 0 12px rgba(255,107,107,0.25)' },
  success: { color: '#30D158', bg: 'rgba(48,209,88,0.12)', border: 'rgba(48,209,88,0.3)', glow: '0 0 12px rgba(48,209,88,0.25)' },
};

export function BudgetBadge({ amount, currency = 'USD', variant = 'default', size = 'md', label }: BudgetBadgeProps) {
  const s = variantStyles[variant];
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

  return (
    <motion.div
      className="inline-flex items-center gap-1"
      style={{
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        borderRadius: 999,
        background: s.bg,
        border: `1px solid ${s.border}`,
        boxShadow: s.glow,
        color: s.color,
        fontSize: size === 'sm' ? 11 : 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        fontVariantNumeric: 'tabular-nums',
      }}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {label && <span style={{ opacity: 0.7, fontWeight: 500 }}>{label} </span>}
      {formatted}
    </motion.div>
  );
}
