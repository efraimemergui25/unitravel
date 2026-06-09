'use client';

import { useState, InputHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface GlassInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  icon?:      ReactNode;
  className?: string;
  label?:     string;
}

export function GlassInput({ icon, className = '', label, ...props }: GlassInputProps) {
  const [focused, setFocused] = useState(false);

  const activeIcon = icon ?? <Sparkles size={15} />;

  return (
    <div className="relative w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium text-slate-600 tracking-tight">
          {label}
        </label>
      )}

      {/* ── Dictated CSS ─────────────────────────────────────────────────────── */}
      <input
        className={`
          w-full px-5 py-4 rounded-2xl
          bg-white/20 backdrop-blur-lg
          border border-white/50
          focus:border-white focus:bg-white/40
          focus:shadow-[0_0_20px_rgba(255,255,255,0.5)]
          outline-none
          text-slate-800 placeholder:text-slate-500
          transition-all
          pr-12
          ${className}
        `}
        onFocus={e => { setFocused(true);  props.onFocus?.(e); }}
        onBlur={e  => { setFocused(false); props.onBlur?.(e);  }}
        {...props}
      />

      {/* ── Absolute-positioned animated glow icon ───────────────────────────── */}
      <motion.div
        className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
        animate={{
          opacity: focused ? 1 : 0.35,
          scale:   focused ? 1.15 : 1,
          color:   focused ? '#007AFF' : 'rgba(100,116,139,0.8)',
        }}
        style={{
          // glow ring behind the icon on focus
          filter: focused
            ? 'drop-shadow(0 0 6px rgba(0,122,255,0.55)) drop-shadow(0 0 14px rgba(0,122,255,0.25))'
            : 'none',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        {activeIcon}
      </motion.div>
    </div>
  );
}
