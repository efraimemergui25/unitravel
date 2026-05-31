'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useNavigationStore, ZoneType } from '@/store/useNavigationStore';
import { useTravelEngine } from '@/store/useTravelEngine';
import { FlightZone } from '@/components/zones/FlightZone';
import { AIChatStream } from '@/components/AIChatStream';

const SPRING        = { type: 'spring', stiffness: 400, damping: 30 }  as const;
const SPRING_MODAL  = { type: 'spring', stiffness: 300, damping: 32, mass: 1.1 } as const;

// ── Zone catalog ───────────────────────────────────────────────────────────────

const ZONES: Array<{
  id:       ZoneType;
  icon:     string;
  labelKey: string;
  color:    string;
  sub:      string;
}> = [
  { id: 'flights',     icon: '✈️', labelKey: 'flights',     color: '#007AFF', sub: '30 engines'   },
  { id: 'hotels',      icon: '🏨', labelKey: 'hotels',      color: '#00C7BE', sub: '28 engines'   },
  { id: 'restaurants', icon: '🍽',  labelKey: 'restaurants', color: '#FFD60A', sub: '12 platforms' },
  { id: 'attractions', icon: '🎭', labelKey: 'attractions', color: '#30D158', sub: '8 platforms'  },
  { id: 'transit',     icon: '🚗', labelKey: 'transit',     color: '#5E5CE6', sub: '6 engines'    },
];

// ── HubHeader ─────────────────────────────────────────────────────────────────

function HubHeader({
  title,
  onClose,
  onBack,
  showBack,
  tripLabel,
}: {
  title:     string;
  onClose:   () => void;
  onBack?:   () => void;
  showBack:  boolean;
  tripLabel: string;
}) {
  const t = useTranslations('Hub');

  return (
    <div
      className="flex items-center ps-4 pe-4 shrink-0"
      style={{
        height:          '56px',
        borderBlockEnd:  '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {/* Start: back or close */}
      <motion.button
        onClick={showBack ? onBack : onClose}
        whileTap={{ scale: 0.94 }}
        transition={SPRING}
        className="text-sm font-medium text-[#007AFF] hover:opacity-70 transition-opacity me-3 shrink-0"
      >
        {showBack ? t('back') : t('close')}
      </motion.button>

      {/* Center: title */}
      <span className="flex-1 text-center text-sm font-semibold text-[#1D1D1F] truncate">
        {title}
      </span>

      {/* End: trip context pill */}
      <div
        className="ms-3 shrink-0 rounded-full ps-3 pe-3 py-1 text-xs font-medium text-[#6E6E73]"
        style={{ background: 'rgba(0,0,0,0.05)' }}
      >
        {tripLabel}
      </div>
    </div>
  );
}

// ── HomeView ──────────────────────────────────────────────────────────────────

function HomeView({
  setHubMode,
  tripTitle,
}: {
  setHubMode: (m: 'concierge' | 'zones') => void;
  tripTitle:  string;
}) {
  const t = useTranslations('Hub');

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col items-center pt-10 pb-6 gap-8"
    >
      {/* Hero */}
      <div className="text-center flex flex-col gap-2">
        <h1 className="text-5xl font-black text-[#1D1D1F] leading-tight">
          {t('homeTitle')}
        </h1>
        <p className="text-sm text-[#6E6E73]">{tripTitle}</p>
      </div>

      {/* Dual cards */}
      <div className="flex gap-4 w-full max-w-2xl">
        {/* Card A — AI Concierge */}
        <motion.button
          onClick={() => setHubMode('concierge')}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.1 }}
          whileHover={{ y: -3, boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07)' }}
          className="flex-1 rounded-3xl text-start p-6 flex flex-col gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(0,122,255,0.08), rgba(94,92,230,0.08))',
            border:     '1px solid rgba(0,122,255,0.2)',
            boxShadow:  '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <span
            className="text-5xl w-16 h-16 flex items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(0,122,255,0.12), rgba(94,92,230,0.12))' }}
          >
            ✦
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-base font-bold text-[#1D1D1F]">{t('conciergeTitle')}</span>
            <span className="text-sm text-[#6E6E73] leading-snug">{t('conciergeSub')}</span>
          </div>
          <span className="text-sm font-semibold text-[#007AFF] mt-auto">
            {t('conciergeAction')} →
          </span>
        </motion.button>

        {/* Card B — God-Mode Zones */}
        <motion.button
          onClick={() => setHubMode('zones')}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.2 }}
          whileHover={{ y: -3, boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07)' }}
          className="flex-1 rounded-3xl text-start p-6 flex flex-col gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(48,209,88,0.08), rgba(0,199,190,0.08))',
            border:     '1px solid rgba(48,209,88,0.2)',
            boxShadow:  '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <span
            className="text-5xl w-16 h-16 flex items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(48,209,88,0.12), rgba(0,199,190,0.12))' }}
          >
            ⚡
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-base font-bold text-[#1D1D1F]">{t('zonesTitle')}</span>
            <span className="text-sm text-[#6E6E73] leading-snug">{t('zonesSub')}</span>
          </div>
          <span className="text-sm font-semibold text-[#30D158] mt-auto">
            {t('zonesAction')} →
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── ConciergeView → delegates fully to AIChatStream ──────────────────────────

// (no local state needed — AIChatStream owns the session)

// ── ZonesView ─────────────────────────────────────────────────────────────────

function ZonesView({ openZone }: { openZone: (z: ZoneType) => void }) {
  const t = useTranslations('Zone');
  const tHub = useTranslations('Hub');

  return (
    <motion.div
      key="zones"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={SPRING}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black text-[#1D1D1F]">{tHub('zonesTitle')}</h2>
        <p className="text-sm text-[#6E6E73]">Select a category</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {ZONES.map((zone, i) => (
          <motion.button
            key={zone.id}
            onClick={() => openZone(zone.id)}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING, delay: i * 0.05 }}
            whileHover={{ y: -3, boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}
            whileTap={{ scale: 0.97 }}
            className="light-glass rounded-2xl p-5 flex flex-col items-center gap-3 text-center min-w-[140px] flex-1"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <span
              className="text-3xl w-14 h-14 flex items-center justify-center rounded-2xl"
              style={{ background: `${zone.color}1F` }}
            >
              {zone.icon}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-[#1D1D1F]">{t(zone.labelKey as Parameters<typeof t>[0])}</span>
              <span className="text-xs text-[#AEAEB2]">{zone.sub}</span>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ── ZoneStub ──────────────────────────────────────────────────────────────────

function ZoneStub({
  zone,
  onBack,
}: {
  zone:   NonNullable<ZoneType>;
  onBack: () => void;
}) {
  const t     = useTranslations('Zone');
  const meta  = ZONES.find((z) => z.id === zone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      className="flex flex-col items-center justify-center min-h-[40vh] gap-4"
    >
      <div
        className="light-glass rounded-3xl p-10 flex flex-col items-center gap-4 text-center"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05)' }}
      >
        <span
          className="text-4xl w-16 h-16 flex items-center justify-center rounded-2xl"
          style={{ background: meta ? `${meta.color}1F` : 'rgba(0,0,0,0.06)' }}
        >
          {meta?.icon ?? '⬜'}
        </span>
        <p className="text-base font-semibold text-[#1D1D1F]">
          {t('comingSoon', { zone })}
        </p>
        <button
          onClick={onBack}
          className="text-sm font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
        >
          ← All Zones
        </button>
      </div>
    </motion.div>
  );
}

// ── HubNavigator ──────────────────────────────────────────────────────────────

export function HubNavigator() {
  const { hubMode, activeZone, closeHub, setHubMode, openZone, closeZone } =
    useNavigationStore();
  const { trip } = useTravelEngine();
  const t        = useTranslations('Hub');

  const tripLabel = `✈ ${trip.title.split('·')[2]?.trim() ?? 'Mexico'} · Oct 1–21`;

  const headerTitle = (() => {
    if (activeZone === 'flights') return `✈️ ${t('zonesTitle')}`;
    if (hubMode === 'concierge')  return t('conciergeTitle');
    if (hubMode === 'zones')      return t('zonesTitle');
    return t('homeTitle');
  })();

  const showBack =
    hubMode === 'concierge' || (hubMode === 'zones' && activeZone !== null);

  const handleBack = () => {
    if (activeZone !== null) {
      closeZone();
    } else {
      setHubMode('home');
    }
  };

  return (
    <AnimatePresence>
      {hubMode !== null && (
        <motion.div
          key="hub"
          className="fixed inset-0 z-[90] flex flex-col bg-[#F5F5F7]"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={SPRING_MODAL}
        >
          <HubHeader
            title={headerTitle}
            onClose={closeHub}
            onBack={handleBack}
            showBack={showBack}
            tripLabel={tripLabel}
          />

          {/* Concierge gets full-height layout with its own scroll */}
          {hubMode === 'concierge' ? (
            <motion.div
              key="concierge"
              className="flex-1 flex flex-col overflow-hidden"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SPRING}
            >
              <AIChatStream />
            </motion.div>
          ) : (
            <div className="flex-1 overflow-y-auto light-scroll p-6">
              <AnimatePresence mode="wait">
                {hubMode === 'home' && (
                  <HomeView
                    key="home"
                    setHubMode={setHubMode as (m: 'concierge' | 'zones') => void}
                    tripTitle={trip.title}
                  />
                )}

                {hubMode === 'zones' && !activeZone && (
                  <ZonesView key="zones" openZone={openZone} />
                )}

                {hubMode === 'zones' && activeZone === 'flights' && (
                  <FlightZone key="flights" onBack={closeZone} />
                )}

                {hubMode === 'zones' && activeZone && activeZone !== 'flights' && (
                  <ZoneStub
                    key={activeZone}
                    zone={activeZone}
                    onBack={closeZone}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
