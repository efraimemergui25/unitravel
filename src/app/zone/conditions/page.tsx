'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  CloudSun, Wind, Droplets, Thermometer, Umbrella,
  Backpack, Pill, DollarSign, Globe2, AlertCircle,
  ShieldCheck, Zap, Wifi, Phone, ChevronDown, ChevronUp,
  RefreshCw, MapPin, Activity, Eye,
  Clock, CreditCard, Car, Camera, Lock,
} from 'lucide-react';
import { useTravelEngine } from '@/store/useTravelEngine';

const SPRING = { type: 'spring', stiffness: 380, damping: 28 } as const;

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, color, icon: Icon, children, defaultOpen = true, loading = false }: {
  title: string; subtitle: string; color: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  children: React.ReactNode; defaultOpen?: boolean; loading?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
      style={{ borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.88)', boxShadow: '0 4px 20px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)' }}
    >
      <motion.button
        type="button"
        onClick={() => setOpen(v => !v)}
        whileHover={{ background: 'rgba(0,0,0,0.018)' }}
        whileTap={{ scale: 0.995 }}
        transition={{ duration: 0.14 }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <motion.div
            animate={{ background: open ? `${color}18` : `${color}12`, borderColor: open ? `${color}32` : `${color}22` }}
            transition={{ duration: 0.18 }}
            style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {loading
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={12} color={color} strokeWidth={2} /></motion.div>
              : <Icon size={13} color={color} strokeWidth={2} />}
          </motion.div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>{title}</div>
            <div style={{ fontSize: 9.5, color: '#6E6E73', fontWeight: 500, letterSpacing: '-0.01em' }}>{subtitle}</div>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
          <ChevronUp size={13} color="#6E6E73" strokeWidth={2} />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '11px 15px 14px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Packing item ──────────────────────────────────────────────────────────────

function PackItem({ label, required }: { label: string; required?: boolean }) {
  // Persist checked state in localStorage so it survives navigation
  const storageKey = `pack:${label}`;
  const [done, setDone] = useState(false);

  // Load from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    try { setDone(localStorage.getItem(storageKey) === '1'); } catch {}
  }, [storageKey]);

  function toggle() {
    setDone(v => {
      const next = !v;
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  return (
    <motion.button onClick={toggle} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', background: done ? 'rgba(48,209,88,0.06)' : required ? 'rgba(255,159,10,0.05)' : 'rgba(0,0,0,0.025)', border: `1px solid ${done ? 'rgba(48,209,88,0.20)' : required ? 'rgba(255,159,10,0.18)' : 'rgba(0,0,0,0.06)'}`, transition: 'all 0.14s ease' }}
    >
      <div style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, background: done ? '#30D158' : 'transparent', border: `2px solid ${done ? '#30D158' : 'rgba(0,0,0,0.18)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.14s ease' }}>
        {done && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><ShieldCheck size={8} color="#fff" strokeWidth={3} /></motion.div>}
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: done ? '#6E6E73' : '#1D1D1F', textDecoration: done ? 'line-through' : 'none', letterSpacing: '-0.01em' }}>{label}</span>
      {required && !done && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#FF9F0A', background: 'rgba(255,159,10,0.10)', padding: '2px 5px', borderRadius: 4, flexShrink: 0 }}>Required</span>}
    </motion.button>
  );
}

// ── Weather component (REAL API) ──────────────────────────────────────────────

interface ForecastDay { date: string; high: number; low: number; rain: number; uv: number; wind: number; label: string; icon: string }
interface WeatherData { city: string; current: { temp: number; wind: number; label: string; icon: string }; humidity: number | null; forecast: ForecastDay[] }

function WeatherSection({ destination }: { destination: string }) {
  const [data,    setData]    = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [city,    setCity]    = useState(destination);
  const [input,   setInput]   = useState(destination);

  const fetch_ = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Not found'); }
      const d   = await res.json();
      setData(d); setCity(d.city);
    } catch (e) {
      if ((e as Error).name === 'AbortError') setError('Request timed out — check your connection and retry');
      else setError(String(e));
    }
    finally { clearTimeout(timer); setLoading(false); }
  }, []);

  useEffect(() => { if (destination) fetch_(destination); }, [destination]); // eslint-disable-line

  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  return (
    <SectionCard title="Weather Forecast" subtitle={data ? `${data.city} · live via Open-Meteo` : 'Real-time data'} color="#007AFF" icon={CloudSun} loading={loading}>
      {/* Search */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 11, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}>
          <MapPin size={12} color="#6E6E73" strokeWidth={2} />
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setCity(input); fetch_(input); } }}
            placeholder="Enter city or destination..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit' }}
          />
        </div>
        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={() => { setCity(input); fetch_(input); }}
          style={{ padding: '7px 14px', borderRadius: 11, background: '#007AFF', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(0,122,255,0.30)' }}
        >Search</motion.button>
      </div>

      {error && (
        <div style={{ padding: '10px 13px', borderRadius: 12, background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.18)', fontSize: 11, color: '#FF453A', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>Could not find weather for <strong>&ldquo;{input}&rdquo;</strong>. Try a city name or airport code (e.g. TLV, Paris, Tokyo).</span>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => fetch_(input)}
            style={{ fontSize: 10, fontWeight: 700, color: '#FF453A', background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.22)', borderRadius: 100, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Retry
          </motion.button>
        </div>
      )}

      {loading && !data && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: '#6E6E73', fontSize: 12 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ marginRight: 8 }}><RefreshCw size={14} color="#007AFF" strokeWidth={2} /></motion.div>
          Fetching live weather…
        </div>
      )}

      {data && (
        <>
          {/* Current */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { icon: Thermometer, label: 'Now',      value: `${data.current.temp}°C  ${data.current.icon}`,  color: '#FF6B6B' },
              { icon: Droplets,   label: 'Humidity',  value: data.humidity != null ? `${data.humidity}%` : '—',color: '#5AC8FA' },
              { icon: Wind,       label: 'Wind',      value: `${data.current.wind} km/h`,                      color: '#007AFF' },
              { icon: Umbrella,   label: 'Rain days',  value: `${data.forecast.filter(d => d.rain > 1).length}/7`, color: '#BF5AF2' },
              { icon: Eye,        label: 'UV (peak)',  value: data.forecast.length ? `${Math.max(...data.forecast.map(d => d.uv))}` : '—',   color: '#FF9F0A' },
            ].map(({ icon: Ic, label, value, color }) => (
              <div key={label} style={{ flex: '1 1 90px', minWidth: 90, padding: '8px 10px', borderRadius: 10, background: `${color}07`, border: `1px solid ${color}16` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <Ic size={10} color={color} strokeWidth={2} />
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: '#6E6E73', letterSpacing: '-0.01em' }}>{label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* 7-day forecast */}
          <div style={{ display: 'flex', gap: 5 }}>
            {data.forecast.map((day, i) => {
              const d = new Date(day.date);
              return (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px', borderRadius: 10, background: i === 0 ? 'rgba(0,122,255,0.07)' : 'rgba(0,0,0,0.03)', border: `1px solid ${i === 0 ? 'rgba(0,122,255,0.18)' : 'rgba(0,0,0,0.06)'}` }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: i === 0 ? '#007AFF' : '#6E6E73' }}>{DAYS[d.getDay()]}</span>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>{day.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1D1D1F' }}>{day.high}°</span>
                  <span style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 500 }}>{day.low}°</span>
                  {day.rain > 1 && <span style={{ fontSize: 9, color: '#5AC8FA', fontWeight: 700 }}>{day.rain.toFixed(0)}mm</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <div style={{ textAlign: 'center', color: '#AEAEB2', fontSize: 11.5, padding: '20px 0' }}>Enter a city to see live weather</div>
      )}
    </SectionCard>
  );
}

// ── Currency component (REAL API) ─────────────────────────────────────────────

const SHOWN_CURRENCIES = ['EUR','GBP','JPY','ILS','AED','THB','SGD','AUD','CAD','MXN','BRL','CHF'];

function CurrencySection() {
  const [rates,    setRates]    = useState<Record<string, number>>({});
  const [base,     setBase]     = useState('USD');
  const [amount,   setAmount]   = useState('100');
  const [updated,  setUpdated]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [fetchErr, setFetchErr] = useState(false);

  const fetchRates = useCallback(async (b: string) => {
    setLoading(true);
    setFetchErr(false);
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const res  = await fetch(`/api/currency?base=${b}`, { signal: ctrl.signal });
      const data = await res.json();
      if (data.rates && Object.keys(data.rates).length > 0) {
        setRates(data.rates);
        setUpdated(data.date);
      } else {
        setFetchErr(true);
      }
    } catch { setFetchErr(true); }
    finally { clearTimeout(timer); setLoading(false); }
  }, []);

  useEffect(() => { fetchRates('USD'); }, []); // eslint-disable-line

  const CURRENCIES_SYMBOLS: Record<string, string> = {
    EUR:'€', GBP:'£', JPY:'¥', ILS:'₪', AED:'د.إ', THB:'฿', SGD:'S$', AUD:'A$', CAD:'C$', MXN:'$', BRL:'R$', CHF:'CHF', USD:'$',
  };

  const NAMES: Record<string, string> = {
    EUR:'Euro', GBP:'Pound', JPY:'Japanese Yen', ILS:'Shekel', AED:'UAE Dirham',
    THB:'Thai Baht', SGD:'Singapore $', AUD:'Australian $', CAD:'Canadian $', MXN:'Mexican Peso', BRL:'Brazilian Real', CHF:'Swiss Franc',
  };

  return (
    <SectionCard title="Currency Converter" subtitle={updated ? `Live ECB rates · updated ${updated}` : 'Loading live rates…'} color="#30D158" icon={DollarSign} loading={loading} defaultOpen={false}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {/* Amount */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 11, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)', flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#30D158', flexShrink: 0 }}>$</span>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 18, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.03em', fontFamily: 'inherit', width: 0 }}
          />
          <select value={base} onChange={e => { setBase(e.target.value); fetchRates(e.target.value); }}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, fontWeight: 700, color: '#6E6E73', fontFamily: 'inherit', cursor: 'pointer' }}>
            {['USD','EUR','GBP','ILS'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => fetchRates(base)}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#30D158', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(48,209,88,0.30)', flexShrink: 0 }}>
          <RefreshCw size={14} color="#fff" strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Error state */}
      {fetchErr && (
        <div style={{ padding: '10px 12px', borderRadius: 11, background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#FF453A' }}>Could not load live rates — using cached values.</span>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => fetchRates(base)}
            style={{ fontSize: 10, fontWeight: 700, color: '#FF453A', background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.22)', borderRadius: 100, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Retry
          </motion.button>
        </div>
      )}

      {/* Skeleton loader */}
      {loading && Object.keys(rates).length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[...Array(6)].map((_, i) => (
            <motion.div key={i} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.08 }}
              style={{ height: 36, borderRadius: 9, background: 'rgba(0,0,0,0.05)' }} />
          ))}
        </div>
      )}

      {/* Rate rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {SHOWN_CURRENCIES.filter(c => rates[c]).map(code => {
          const rate      = rates[code];
          const converted = (parseFloat(amount || '0') * rate).toLocaleString(undefined, { maximumFractionDigits: code === 'JPY' ? 0 : 2 });
          return (
            <div key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 9, background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', minWidth: 32 }}>{code}</span>
                <span style={{ fontSize: 10, color: '#6E6E73' }}>{NAMES[code]}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                  {CURRENCIES_SYMBOLS[code] ?? ''}{converted}
                </span>
                <span style={{ fontSize: 9, color: '#AEAEB2', marginLeft: 5 }}>@ {rate.toFixed(4)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConditionsPage() {
  const trip = useTravelEngine(s => s.trip);
  const days = useTravelEngine(s => s.days);

  const destinations = [...new Set(days.map(d => d.destination))].filter(Boolean);
  const primaryDest  = destinations[0] ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.04 }}
        style={{ margin: '0 12px', flexShrink: 0, borderRadius: 20, padding: '13px 16px', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(48px) saturate(180%)', WebkitBackdropFilter: 'blur(48px) saturate(180%)', border: '1px solid rgba(255,255,255,0.92)', boxShadow: '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #FF9F0A, #FF6B6B)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(255,159,10,0.32)' }}>
            <CloudSun size={15} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em', lineHeight: 1.1 }}>Conditions & Recommendations</div>
            <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 1, letterSpacing: '-0.01em', fontWeight: 500 }}>
              Live weather · Packing · Health · Real-time currency · Connectivity
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 100, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#30D158' }} />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#30D158' }}>Live data</span>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="scroll-fade" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '10px 12px 28px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent', display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* No-trip nudge: only visible when trip hasn't been set up yet */}
        {!trip.title && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            style={{
              borderRadius: 16, padding: '13px 15px',
              background: 'rgba(0,122,255,0.06)',
              border: '1px dashed rgba(0,122,255,0.28)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <MapPin size={14} color="#007AFF" strokeWidth={2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                Set your destination for live weather
              </div>
              <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 2 }}>
                Configure your trip in Setup to auto-load conditions
              </div>
            </div>
            <a href="/zone/flights" style={{ textDecoration: 'none' }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#007AFF',
                background: 'rgba(0,122,255,0.10)', border: '1px solid rgba(0,122,255,0.22)',
                borderRadius: 8, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                Start building
              </div>
            </a>
          </motion.div>
        )}

        <WeatherSection destination={primaryDest} />
        <CurrencySection />

        {/* Packing */}
        <SectionCard title="Smart Packing List" subtitle="AI-generated for your destination" color="#30D158" icon={Backpack}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { cat: 'Documents', items: [['Passport (6+ months validity)', true], ['Travel insurance', true], ['Visa / entry permit', true], ['Flight + hotel confirmations', false], ['Emergency contacts note', false]] },
              { cat: 'Clothing',  items: [['Comfortable walking shoes', false], ['Light layers (temperature varies)', false], ['Rain jacket or umbrella', false], ['Sun hat + sunglasses', false]] },
              { cat: 'Health',    items: [['SPF 50+ sunscreen', true], ['Required prescription meds', true], ['Basic first aid kit', false], ['Insect repellent', false]] },
              { cat: 'Tech',      items: [['Universal power adapter', true], ['Portable charger / power bank', false], ['Offline maps downloaded', false], ['Earphones / noise-cancelling', false]] },
            ].map(({ cat, items }) => (
              <div key={cat}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#AEAEB2', letterSpacing: '0.07em', textTransform: 'uppercase', margin: '8px 0 5px' }}>{cat}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map(([label, req]) => <PackItem key={String(label)} label={String(label)} required={Boolean(req)} />)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Health */}
        <SectionCard title="Health & Safety" subtitle="Advisories · Emergency contacts" color="#FF453A" icon={Pill} defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { label: 'Recommended vaccines',    value: 'Hepatitis A/B, Typhoid, routine MMR', urgent: false },
              { label: 'Food/water safety',       value: 'Drink bottled/filtered water — verify locally', urgent: true },
              { label: 'Travel advisory level',   value: 'Check travel.state.gov for your destination', urgent: false },
              { label: 'Emergency number',        value: '112 (Europe) · 911 (Americas) · 999 (UK/Asia)', urgent: false },
              { label: 'Travel health resource',  value: 'CDC Travelers Health: wwwnc.cdc.gov/travel', urgent: false },
            ].map(({ label, value, urgent }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 10px', borderRadius: 9, background: urgent ? 'rgba(255,69,58,0.05)' : 'rgba(0,0,0,0.025)', border: `1px solid ${urgent ? 'rgba(255,69,58,0.16)' : 'rgba(0,0,0,0.06)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {urgent && <AlertCircle size={10} color="#FF453A" strokeWidth={2} />}
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: urgent ? '#FF453A' : '#6E6E73', letterSpacing: '-0.01em' }}>{label}</span>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em', textAlign: 'right', maxWidth: '52%' }}>{value}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Connectivity */}
        <SectionCard title="Connectivity & Power" subtitle="SIM · eSIM · WiFi · Adapters" color="#5AC8FA" icon={Wifi} defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { icon: Wifi,   label: 'Local SIM (best value)',   detail: 'eSIM via Airalo or HolaFly — 10GB from ~$15', color: '#5AC8FA' },
              { icon: Globe2, label: 'International roaming',    detail: 'Ask carrier — typically $10–15/day roaming pass', color: '#007AFF' },
              { icon: Phone,  label: 'Free WiFi availability',   detail: 'Hotels, airports, most cafés. Use VPN for security.', color: '#30D158' },
              { icon: Zap,    label: 'Power socket & voltage',   detail: 'Check sockettype.com for your destination country', color: '#FF9F0A' },
            ].map(({ icon: Ic, label, detail, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 10px', borderRadius: 9, background: `${color}06`, border: `1px solid ${color}14` }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ic size={11} color={color} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>{label}</div>
                  <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 2 }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Local tips */}
        <SectionCard title="Local Intelligence" subtitle="Customs · Tipping · Transport" color="#BF5AF2" icon={Activity} defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {([
              { Icon: Clock,      tip: 'Arrive at top attractions 30 mins before opening to avoid peak crowds (10am–3pm).' },
              { Icon: CreditCard, tip: 'Inform your bank before traveling. Get some local cash for markets and small vendors.' },
              { Icon: DollarSign, tip: "Tipping varies by region — research your specific destination's customs." },
              { Icon: Car,        tip: 'Use official taxis or Uber/Bolt apps to avoid overcharging.' },
              { Icon: Globe2,     tip: 'Download Google Translate offline pack before you go.' },
              { Icon: Camera,     tip: 'Always ask permission before photographing people, especially in religious sites.' },
              { Icon: Lock,       tip: 'Keep digital copies of all documents in a secure cloud folder.' },
            ] as Array<{ Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; tip: string }>).map(({ Icon, tip }) => (
              <div key={tip.slice(0, 20)} style={{ fontSize: 11, lineHeight: 1.55, color: '#3C3C43', letterSpacing: '-0.01em', padding: '8px 10px', borderRadius: 9, background: 'rgba(191,90,242,0.04)', border: '1px solid rgba(191,90,242,0.09)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(191,90,242,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Icon size={11} color="#BF5AF2" strokeWidth={2} />
                </div>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>
    </div>
  );
}
