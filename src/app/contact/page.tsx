'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useInView }        from 'framer-motion';
import Link                                           from 'next/link';
import {
  ArrowLeft, Mail, MessageCircle, Users, Send,
  Check, ChevronDown, ChevronUp, Paperclip, X,
  Clock, Star, Shield, Zap, Globe, Bug, Handshake,
  Code2, BookOpen, HelpCircle, Sparkles,
  ExternalLink, AlertTriangle,
  Loader2, Phone, HeadphonesIcon,
} from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────

const AZURE  = '#007AFF';
const INDIGO = '#5E5CE6';
const VIOLET = '#BF5AF2';
const EMERALD = '#30D158';
const AMBER  = '#FF9F0A';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;
const SPRING_SLOW = { type: 'spring', stiffness: 280, damping: 26 } as const;

// ── Utility: reveal wrapper ───────────────────────────────────────────────────

function Reveal({
  children, delay = 0, y = 18,
}: {
  children: React.ReactNode; delay?: number; y?: number;
}) {
  const ref  = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...SPRING_SLOW, delay }}
    >
      {children}
    </motion.div>
  );
}

// ── Typing animation for hero ─────────────────────────────────────────────────

function StatusBadge() {
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setBlink(v => !v), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.4 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '6px 14px', borderRadius: 100,
        background: 'rgba(48,209,88,0.10)',
        border: '1px solid rgba(48,209,88,0.28)',
        boxShadow: '0 2px 12px rgba(48,209,88,0.12)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <motion.div
        animate={{ opacity: blink ? 1 : 0.3, scale: blink ? 1 : 0.85 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        style={{
          width: 7, height: 7, borderRadius: '50%', background: EMERALD, flexShrink: 0,
          boxShadow: `0 0 8px ${EMERALD}`,
        }}
      />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: EMERALD, letterSpacing: '-0.01em' }}>
        Team online · avg reply 2 hours
      </span>
    </motion.div>
  );
}

// ── Trust stat pill ───────────────────────────────────────────────────────────

function TrustPill({
  icon: Icon, value, label, color, delay = 0,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  value: string; label: string; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay }}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 14px', borderRadius: 100,
        background: 'rgba(255,255,255,0.80)',
        border: '1px solid rgba(255,255,255,0.95)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 7,
        background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={12} color={color} strokeWidth={2.5} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#6E6E73', letterSpacing: '0.03em', textTransform: 'uppercase', marginTop: 1 }}>{label}</div>
      </div>
    </motion.div>
  );
}

// ── Channel card ──────────────────────────────────────────────────────────────

function ChannelCard({
  icon: Icon, title, desc, meta, href, color, glow, badge, delay = 0,
}: {
  icon:  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string; desc: string; meta: string; href: string;
  color: string; glow: string; badge?: string; delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <motion.a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        whileHover={{ y: -4, boxShadow: `0 16px 40px ${glow}, 0 4px 14px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)` }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          padding: '22px 22px 18px',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.92)',
          boxShadow: `0 4px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)`,
          textDecoration: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 2, borderRadius: '0 0 2px 2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

        {badge && (
          <div style={{
            position: 'absolute', top: 14, right: 14,
            fontSize: 9, fontWeight: 800, color,
            background: `${color}12`, border: `1px solid ${color}25`,
            borderRadius: 6, padding: '2px 7px', letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>{badge}</div>
        )}

        <div style={{
          width: 42, height: 42, borderRadius: 13,
          background: `${color}10`, border: `1.5px solid ${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 14px ${glow}`,
        }}>
          <Icon size={18} color={color} strokeWidth={2} />
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em', marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: '#6E6E73', lineHeight: 1.5, letterSpacing: '-0.01em' }}>
            {desc}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color, letterSpacing: '-0.01em' }}>{meta}</span>
          <ExternalLink size={12} color={color} strokeWidth={2} />
        </div>
      </motion.a>
    </Reveal>
  );
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'How do I get started with my first trip?',
    a: 'Click "Build a trip" on the home screen and follow the 4-step setup wizard. In under 60 seconds you\'ll have dates, a budget, and a full timeline scaffold. Then ask the AI concierge to fill in flights, hotels and dining.',
  },
  {
    q: 'How does the AI concierge work?',
    a: 'Unit is powered by Claude (Anthropic) and has real-time access to live flight prices, hotel availability, and restaurant data. It understands your Travel DNA — your pace, budget, and vibe — and curates options personalized to you.',
  },
  {
    q: 'Which travel engines and APIs does Unitravel use?',
    a: 'We connect to Amadeus (flights + hotels), Frankfurter (currency rates), Open-Meteo (real-time weather forecasts) and several hospitality data providers. Our pipeline aggregates and ranks results so you always see the best options.',
  },
  {
    q: 'Is my trip data private and secure?',
    a: 'Yes. All trip data is stored locally in your browser using encrypted storage. We never sell your data to third parties. AI conversations are processed by Anthropic\'s API and not retained beyond the session.',
  },
  {
    q: 'Can I export my itinerary to Google Calendar or Apple Calendar?',
    a: 'Yes. Open the Timeline tab in your trip, then tap the .ics button in the header. This downloads a calendar file compatible with Google Calendar, Apple Calendar, and Outlook.',
  },
  {
    q: 'How does real-time pricing and the Price Watch work?',
    a: 'Price Watch monitors the flights and hotels you\'ve viewed and alerts you if prices drop. Activate it by tapping the watch icon on any flight or hotel card.',
  },
  {
    q: 'Does Unitravel support group and family trip planning?',
    a: 'Yes. During setup, add all traveler names. The Omni Ledger will automatically split the budget per person and show each traveler\'s share. Collaborative real-time editing is on our roadmap.',
  },
  {
    q: 'What\'s the difference between the free plan and Premium?',
    a: 'The free plan includes full trip planning, AI conversations, and timeline management. Premium unlocks priority AI responses, advanced budget analytics, trip templates, and dedicated support with a 2-hour guaranteed SLA.',
  },
];

function FAQItem({ item, index }: { item: typeof FAQ_ITEMS[number]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      style={{
        borderRadius: 16, overflow: 'hidden',
        background: open ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.60)',
        border: `1.5px solid ${open ? 'rgba(0,122,255,0.18)' : 'rgba(255,255,255,0.90)'}`,
        boxShadow: open
          ? '0 4px 20px rgba(0,122,255,0.06), inset 0 1px 0 rgba(255,255,255,0.95)'
          : '0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.90)',
        transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ background: open ? 'transparent' : 'rgba(255,255,255,0.30)' }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', gap: 12, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: open ? AZURE : '#1D1D1F', letterSpacing: '-0.02em', flex: 1 }}>
          {item.q}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ flexShrink: 0 }}
        >
          <ChevronDown size={15} color={open ? AZURE : '#8E8E93'} strokeWidth={2.5} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 18px 16px',
              fontSize: 12.5, fontWeight: 450, color: '#3C3C43',
              lineHeight: 1.7, letterSpacing: '-0.01em',
              borderTop: '1px solid rgba(0,122,255,0.08)', paddingTop: 12,
            }}>
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Subject types ─────────────────────────────────────────────────────────────

const SUBJECTS = [
  { id: 'general',     label: 'General inquiry',   icon: HelpCircle,   color: AZURE,   extra: null },
  { id: 'bug',         label: 'Bug report',         icon: Bug,          color: '#FF453A', extra: 'browser' },
  { id: 'feature',     label: 'Feature request',    icon: Sparkles,     color: INDIGO,  extra: 'priority' },
  { id: 'partnership', label: 'Partnership',         icon: Handshake,    color: AMBER,   extra: 'company' },
  { id: 'api',         label: 'API / Developer',    icon: Code2,        color: VIOLET,  extra: null },
  { id: 'premium',     label: 'Premium support',    icon: HeadphonesIcon, color: EMERALD, extra: null },
];

// ── Contact form ──────────────────────────────────────────────────────────────

type FormStatus = 'idle' | 'sending' | 'success' | 'error';

function ContactForm() {
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [subject,   setSubject]   = useState('');
  const [message,   setMessage]   = useState('');
  const [extra,     setExtra]     = useState('');
  const [urgent,    setUrgent]    = useState(false);
  const [fileName,  setFileName]  = useState<string | null>(null);
  const [status,    setStatus]    = useState<FormStatus>('idle');
  const [touched,   setTouched]   = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const subjectObj  = SUBJECTS.find(s => s.id === subject);
  const subjectColor = subjectObj?.color ?? AZURE;

  const nameErr  = touched.name  && name.trim().length < 2;
  const emailErr = touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const msgErr   = touched.msg   && message.trim().length < 20;

  const canSubmit = name.trim().length >= 2
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && subject
    && message.trim().length >= 20
    && (status === 'idle' || status === 'error');

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, extra, urgent }),
      });
      if (!res.ok) throw new Error('server error');
      setStatus('success');
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3500);
    }
  }, [canSubmit, name, email, subject, message, extra, urgent]);

  // ── Success state
  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ ...SPRING }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 16, padding: '48px 32px', textAlign: 'center',
          borderRadius: 28,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(48px) saturate(180%)',
          border: '1.5px solid rgba(48,209,88,0.28)',
          boxShadow: '0 8px 40px rgba(48,209,88,0.10), inset 0 1px 0 rgba(255,255,255,1)',
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 22, delay: 0.1 }}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(48,209,88,0.15), rgba(48,209,88,0.06))',
            border: '2px solid rgba(48,209,88,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 24px rgba(48,209,88,0.20)',
          }}
        >
          <Check size={28} color={EMERALD} strokeWidth={2.5} />
        </motion.div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.035em', marginBottom: 6 }}>
            Message sent!
          </div>
          <div style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.65, maxWidth: 280 }}>
            We&apos;ve received your message and will reply to <strong style={{ color: '#1D1D1F' }}>{email}</strong> within{' '}
            <span style={{ color: EMERALD, fontWeight: 700 }}>{urgent ? '1 hour' : '2 hours'}</span>.
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => { setStatus('idle'); setName(''); setEmail(''); setSubject(''); setMessage(''); setExtra(''); setTouched({}); }}
          style={{
            padding: '10px 22px', borderRadius: 12,
            background: 'rgba(48,209,88,0.10)', border: '1.5px solid rgba(48,209,88,0.25)',
            fontSize: 12.5, fontWeight: 700, color: EMERALD, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Send another message
        </motion.button>
      </motion.div>
    );
  }

  const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', borderRadius: 13,
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(16px)',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: '#1D1D1F',
    outline: 'none', transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  };

  return (
    <div style={{
      borderRadius: 28, padding: '28px 26px',
      background: 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(48px) saturate(180%)',
      WebkitBackdropFilter: 'blur(48px) saturate(180%)',
      border: `1.5px solid ${status === 'idle' && urgent ? 'rgba(255,159,10,0.28)' : 'rgba(255,255,255,0.92)'}`,
      boxShadow: '0 8px 40px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.97)',
      display: 'flex', flexDirection: 'column', gap: 14,
      transition: 'border-color 0.2s ease',
    }}>

      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em' }}>
          Send us a message
        </div>
        <div style={{ fontSize: 11.5, color: '#6E6E73', marginTop: 3, fontWeight: 500 }}>
          All fields required unless marked optional
        </div>
      </div>

      {/* Name + Email row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
            Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, name: true }))}
            placeholder="Your full name"
            style={{
              ...inputBase,
              border: `1.5px solid ${nameErr ? '#FF453A' : name ? 'rgba(0,122,255,0.28)' : 'rgba(0,0,0,0.10)'}`,
              boxShadow: nameErr ? '0 0 0 3px rgba(255,69,58,0.08)' : name ? '0 0 0 3px rgba(0,122,255,0.06)' : 'none',
            }}
          />
          {nameErr && (
            <span style={{ fontSize: 10, color: '#FF453A', marginTop: 3, display: 'block', fontWeight: 600 }}>
              Please enter your name
            </span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            placeholder="you@example.com"
            style={{
              ...inputBase,
              border: `1.5px solid ${emailErr ? '#FF453A' : email ? 'rgba(0,122,255,0.28)' : 'rgba(0,0,0,0.10)'}`,
              boxShadow: emailErr ? '0 0 0 3px rgba(255,69,58,0.08)' : email ? '0 0 0 3px rgba(0,122,255,0.06)' : 'none',
            }}
          />
          {emailErr && (
            <span style={{ fontSize: 10, color: '#FF453A', marginTop: 3, display: 'block', fontWeight: 600 }}>
              Enter a valid email address
            </span>
          )}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 800, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
          Subject
        </label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {SUBJECTS.map(s => {
            const active = subject === s.id;
            const SIcon = s.icon;
            return (
              <motion.button
                key={s.id}
                onClick={() => { setSubject(s.id); setExtra(''); }}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? `${s.color}12` : 'rgba(0,0,0,0.04)',
                  border: `1.5px solid ${active ? `${s.color}35` : 'rgba(0,0,0,0.08)'}`,
                  boxShadow: active ? `0 0 12px ${s.color}18` : 'none',
                  transition: 'all 0.16s ease',
                }}
              >
                <SIcon size={11} color={active ? s.color : '#6E6E73'} strokeWidth={2} />
                <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? s.color : '#3C3C43', letterSpacing: '-0.01em' }}>
                  {s.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Adaptive extra field */}
      <AnimatePresence>
        {subjectObj?.extra && (
          <motion.div
            key={subjectObj.extra}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {subjectObj.extra === 'browser' && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Browser / device <span style={{ fontWeight: 400, color: '#AEAEB2', textTransform: 'none' }}>(optional)</span>
                </label>
                <select
                  value={extra} onChange={e => setExtra(e.target.value)}
                  style={{ ...inputBase, border: '1.5px solid rgba(0,0,0,0.10)', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select your browser</option>
                  <option value="chrome">Chrome</option>
                  <option value="safari">Safari</option>
                  <option value="firefox">Firefox</option>
                  <option value="edge">Edge</option>
                  <option value="mobile">Mobile (iOS / Android)</option>
                </select>
              </div>
            )}
            {subjectObj.extra === 'company' && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Company <span style={{ fontWeight: 400, color: '#AEAEB2', textTransform: 'none' }}>(optional)</span>
                </label>
                <input
                  value={extra} onChange={e => setExtra(e.target.value)}
                  placeholder="Your company or organisation"
                  style={{ ...inputBase, border: '1.5px solid rgba(0,0,0,0.10)' }}
                />
              </div>
            )}
            {subjectObj.extra === 'priority' && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                  Feature priority
                </label>
                <div style={{ display: 'flex', gap: 7 }}>
                  {[
                    { id: 'nice',      label: 'Nice to have', color: EMERALD },
                    { id: 'important', label: 'Important',    color: AZURE   },
                    { id: 'critical',  label: 'Critical',     color: AMBER   },
                  ].map(p => (
                    <motion.button
                      key={p.id}
                      onClick={() => setExtra(p.id)}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                        background: extra === p.id ? `${p.color}12` : 'rgba(0,0,0,0.04)',
                        border: `1.5px solid ${extra === p.id ? `${p.color}30` : 'rgba(0,0,0,0.08)'}`,
                        fontSize: 11, fontWeight: extra === p.id ? 700 : 500,
                        color: extra === p.id ? p.color : '#6E6E73', transition: 'all 0.16s ease',
                      }}
                    >
                      {p.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Priority toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>Urgent request</div>
          <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500 }}>Flag for 1-hour response (Premium)</div>
        </div>
        <motion.button
          onClick={() => setUrgent(v => !v)}
          whileTap={{ scale: 0.92 }}
          style={{
            width: 44, height: 26, borderRadius: 100, border: 'none', cursor: 'pointer', padding: 0,
            background: urgent ? AMBER : 'rgba(0,0,0,0.10)',
            boxShadow: urgent ? `0 2px 10px rgba(255,159,10,0.30)` : 'none',
            transition: 'background 0.22s ease, box-shadow 0.22s ease', position: 'relative',
          }}
        >
          <motion.div
            animate={{ x: urgent ? 20 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            style={{
              position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            }}
          />
        </motion.button>
      </div>

      {/* Message */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Message
          </label>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: message.length > 1800 ? '#FF453A' : message.length > 20 ? EMERALD : '#AEAEB2',
          }}>
            {message.length}/2000
          </span>
        </div>
        <textarea
          value={message}
          onChange={e => { if (e.target.value.length <= 2000) setMessage(e.target.value); }}
          onBlur={() => setTouched(t => ({ ...t, msg: true }))}
          placeholder="Describe your question or issue in detail — the more context, the better we can help…"
          rows={5}
          style={{
            ...inputBase, resize: 'vertical', lineHeight: 1.65, minHeight: 110,
            border: `1.5px solid ${msgErr ? '#FF453A' : message.length > 20 ? 'rgba(0,122,255,0.28)' : 'rgba(0,0,0,0.10)'}`,
            boxShadow: msgErr ? '0 0 0 3px rgba(255,69,58,0.08)' : message.length > 20 ? '0 0 0 3px rgba(0,122,255,0.06)' : 'none',
          }}
        />
        {msgErr && (
          <span style={{ fontSize: 10, color: '#FF453A', marginTop: 3, display: 'block', fontWeight: 600 }}>
            Message must be at least 20 characters
          </span>
        )}
      </div>

      {/* Attachment */}
      <div>
        <input type="file" ref={fileRef} onChange={e => setFileName(e.target.files?.[0]?.name ?? null)} style={{ display: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 9,
              background: 'rgba(0,0,0,0.04)', border: '1.5px dashed rgba(0,0,0,0.12)',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 600, color: '#6E6E73', transition: 'all 0.15s ease',
            }}
          >
            <Paperclip size={11} strokeWidth={2} />
            Attach file
            <span style={{ color: '#AEAEB2', fontWeight: 400 }}>(optional)</span>
          </motion.button>
          {fileName && (
            <motion.div
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: AZURE, fontWeight: 600 }}
            >
              <span>{fileName}</span>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => { setFileName(null); if (fileRef.current) fileRef.current.value = ''; }}
                style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={11} color="#AEAEB2" strokeWidth={2.5} />
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Submit */}
      <motion.button
        onClick={handleSubmit}
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.02, y: -1 } : {}}
        whileTap={canSubmit ? { scale: 0.97 } : {}}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px', borderRadius: 14, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 800, letterSpacing: '-0.015em',
          background: canSubmit
            ? urgent
              ? `linear-gradient(135deg, ${AMBER}, #FF6B0A)`
              : `linear-gradient(135deg, ${AZURE}, ${INDIGO})`
            : 'rgba(0,0,0,0.07)',
          color: canSubmit ? '#fff' : '#AEAEB2',
          boxShadow: canSubmit
            ? urgent
              ? '0 4px 18px rgba(255,159,10,0.36)'
              : '0 4px 18px rgba(0,122,255,0.32)'
            : 'none',
          transition: 'all 0.2s ease',
          marginTop: 4,
        }}
      >
        {status === 'sending' ? (
          <>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-flex' }}
            >
              <Loader2 size={16} strokeWidth={2.5} />
            </motion.span>
            {' '}Sending…
          </>
        ) : status === 'error' ? (
          <><AlertTriangle size={15} strokeWidth={2.5} /> Failed — please try again</>
        ) : (
          <><Send size={15} strokeWidth={2.5} /> {urgent ? 'Send urgent message' : 'Send message'}</>
        )}
      </motion.button>
    </div>
  );
}

// ── Team avatars ──────────────────────────────────────────────────────────────

const TEAM = [
  { initials: 'EG', color: AZURE },
  { initials: 'TM', color: INDIGO },
  { initials: 'SR', color: VIOLET },
  { initials: 'AL', color: EMERALD },
  { initials: 'NO', color: AMBER },
];

function TeamCard() {
  return (
    <div style={{
      padding: '18px 20px', borderRadius: 20,
      background: 'rgba(255,255,255,0.78)',
      border: '1.5px solid rgba(255,255,255,0.92)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.97)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex' }}>
          {TEAM.map((m, i) => (
            <div
              key={m.initials}
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: `${m.color}15`, border: `2.5px solid #fff`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 800, color: m.color, letterSpacing: '-0.01em',
                marginLeft: i > 0 ? -10 : 0,
                boxShadow: `0 2px 8px rgba(0,0,0,0.10)`,
              }}
            >
              {m.initials}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
            Meet the team
          </div>
          <div style={{ fontSize: 10.5, color: '#6E6E73', fontWeight: 500, marginTop: 1 }}>
            12 people · Tel Aviv &amp; remote
          </div>
        </div>
      </div>

      {/* Office hours */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[
          { day: 'Mon – Fri', hours: '9:00 – 21:00 IST', active: true },
          { day: 'Sat',       hours: '10:00 – 16:00 IST', active: false },
          { day: 'Sun',       hours: 'Closed (AI always on)', active: false },
        ].map(h => (
          <div key={h.day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: h.active ? '#1D1D1F' : '#8E8E93', letterSpacing: '-0.01em' }}>{h.day}</span>
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: h.active ? EMERALD : '#AEAEB2',
              background: h.active ? 'rgba(48,209,88,0.09)' : 'transparent',
              padding: h.active ? '2px 8px' : '0',
              borderRadius: 6,
            }}>{h.hours}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContactPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse at 12% 18%,  rgba(0,122,255,0.11)  0%, transparent 55%),
        radial-gradient(ellipse at 88% 15%,  rgba(94,92,230,0.09)  0%, transparent 52%),
        radial-gradient(ellipse at 50% 90%,  rgba(90,200,250,0.08) 0%, transparent 55%),
        radial-gradient(ellipse at 82% 78%,  rgba(191,90,242,0.07) 0%, transparent 50%),
        linear-gradient(148deg, #F8F9FF 0%, #EEF2FF 26%, #F4F1FF 55%, #EDF5FF 100%)
      `,
      fontFamily: 'var(--font-inter, Inter, -apple-system, BlinkMacSystemFont, sans-serif)',
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* ── Fixed glass navbar ────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.05 }}
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 max(24px, calc(50vw - 580px))',
          height: 56,
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          borderBottom: '1px solid rgba(255,255,255,0.92)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <motion.div
            whileHover={{ x: -2 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 9,
              background: 'linear-gradient(135deg, #007AFF, #5E5CE6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,122,255,0.28)',
            }}>
              <ArrowLeft size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
              Unitravel
            </span>
          </motion.div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[
            { label: 'Docs',      href: '#faq'  },
            { label: 'Status',    href: '#status' },
            { label: 'Community', href: 'https://discord.gg/unitravel' },
          ].map(l => (
            <motion.a
              key={l.label}
              href={l.href}
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
              style={{
                padding: '5px 11px', borderRadius: 9,
                fontSize: 12.5, fontWeight: 600, color: '#3C3C43',
                textDecoration: 'none', cursor: 'pointer', letterSpacing: '-0.01em',
                transition: 'background 0.15s ease',
              }}
            >
              {l.label}
            </motion.a>
          ))}
        </div>
      </motion.nav>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section style={{ textAlign: 'center', padding: '64px 0 48px' }}>
          <StatusBadge />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SLOW, delay: 0.18 }}
            style={{
              margin: '20px 0 12px',
              fontSize: 'clamp(38px, 5vw, 60px)',
              fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.06,
              background: 'linear-gradient(140deg, #0F172A 0%, #1E293B 18%, #2563EB 42%, #7C3AED 68%, #9333EA 86%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            We&apos;re here for you
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SLOW, delay: 0.28 }}
            style={{
              fontSize: 17, fontWeight: 400, color: '#48484A',
              lineHeight: 1.65, maxWidth: 480, margin: '0 auto 28px',
              letterSpacing: '-0.015em',
            }}
          >
            Questions, feedback, or need help with your trip? Our team responds within 2 hours during business hours.
          </motion.p>

          {/* Trust pills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.36 }}
            style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}
          >
            <TrustPill icon={Clock}  value="~2h"      label="Avg reply"   color={AZURE}   delay={0.40} />
            <TrustPill icon={Star}   value="4.9★"     label="Satisfaction" color={AMBER}  delay={0.46} />
            <TrustPill icon={Shield} value="100%"     label="Private"     color={INDIGO}  delay={0.52} />
            <TrustPill icon={Users}  value="14k+"     label="Trips helped" color={EMERALD} delay={0.58} />
          </motion.div>
        </section>

        {/* ── Contact channels ──────────────────────────────────────────── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 48 }}>
          <ChannelCard
            icon={Mail}
            title="Email support"
            desc="Send us a detailed message and we'll reply with a tailored answer."
            meta="hello@unitravel.app"
            href="mailto:hello@unitravel.app"
            color={AZURE}
            glow="rgba(0,122,255,0.14)"
            delay={0}
          />
          <ChannelCard
            icon={MessageCircle}
            title="Live chat"
            desc="Chat with the AI concierge for instant help — or escalate to a human."
            meta="Open in app →"
            href="/zone/management"
            color={INDIGO}
            glow="rgba(94,92,230,0.14)"
            badge="In-app"
            delay={0.07}
          />
          <ChannelCard
            icon={Users}
            title="Community"
            desc="Join 3,000+ travellers and the core team on our Discord server."
            meta="discord.gg/unitravel"
            href="https://discord.gg/unitravel"
            color={VIOLET}
            glow="rgba(191,90,242,0.14)"
            badge="Live"
            delay={0.14}
          />
        </section>

        {/* ── Main 2-col: form + faq ─────────────────────────────────────── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 24, alignItems: 'start' }}>

          {/* LEFT: Form */}
          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>

          {/* RIGHT: FAQ + team */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* FAQ header */}
            <Reveal delay={0.18}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  background: `${AZURE}10`, border: `1px solid ${AZURE}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <BookOpen size={13} color={AZURE} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>Frequently asked</div>
                  <div style={{ fontSize: 10.5, color: '#6E6E73', fontWeight: 500 }}>Quick answers to common questions</div>
                </div>
              </div>
            </Reveal>

            {/* FAQ items */}
            <div id="faq" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {FAQ_ITEMS.map((item, i) => (
                <Reveal key={i} delay={0.20 + i * 0.04}>
                  <FAQItem item={item} index={i} />
                </Reveal>
              ))}
            </div>

            {/* Team card */}
            <Reveal delay={0.62}>
              <TeamCard />
            </Reveal>
          </div>
        </section>

        {/* ── System status strip ───────────────────────────────────────── */}
        <Reveal delay={0.1} y={10}>
          <section
            id="status"
            style={{
              marginTop: 56,
              padding: '16px 24px',
              borderRadius: 18,
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.90)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
            }}
          >
            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: EMERALD, boxShadow: `0 0 10px ${EMERALD}` }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>All systems operational</span>
              </div>
              <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)' }} />
              {['API', 'AI Concierge', 'Flights', 'Bookings'].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: EMERALD }} />
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6E6E73' }}>{s}</span>
                </div>
              ))}
            </div>

            {/* Social links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[
                { icon: MessageCircle, href: 'https://discord.gg/unitravel', label: 'Discord' },
                { icon: Mail,  href: 'mailto:hello@unitravel.app', label: 'Email' },
                { icon: Globe, href: '/',                               label: 'Website' },
              ].map(({ icon: SIcon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.12, backgroundColor: 'rgba(0,0,0,0.06)' }}
                  whileTap={{ scale: 0.92 }}
                  title={label}
                  style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: 'rgba(0,0,0,0.04)',
                    border: '1px solid rgba(0,0,0,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'background 0.15s ease',
                    textDecoration: 'none',
                  }}
                >
                  <SIcon size={14} color="#6E6E73" strokeWidth={1.75} />
                </motion.a>
              ))}
              <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', marginInline: 2 }} />
              <Link href="/" style={{ fontSize: 11.5, fontWeight: 600, color: '#8E8E93', textDecoration: 'none', letterSpacing: '-0.01em' }}>
                Privacy
              </Link>
              <span style={{ fontSize: 10, color: '#C7C7CC' }}>·</span>
              <Link href="/" style={{ fontSize: 11.5, fontWeight: 600, color: '#8E8E93', textDecoration: 'none', letterSpacing: '-0.01em' }}>
                Terms
              </Link>
              <span style={{ fontSize: 10, color: '#C7C7CC' }}>·</span>
              <span style={{ fontSize: 11, color: '#AEAEB2', fontWeight: 500 }}>
                © 2026 Unitravel
              </span>
            </div>
          </section>
        </Reveal>
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 820px) {
          section[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 600px) {
          section[style*="repeat(auto-fit"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
        a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
          outline: 2px solid #4F46E5;
          outline-offset: 2px;
          border-radius: 6px;
        }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      `}</style>
    </div>
  );
}
