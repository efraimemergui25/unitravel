'use client';

import { motion } from 'framer-motion';

export interface EngineMatrixProps {
  selectedIds: string[];
  onToggle:    (id: string) => void;
  onSelectAll: () => void;
  onClearAll:  () => void;
}

interface Engine { id: string; name: string; icon: string; color: string; }

const FLIGHT_ENGINES: Engine[] = [
  { id: 'skyscanner',   name: 'Skyscanner',        icon: '🔵', color: '#00B9F2' },
  { id: 'kayak',        name: 'Kayak',              icon: '🦆', color: '#FF690F' },
  { id: 'google',       name: 'Google Flights',     icon: '🔍', color: '#4285F4' },
  { id: 'momondo',      name: 'Momondo',            icon: '🌸', color: '#DB4A72' },
  { id: 'expedia',      name: 'Expedia',            icon: '✈️', color: '#00355F' },
  { id: 'booking',      name: 'Booking.com',        icon: '🔷', color: '#003580' },
  { id: 'hopper',       name: 'Hopper',             icon: '🐰', color: '#9B30FF' },
  { id: 'kiwi',         name: 'Kiwi.com',           icon: '🥝', color: '#00AE42' },
  { id: 'cheapflights', name: 'CheapFlights',       icon: '💸', color: '#EB4826' },
  { id: 'priceline',    name: 'Priceline',          icon: '💰', color: '#003F62' },
  { id: 'aeromexico',   name: 'Aeromexico',         icon: '🇲🇽', color: '#006DB7' },
  { id: 'delta',        name: 'Delta',              icon: '🔺', color: '#C01933' },
  { id: 'united',       name: 'United',             icon: '🌐', color: '#005595' },
  { id: 'american',     name: 'American',           icon: '🦅', color: '#0078D2' },
  { id: 'southwest',    name: 'Southwest',          icon: '💛', color: '#FFB612' },
  { id: 'volaris',      name: 'Volaris',            icon: '🟡', color: '#FFCC00' },
  { id: 'viva',         name: 'VivaAerobus',        icon: '🟠', color: '#FF7900' },
  { id: 'spirit',       name: 'Spirit',             icon: '💛', color: '#FECE00' },
  { id: 'frontier',     name: 'Frontier',           icon: '🦌', color: '#11A44C' },
  { id: 'jetblue',      name: 'JetBlue',            icon: '🔵', color: '#003876' },
  { id: 'norwegian',    name: 'Norwegian',          icon: '🇳🇴', color: '#D81939' },
  { id: 'british',      name: 'British Airways',    icon: '🇬🇧', color: '#075AAA' },
  { id: 'iberia',       name: 'Iberia',             icon: '🇪🇸', color: '#C70000' },
  { id: 'airfrance',    name: 'Air France',         icon: '🇫🇷', color: '#002157' },
  { id: 'emirates',     name: 'Emirates',           icon: '🇦🇪', color: '#C60C30' },
  { id: 'turkish',      name: 'Turkish Airlines',   icon: '🇹🇷', color: '#C70000' },
  { id: 'copa',         name: 'Copa Airlines',      icon: '🇵🇦', color: '#004B87' },
  { id: 'avianca',      name: 'Avianca',            icon: '🇨🇴', color: '#E62B36' },
  { id: 'latam',        name: 'LATAM',              icon: '🌎', color: '#C41230' },
  { id: 'wizzair',      name: 'Wizzair',            icon: '🟣', color: '#CF0072' },
];

export const ALL_ENGINE_IDS = FLIGHT_ENGINES.map(e => e.id);

export function EngineMatrix({ selectedIds, onToggle, onSelectAll, onClearAll }: EngineMatrixProps) {
  const allSelected = selectedIds.length === FLIGHT_ENGINES.length;
  const count = selectedIds.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-[#6E6E73]">
          Search Engines
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6E6E73]">{count} / {FLIGHT_ENGINES.length}</span>
          <motion.button
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{
              background: allSelected ? 'rgba(0,122,255,0.08)' : '#007AFF',
              color:      allSelected ? '#007AFF' : '#ffffff',
              border:     `1px solid ${allSelected ? 'rgba(0,122,255,0.25)' : '#007AFF'}`,
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={allSelected ? onClearAll : onSelectAll}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {allSelected ? 'Deselect All' : 'Omni-Search All 30'}
          </motion.button>
        </div>
      </div>

      {/* Engine grid — 5 columns, wraps to fewer on narrow screens */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {FLIGHT_ENGINES.map((engine, i) => {
          const active = selectedIds.includes(engine.id);
          return (
            <motion.button
              key={engine.id}
              onClick={() => onToggle(engine.id)}
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-center engine-toggle"
              style={{
                background: active ? `${engine.color}12` : 'rgba(255,255,255,0.65)',
                border:     `1px solid ${active ? `${engine.color}40` : 'rgba(255,255,255,0.9)'}`,
                boxShadow:  active
                  ? `0 0 16px ${engine.color}18, 0 2px 8px rgba(0,0,0,0.04)`
                  : '0 1px 4px rgba(0,0,0,0.05)',
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28, delay: i * 0.018 }}
              whileHover={{ y: -2, boxShadow: `0 4px 16px rgba(0,0,0,0.08)` }}
              whileTap={{ scale: 0.94 }}
            >
              <span className="text-xl leading-none">{engine.icon}</span>
              <span
                className="text-[9px] font-bold leading-tight text-center"
                style={{
                  color:             active ? engine.color : '#6E6E73',
                  maxWidth:          '100%',
                  overflow:          'hidden',
                  textOverflow:      'ellipsis',
                  whiteSpace:        'nowrap',
                  paddingInlineStart: 2,
                  paddingInlineEnd:   2,
                }}
              >
                {engine.name.length > 10 ? engine.name.split(' ')[0] : engine.name}
              </span>
              {active && (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: engine.color }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
