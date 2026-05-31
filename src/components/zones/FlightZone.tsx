'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { EngineMatrix }          from '@/components/zones/EngineMatrix';
import { SpatialResultMatrix }   from '@/components/results/SpatialResultMatrix';
import { OmniAggregator, AggregatedFlight } from '@/services/OmniAggregator';
import { usePlanningBoard } from '@/store/usePlanningBoard';

const ALL_ENGINE_IDS = [
  'skyscanner','kayak','google','momondo','expedia',
  'booking','hopper','kiwi','cheapflights','priceline',
  'aeromexico','delta','united','american','southwest',
  'volaris','viva','spirit','frontier','jetblue',
  'norwegian','british','iberia','airfrance','emirates',
  'turkish','copa','avianca','latam','wizzair',
];

const SPRING = { type: 'spring', stiffness: 400, damping: 30 } as const;

// ── FlightZone ─────────────────────────────────────────────────────────────────

export function FlightZone({ onBack }: { onBack: () => void }) {
  const t = useTranslations('Zone');
  const { addToBoard } = usePlanningBoard();

  const [selectedEngines, setSelectedEngines] = useState<string[]>([
    'skyscanner', 'kayak', 'google', 'momondo', 'expedia',
  ]);
  const [results,     setResults]     = useState<AggregatedFlight[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleToggle = (id: string) =>
    setSelectedEngines((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSearch = async () => {
    if (selectedEngines.length === 0) return;
    setIsLoading(true);
    setHasSearched(false);
    const batch = await OmniAggregator.aggregate();
    setResults(batch.flights);
    setIsLoading(false);
    setHasSearched(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={SPRING}
      className="flex flex-col gap-6"
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#6E6E73]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
        >
          ← All Zones
        </button>
        <span className="text-[#AEAEB2]">·</span>
        <span>✈️ {t('flights')}</span>
        <span className="text-[#AEAEB2]">·</span>
        <span>Mexico City → Tulum</span>
        <span className="text-[#AEAEB2]">·</span>
        <span>Oct 1, 2026</span>
      </div>

      {/* Route display */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="light-glass rounded-2xl ps-4 pe-4 py-3 flex items-center gap-2 flex-1 min-w-[140px]"
        >
          <span className="text-xs uppercase tracking-widest text-[#AEAEB2]">From</span>
          <span className="text-sm font-semibold text-[#1D1D1F]">Mexico City (MEX)</span>
        </div>

        <span className="text-[#007AFF] text-xl font-black shrink-0">→</span>

        <div
          className="light-glass rounded-2xl ps-4 pe-4 py-3 flex items-center gap-2 flex-1 min-w-[140px]"
        >
          <span className="text-xs uppercase tracking-widest text-[#AEAEB2]">To</span>
          <span className="text-sm font-semibold text-[#1D1D1F]">Tulum (CUN)</span>
        </div>

        <div
          className="light-glass rounded-2xl ps-3 pe-3 py-3 text-sm font-medium text-[#1D1D1F] shrink-0"
        >
          Oct 1, 2026
        </div>

        <div
          className="rounded-full ps-3 pe-3 py-1.5 text-xs font-semibold shrink-0"
          style={{ background: 'rgba(0,122,255,0.10)', color: '#007AFF' }}
        >
          Business Class
        </div>
      </div>

      {/* Engine matrix */}
      <EngineMatrix
        selectedIds={selectedEngines}
        onToggle={handleToggle}
        onSelectAll={() => setSelectedEngines(ALL_ENGINE_IDS)}
        onClearAll={() => setSelectedEngines([])}
      />

      {/* Search button */}
      <motion.button
        onClick={handleSearch}
        disabled={isLoading || selectedEngines.length === 0}
        className="w-full py-4 rounded-2xl text-white font-black text-sm tracking-[0.06em] uppercase disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background:  'linear-gradient(135deg, #007AFF, #5E5CE6)',
          boxShadow:   '0 4px 20px rgba(0,122,255,0.3)',
        }}
        whileHover={
          !isLoading && selectedEngines.length > 0
            ? { scale: 1.01, boxShadow: '0 8px 32px rgba(0,122,255,0.4)' }
            : {}
        }
        whileTap={
          !isLoading && selectedEngines.length > 0
            ? { scale: 0.98 }
            : {}
        }
        transition={SPRING}
      >
        {isLoading
          ? t('scanning', { count: selectedEngines.length })
          : t('omniSearch', { count: selectedEngines.length })}
      </motion.button>

      {/* Spatial Result Matrix — replaces ComparisonMatrix + FlightResultsList */}
      <AnimatePresence>
        {(isLoading || hasSearched) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
          >
            <SpatialResultMatrix
              results={results}
              isLoading={isLoading}
              onStage={addToBoard}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
