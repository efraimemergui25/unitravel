'use client';

/**
 * DestinationIntel — rich destination intelligence card.
 * Shown when a city is entered in the flights zone or onboarding.
 * Displays: best season, cost level, currency, weather snapshot,
 * local tips, and travel advisory level.
 * Real weather from Open-Meteo (free, no key).
 */

import { useState, useEffect }     from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Cloud, CloudRain, Thermometer, DollarSign,
  TrendingUp, Shield, Info, X,
} from 'lucide-react';

// ── Destination dataset ───────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface DestData {
  flag:       string;
  country:    string;
  tags:       string[];
  bestMonths: number[];   // 0-indexed
  peakMonths: number[];
  costLevel:  0 | 1 | 2 | 3;
  currency:   string;
  timezone:   string;
  lat:        number;
  lon:        number;
  tips:       string[];
  advisory:   0 | 1 | 2;  // 0=clear 1=exercise caution 2=reconsider
}

const DESTINATIONS: Record<string, DestData> = {
  'paris':       { flag:'🇫🇷', country:'France',      tags:['Romance','Art','Cuisine','Fashion'],       bestMonths:[3,4,5,8,9],   peakMonths:[6,7],  costLevel:2, currency:'EUR', timezone:'CET',  lat:48.86, lon:2.35,  tips:['Metro is the fastest way around','Museum Pass saves money','Book restaurants 2+ weeks ahead'],    advisory:0 },
  'rome':        { flag:'🇮🇹', country:'Italy',       tags:['History','Architecture','Food','Culture'],  bestMonths:[3,4,5,9,10],  peakMonths:[6,7,8],costLevel:1, currency:'EUR', timezone:'CET',  lat:41.90, lon:12.48, tips:['Validate metro tickets before boarding','Skip queues at Vatican with advance booking','Eat dinner after 8pm like locals'], advisory:0 },
  'tokyo':       { flag:'🇯🇵', country:'Japan',       tags:['Tech','Culture','Food','Anime'],            bestMonths:[2,3,9,10],    peakMonths:[3,4,7,8],costLevel:1,currency:'JPY', timezone:'JST',  lat:35.69, lon:139.69,tips:['Get a Suica card on arrival','Vending machines everywhere','Cash is still widely used'],          advisory:0 },
  'bali':        { flag:'🇮🇩', country:'Indonesia',   tags:['Beaches','Wellness','Temples','Nature'],    bestMonths:[3,4,5,6,8],   peakMonths:[7],    costLevel:0, currency:'IDR', timezone:'WITA', lat:-8.34, lon:115.09,tips:['Rent a scooter to explore','Respect temple dress codes','Visit rice terraces in the morning'],      advisory:0 },
  'new york':    { flag:'🇺🇸', country:'United States',tags:['Culture','Food','Shopping','Urban'],      bestMonths:[3,4,5,8,9,10],peakMonths:[6,7,11],costLevel:3, currency:'USD', timezone:'EST',  lat:40.71, lon:-74.01,tips:['MetroCard for subway','Free museums on Fri evenings','Book Broadway 6+ weeks ahead'],              advisory:0 },
  'barcelona':   { flag:'🇪🇸', country:'Spain',       tags:['Beach','Architecture','Nightlife','Food'], bestMonths:[4,5,9,10],    peakMonths:[6,7,8],costLevel:1, currency:'EUR', timezone:'CET',  lat:41.39, lon:2.15,  tips:['Sagrada Família requires advance tickets','Dinner is never before 9pm','Watch for pickpockets on La Rambla'], advisory:0 },
  'london':      { flag:'🇬🇧', country:'UK',          tags:['Museums','Theatre','History','Culture'],   bestMonths:[4,5,6,7,8],   peakMonths:[7,8,11],costLevel:2, currency:'GBP', timezone:'GMT',  lat:51.51, lon:-0.12, tips:['Oyster card for tube','Most major museums are free','Pubs close at 11pm'],                        advisory:0 },
  'dubai':       { flag:'🇦🇪', country:'UAE',         tags:['Luxury','Desert','Shopping','Architecture'],bestMonths:[10,11,0,1,2],peakMonths:[11,0], costLevel:2, currency:'AED', timezone:'GST',  lat:25.20, lon:55.27, tips:['Dress modestly in public','Alcohol only in licensed venues','Metro is excellent and cheap'],       advisory:0 },
  'bangkok':     { flag:'🇹🇭', country:'Thailand',    tags:['Street Food','Temples','Nightlife','Spas'],bestMonths:[10,11,0,1,2], peakMonths:[11,0,1],costLevel:0, currency:'THB', timezone:'ICT',  lat:13.76, lon:100.50,tips:['Negotiate tuk-tuk fares first','Wai greeting appreciated','Carry small bills for street food'],     advisory:0 },
  'sydney':      { flag:'🇦🇺', country:'Australia',   tags:['Beaches','Nature','Urban','Wildlife'],     bestMonths:[8,9,10,11,0,1],peakMonths:[11,0],costLevel:2, currency:'AUD', timezone:'AEST', lat:-33.87, lon:151.21,tips:['Opal card for transit','BYO restaurants save money','Sunscreen is non-negotiable'],              advisory:0 },
  'amsterdam':   { flag:'🇳🇱', country:'Netherlands', tags:['Canals','Museums','Cycling','Coffee'],     bestMonths:[3,4,5,6,7,8], peakMonths:[6,7],  costLevel:2, currency:'EUR', timezone:'CET',  lat:52.38, lon:4.90,  tips:['Rent a bike to explore','I Amsterdam card for museums','Book Anne Frank House months ahead'],       advisory:0 },
  'lisbon':      { flag:'🇵🇹', country:'Portugal',    tags:['Culture','Seafood','Views','Fado'],        bestMonths:[3,4,5,8,9],   peakMonths:[6,7,8],costLevel:1, currency:'EUR', timezone:'WET',  lat:38.72, lon:-9.14, tips:['Tram 28 is iconic but crowded','Try ginjinha in Alfama','LisboaCard for unlimited transit'],       advisory:0 },
  'madrid':      { flag:'🇪🇸', country:'Spain',       tags:['Art','Cuisine','Nightlife','Football'],   bestMonths:[3,4,5,9,10],  peakMonths:[6,7,8],costLevel:1, currency:'EUR', timezone:'CET',  lat:40.42, lon:-3.70, tips:['Museums free Sunday afternoons','Dinner at 10pm is normal','Mercado de San Miguel for tapas'],     advisory:0 },
  'singapore':   { flag:'🇸🇬', country:'Singapore',   tags:['Food','Gardens','Shopping','Culture'],    bestMonths:[1,2,6,7],     peakMonths:[11,0], costLevel:2, currency:'SGD', timezone:'SGT',  lat:1.35,  lon:103.82,tips:['EZ-Link card for MRT','Hawker centres are world-class food','Changi Airport itself is worth visiting'], advisory:0 },
  'istanbul':    { flag:'🇹🇷', country:'Turkey',      tags:['History','Culture','Food','Bazaars'],     bestMonths:[3,4,5,8,9,10],peakMonths:[6,7,8],costLevel:0, currency:'TRY', timezone:'TRT',  lat:41.01, lon:28.97, tips:['Istanbulkart for all transit','Haggle at Grand Bazaar','Book Hagia Sophia timed entry'],          advisory:1 },
  'tel aviv':    { flag:'🇮🇱', country:'Israel',      tags:['Beach','Nightlife','Food','Tech'],        bestMonths:[3,4,5,9,10,11],peakMonths:[7,8], costLevel:2, currency:'ILS', timezone:'IST',  lat:32.07, lon:34.78, tips:['Carmel Market on Friday mornings','Beach free and open 24/7','Shabbat affects public transport'], advisory:1 },
  'kyoto':       { flag:'🇯🇵', country:'Japan',       tags:['Temples','Tradition','Gardens','Geisha'],  bestMonths:[2,3,10,11],   peakMonths:[3,10], costLevel:1, currency:'JPY', timezone:'JST',  lat:35.01, lon:135.77,tips:['IC card works nationwide','Book ryokan weeks ahead','Arashiyama bamboo grove best at dawn'],       advisory:0 },
  'santorini':   { flag:'🇬🇷', country:'Greece',      tags:['Sunsets','Beaches','Luxury','Views'],     bestMonths:[4,5,6,8,9],   peakMonths:[7,8],  costLevel:2, currency:'EUR', timezone:'EET',  lat:36.39, lon:25.46, tips:['Oia sunset requires arriving 2h early','Donkeys are not the only way up','ATVs good for exploring'], advisory:0 },
  'maldives':    { flag:'🇲🇻', country:'Maldives',    tags:['Diving','Luxury','Overwater','Snorkeling'],bestMonths:[10,11,0,1,2,3],peakMonths:[11,0,1],costLevel:3,currency:'USD', timezone:'MVT',  lat:4.17,  lon:73.51, tips:['Water villas need advance booking','Night diving is magical','Most resorts are all-inclusive'], advisory:0 },
  'miami':       { flag:'🇺🇸', country:'United States',tags:['Beach','Nightlife','Art Deco','Food'],   bestMonths:[10,11,0,1,2,3],peakMonths:[11,0,1],costLevel:2,currency:'USD', timezone:'EST',  lat:25.77, lon:-80.19,tips:['South Beach sunset is unmissable','Art Basel in December is epic','Book clubs in advance'],         advisory:0 },
};

const COST_LABELS = ['Budget', 'Mid-range', 'Premium', 'Luxury'];
const COST_COLORS = ['#30D158', '#007AFF', '#5E5CE6', '#FF9F0A'];
const ADVISORY_LABELS = ['Normal precautions', 'Exercise caution', 'Reconsider travel'];
const ADVISORY_COLORS = ['#30D158', '#FF9F0A', '#FF453A'];

function normalizeCity(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lookupDest(city: string): DestData | null {
  const key = normalizeCity(city);
  if (DESTINATIONS[key]) return DESTINATIONS[key];
  // Partial match
  for (const [k, v] of Object.entries(DESTINATIONS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

// ── Weather fetch ──────────────────────────────────────────────────────────────

interface WeatherSnap {
  tempC:     number;
  condition: string;
  icon:      string;
}

async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherSnap | null> {
  try {
    const res  = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`,
      { signal: AbortSignal.timeout(5_000) },
    );
    const data = await res.json() as { current?: { temperature_2m: number; weathercode: number } };
    if (!data.current) return null;
    const { temperature_2m: t, weathercode: w } = data.current;
    const cond = w <= 1 ? 'Clear' : w <= 3 ? 'Partly cloudy' : w <= 48 ? 'Foggy' : w <= 67 ? 'Rainy' : w <= 77 ? 'Snowy' : 'Stormy';
    const icon = w <= 1 ? '☀️' : w <= 3 ? '⛅' : w <= 48 ? '🌫' : w <= 67 ? '🌧' : w <= 77 ? '❄️' : '⛈';
    return { tempC: Math.round(t), condition: cond, icon };
  } catch {
    return null;
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

interface DestinationIntelProps {
  city:    string;
  onClose?: () => void;
}

export function DestinationIntel({ city, onClose }: DestinationIntelProps) {
  const dest    = lookupDest(city);
  const [weather, setWeather] = useState<WeatherSnap | null>(null);

  useEffect(() => {
    if (dest) fetchCurrentWeather(dest.lat, dest.lon).then(setWeather);
  }, [dest?.lat, dest?.lon]); // eslint-disable-line

  if (!dest) return null;

  const now        = new Date();
  const curMonth   = now.getMonth();
  const isBest     = dest.bestMonths.includes(curMonth);
  const isPeak     = dest.peakMonths.includes(curMonth);
  const bestMonthsLabel = dest.bestMonths.map(m => MONTH_NAMES[m]).join(', ');
  const costColor  = COST_COLORS[dest.costLevel];
  const advColor   = ADVISORY_COLORS[dest.advisory];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        borderRadius: 20,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.98)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.05), inset 0 1.5px 0 rgba(255,255,255,1)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 12px',
        background: 'linear-gradient(135deg, rgba(0,122,255,0.04) 0%, rgba(94,92,230,0.03) 100%)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>{dest.flag}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {city.replace(/\b\w/g, c => c.toUpperCase())}
            </div>
            <div style={{ fontSize: 10.5, color: '#6E6E73', fontWeight: 500, marginTop: 2 }}>{dest.country}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Current weather */}
          {weather && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 100, background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.07)' }}>
              <span style={{ fontSize: 13 }}>{weather.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1D1D1F' }}>{weather.tempC}°C</span>
              <span style={{ fontSize: 9.5, color: '#8E8E93', fontWeight: 500 }}>{weather.condition}</span>
            </div>
          )}

          {onClose && (
            <motion.button onClick={onClose} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={11} color="#6E6E73" strokeWidth={2.5} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '10px 16px 0' }}>
        {dest.tags.map(tag => (
          <span key={tag} style={{
            fontSize: 10, fontWeight: 600, color: '#5E5CE6',
            background: 'rgba(94,92,230,0.09)', border: '1px solid rgba(94,92,230,0.18)',
            borderRadius: 100, padding: '3px 9px',
          }}>{tag}</span>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', flexWrap: 'wrap' }}>
        {/* Best time */}
        <div style={{
          flex: 1, minWidth: 110, padding: '9px 12px', borderRadius: 12,
          background: isBest ? 'rgba(48,209,88,0.08)' : isPeak ? 'rgba(255,159,10,0.08)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${isBest ? 'rgba(48,209,88,0.22)' : isPeak ? 'rgba(255,159,10,0.22)' : 'rgba(0,0,0,0.07)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <Sun size={11} color={isBest ? '#30D158' : isPeak ? '#FF9F0A' : '#8E8E93'} strokeWidth={2} />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: isBest ? '#30D158' : isPeak ? '#FF9F0A' : '#8E8E93', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {isBest ? 'Best time now' : isPeak ? 'Peak season' : 'Best time'}
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#3C3C43', letterSpacing: '-0.01em' }}>
            {bestMonthsLabel}
          </div>
        </div>

        {/* Cost level */}
        <div style={{
          flex: 1, minWidth: 90, padding: '9px 12px', borderRadius: 12,
          background: `${costColor}0C`, border: `1px solid ${costColor}28`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <DollarSign size={11} color={costColor} strokeWidth={2} />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: costColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cost</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: costColor }}>{COST_LABELS[dest.costLevel]}</div>
          <div style={{ fontSize: 9.5, color: '#8E8E93', fontWeight: 500, marginTop: 1 }}>{dest.currency}</div>
        </div>

        {/* Travel advisory */}
        <div style={{
          flex: 1, minWidth: 100, padding: '9px 12px', borderRadius: 12,
          background: `${advColor}0C`, border: `1px solid ${advColor}28`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <Shield size={11} color={advColor} strokeWidth={2} />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: advColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Advisory</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: advColor }}>{ADVISORY_LABELS[dest.advisory]}</div>
          <div style={{ fontSize: 9, color: '#AEAEB2', marginTop: 2 }}>Curated reference · verify official source</div>
        </div>
      </div>

      {/* Local tips */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Local Tips
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {dest.tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#007AFF', marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#3C3C43', fontWeight: 500, lineHeight: 1.55, letterSpacing: '-0.01em' }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Export lookup function for use in other components ────────────────────────
export { lookupDest };
