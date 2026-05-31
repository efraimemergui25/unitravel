import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          white:   'rgba(255,255,255,0.06)',
          border:  'rgba(255,255,255,0.12)',
          hover:   'rgba(255,255,255,0.10)',
          strong:  'rgba(255,255,255,0.14)',
        },
        brand: {
          azure:   '#007AFF',
          teal:    '#00C7BE',
          gold:    '#FFD60A',
          coral:   '#FF6B6B',
          emerald: '#30D158',
          indigo:  '#5E5CE6',
        },
        surface: {
          deep:  '#080B14',
          mid:   '#0D1220',
          card:  '#111827',
        },
      },
      backdropBlur: {
        xs:   '2px',
        '3xl':'48px',
        '4xl':'64px',
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display:['var(--font-outfit)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        glass:    '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-lg':'0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.10)',
        'glass-xl':'0 48px 96px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.12)',
        'glow-blue':  '0 0 40px rgba(0,122,255,0.35)',
        'glow-teal':  '0 0 40px rgba(0,199,190,0.35)',
        'glow-gold':  '0 0 40px rgba(255,214,10,0.25)',
        'glow-coral': '0 0 40px rgba(255,107,107,0.35)',
      },
      animation: {
        'pulse-slow':    'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':       'shimmer 2.5s linear infinite',
        'float':         'float 6s ease-in-out infinite',
        'gradient-shift':'gradient-shift 8s ease infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
