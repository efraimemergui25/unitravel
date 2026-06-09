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
        // Apple-style glass surfaces — light mode
        glass: {
          white:    'rgba(255,255,255,0.78)',
          '90':     'rgba(255,255,255,0.90)',
          '60':     'rgba(255,255,255,0.60)',
          '40':     'rgba(255,255,255,0.40)',
          '20':     'rgba(255,255,255,0.20)',
          border:   'rgba(255,255,255,0.85)',
          hairline: 'rgba(0,0,0,0.06)',
          frost:    'rgba(245,245,250,0.80)',
        },
        // Apple backgrounds
        surface: {
          base:  '#F2F2F7',
          cool:  '#EEF0F8',
          pearl: '#F8F9FF',
          white: '#FFFFFF',
          sub:   '#E5E5EA',
          card:  'rgba(255,255,255,0.88)',
        },
        // Brand — Apple system colors
        brand: {
          azure:   '#007AFF',
          blue:    '#0A84FF',
          indigo:  '#5E5CE6',
          violet:  '#BF5AF2',
          teal:    '#5AC8FA',
          cyan:    '#32ADE6',
          gold:    '#FF9F0A',
          coral:   '#FF453A',
          emerald: '#30D158',
          rose:    '#FF375F',
        },
        // Text hierarchy — Apple dark text
        ink: {
          '100': '#1D1D1F',
          '80':  '#3C3C43',
          '60':  '#6E6E73',
          '40':  '#AEAEB2',
          '20':  '#C7C7CC',
        },
      },
      backdropBlur: {
        xs:   '2px',
        '3xl':'48px',
        '4xl':'64px',
        '5xl':'80px',
      },
      fontFamily: {
        sans:    ['-apple-system', 'var(--font-inter)', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', '-apple-system', 'system-ui', 'sans-serif'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tight:    '-0.02em',
        tighter:  '-0.03em',
        tightest: '-0.04em',
      },
      boxShadow: {
        // Apple-style glass — light mode calibrated
        'glass':      '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
        'glass-sm':   '0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
        'glass-lg':   '0 16px 48px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
        'glass-xl':   '0 24px 64px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
        'glass-2xl':  '0 40px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
        // Specular inner glow
        'inset-top':  'inset 0 2px 8px rgba(255,255,255,0.95)',
        'inset-full': 'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,0.03)',
        // Brand glow
        'glow-blue':    '0 0 32px rgba(0,122,255,0.22), 0 4px 16px rgba(0,122,255,0.12)',
        'glow-violet':  '0 0 32px rgba(94,92,230,0.18), 0 4px 16px rgba(94,92,230,0.10)',
        'glow-teal':    '0 0 32px rgba(90,200,250,0.20), 0 4px 16px rgba(90,200,250,0.10)',
        'glow-gold':    '0 0 32px rgba(255,159,10,0.20), 0 4px 16px rgba(255,159,10,0.10)',
        'glow-emerald': '0 0 32px rgba(48,209,88,0.18), 0 4px 16px rgba(48,209,88,0.10)',
        // Panel accent
        'panel-blue':   '0 0 0 1.5px rgba(0,122,255,0.25), 0 4px 20px rgba(0,122,255,0.10)',
        'panel-violet': '0 0 0 1.5px rgba(94,92,230,0.22), 0 4px 20px rgba(94,92,230,0.08)',
      },
      animation: {
        'pulse-slow':     'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':        'shimmer 2.5s linear infinite',
        'float':          'float 7s ease-in-out infinite',
        'breathe':        'breathe 5s ease-in-out infinite',
        'gradient-drift': 'gradient-drift 12s ease infinite',
        'fade-in':        'fade-in 0.4s ease-out',
        'slide-up':       'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)',
        'glow-pulse':     'glow-pulse 3s ease-in-out infinite',
        'spin-slow':      'spin 8s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)',    opacity: '0.55' },
          '50%':      { transform: 'scale(1.06)', opacity: '0.80' },
        },
        'gradient-drift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 16px rgba(0,122,255,0.15)' },
          '50%':      { boxShadow: '0 0 36px rgba(0,122,255,0.35)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
