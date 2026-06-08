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
          white:  'rgba(255,255,255,0.72)',
          border: 'rgba(209,213,219,0.40)',
          hover:  'rgba(255,255,255,0.82)',
          strong: 'rgba(255,255,255,0.92)',
          frost:  'rgba(255,255,255,0.60)',
        },
        brand: {
          azure:   '#007AFF',
          teal:    '#00C7BE',
          gold:    '#FF9F0A',
          coral:   '#FF453A',
          emerald: '#30D158',
          indigo:  '#5E5CE6',
          pink:    '#FF2D55',
          violet:  '#BF5AF2',
        },
        surface: {
          base: '#F2F2F7',
          mid:  '#FFFFFF',
          card: 'rgba(255,255,255,0.88)',
          sub:  '#E5E5EA',
        },
      },
      backdropBlur: {
        xs:   '2px',
        '3xl':'48px',
        '4xl':'64px',
      },
      backdropSaturate: {
        180: '1.8',
        190: '1.9',
      },
      fontFamily: {
        sans:    ['-apple-system', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', '-apple-system', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tight:   '-0.02em',
        tighter: '-0.03em',
        tightest:'-0.04em',
      },
      boxShadow: {
        // Apple-Light glassmorphism — exact dictated values
        'glass':        '0 8px 32px 0 rgba(31,38,135,0.05)',
        'glass-inset':  'inset 0 2px 10px rgba(255,255,255,1)',
        'glass-sm':     '0 4px 16px 0 rgba(31,38,135,0.04)',
        'glass-lg':     '0 16px 48px 0 rgba(31,38,135,0.08), inset 0 2px 10px rgba(255,255,255,1)',
        'glass-xl':     '0 32px 80px 0 rgba(31,38,135,0.10), inset 0 2px 12px rgba(255,255,255,1)',
        'card':         '0 2px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
        // Brand glow — light-mode calibrated
        'glow-blue':    '0 0 32px rgba(0,122,255,0.22)',
        'glow-teal':    '0 0 32px rgba(0,199,190,0.22)',
        'glow-gold':    '0 0 32px rgba(255,159,10,0.18)',
        'glow-coral':   '0 0 32px rgba(255,69,58,0.22)',
        'glow-indigo':  '0 0 32px rgba(94,92,230,0.22)',
        'glow-emerald': '0 0 32px rgba(48,209,88,0.20)',
      },
      animation: {
        'pulse-slow':     'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':        'shimmer 2.5s linear infinite',
        'float':          'float 6s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'fade-in':        'fade-in 0.3s ease-out',
        'slide-up':       'slide-up 0.4s cubic-bezier(0.16,1,0.3,1)',
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
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
