'use client';

import { useState, memo, useCallback }         from 'react';
import { motion, AnimatePresence }              from 'framer-motion';
import { useZoneStore }                         from '@/store/useZoneStore';
import type { ZonePreset }                      from '@/store/useZoneStore';
import type { ZoneId }                          from '@/lib/zoneEngines';

const SPRING = { type: 'spring', stiffness: 400, damping: 30 } as const;

// ── Preset card ───────────────────────────────────────────────────────────────

const PresetCard = memo(function PresetCard({
  preset, isActive, onApply, onDelete,
}: {
  preset:   ZonePreset;
  isActive: boolean;
  onApply:  () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  const engineCount = Object.values(preset.engines)
    .reduce((sum, ids) => sum + (ids?.length ?? 0), 0);

  const COLOR_ACT = '#007AFF';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING}
      onHoverStart={() => !preset.isBuiltIn && setShowDelete(true)}
      onHoverEnd={() => setShowDelete(false)}
      style={{
        position:      'relative',
        borderRadius:  14,
        border:        `1.5px solid ${isActive ? `${COLOR_ACT}50` : 'rgba(0,0,0,0.07)'}`,
        background:    isActive
          ? `linear-gradient(135deg, rgba(0,122,255,0.07), rgba(0,122,255,0.02))`
          : 'rgba(255,255,255,0.82)',
        backdropFilter:'blur(20px)',
        padding:       '12px 14px',
        cursor:        'pointer',
        transition:    'border-color 0.2s, background 0.2s',
        overflow:      'hidden',
      }}
      onClick={onApply}
    >
      {/* Active badge */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            position: 'absolute', top: 8, right: 8,
            fontSize: 7, fontWeight: 800, color: COLOR_ACT,
            background: `${COLOR_ACT}18`, borderRadius: 4,
            paddingBlock: 2, paddingInline: 5,
            border: `1px solid ${COLOR_ACT}35`,
          }}
        >
          ACTIVE
        </motion.div>
      )}

      {/* Delete button (custom presets only) */}
      <AnimatePresence>
        {showDelete && !preset.isBuiltIn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.12 }}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{
              position: 'absolute', top: 8, right: isActive ? 50 : 8,
              width: 18, height: 18, borderRadius: 6,
              background: 'rgba(255,69,58,0.12)',
              border: '1px solid rgba(255,69,58,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: '#FF453A', cursor: 'pointer', fontWeight: 800,
            }}
          >
            ✕
          </motion.button>
        )}
      </AnimatePresence>

      {/* Icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{preset.icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em' }}>
            {preset.label}
          </div>
          <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 1 }}>
            {engineCount} engines · {Object.keys(preset.engines).length} zones
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 10, color: '#636366', lineHeight: 1.4, margin: '0 0 8px' }}>
        {preset.description}
      </p>

      {/* Zone chips */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(Object.entries(preset.engines) as [ZoneId, string[]][]).map(([zone, ids]) => (
          <div key={zone} style={{
            fontSize: 8, fontWeight: 600,
            color: isActive ? COLOR_ACT : '#636366',
            background: isActive ? `${COLOR_ACT}10` : 'rgba(0,0,0,0.05)',
            borderRadius: 4, paddingBlock: 2, paddingInline: 5,
          }}>
            {zone} ×{ids?.length}
          </div>
        ))}
      </div>
    </motion.div>
  );
});

// ── Save current config form ──────────────────────────────────────────────────

const SaveForm = memo(function SaveForm({
  onSave, onCancel,
}: {
  onSave:   (label: string, description: string, icon: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel]       = useState('');
  const [desc,  setDesc]        = useState('');
  const [icon,  setIcon]        = useState('⚙️');
  const ICONS = ['⚙️','🧭','🚀','🎯','🌟','🏆','🔮','💡','🎪','🌈','🦋','🔥'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={SPRING}
      style={{
        background:    'rgba(255,255,255,0.92)',
        backdropFilter:'blur(20px)',
        borderRadius:  14,
        border:        '1.5px solid rgba(0,122,255,0.2)',
        padding:       14,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1C1C1E', marginBottom: 10 }}>
        Save current engine selection as preset
      </div>

      {/* Icon picker */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {ICONS.map(ic => (
          <button key={ic} onClick={() => setIcon(ic)}
            style={{
              width: 28, height: 28, borderRadius: 8, fontSize: 14,
              border: `1.5px solid ${icon === ic ? '#007AFF60' : 'rgba(0,0,0,0.08)'}`,
              background: icon === ic ? '#007AFF12' : 'rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}>
            {ic}
          </button>
        ))}
      </div>

      {/* Label input */}
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Preset name…"
        style={{
          width: '100%', marginBottom: 8,
          fontSize: 12, fontWeight: 600, color: '#1C1C1E',
          background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 8, paddingBlock: 7, paddingInline: 10,
          outline: 'none', boxSizing: 'border-box',
        }}
      />

      {/* Description input */}
      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Short description…"
        rows={2}
        style={{
          width: '100%', marginBottom: 10, resize: 'none',
          fontSize: 11, color: '#3C3C43',
          background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 8, paddingBlock: 7, paddingInline: 10,
          outline: 'none', boxSizing: 'border-box', lineHeight: 1.4,
        }}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => { if (label.trim()) onSave(label.trim(), desc.trim(), icon); }}
          disabled={!label.trim()}
          style={{
            flex: 1, fontSize: 11, fontWeight: 700, color: '#fff',
            background: label.trim() ? '#007AFF' : 'rgba(0,0,0,0.12)',
            border: 'none', borderRadius: 8, paddingBlock: 7,
            cursor: label.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Save Preset
        </button>
        <button
          onClick={onCancel}
          style={{
            fontSize: 11, fontWeight: 600, color: '#8E8E93',
            background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 8, paddingBlock: 7, paddingInline: 14, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
});

// ── PresetManager ─────────────────────────────────────────────────────────────

export function PresetManager({ currentZone }: { currentZone: ZoneId }) {
  const [showSaveForm, setShowSaveForm] = useState(false);

  const presets        = useZoneStore(s => s.presets);
  const activePresetId = useZoneStore(s => s.activePresetId);
  const applyPreset    = useZoneStore(s => s.applyPreset);
  const deletePreset   = useZoneStore(s => s.deletePreset);
  const savePreset     = useZoneStore(s => s.savePreset);
  const selectedIds    = useZoneStore(s => s.selectedIds);

  const handleSave = useCallback((label: string, description: string, icon: string) => {
    const zones: ZoneId[] = ['flights', 'lodging', 'dining', 'attractions', 'transit'];
    const engines: Partial<Record<ZoneId, string[]>> = {};
    for (const z of zones) {
      const ids = selectedIds(z);
      if (ids.length > 0) engines[z] = ids;
    }
    savePreset({ label, description, icon, engines });
    setShowSaveForm(false);
  }, [savePreset, selectedIds]);

  const builtIn  = presets.filter(p => p.isBuiltIn);
  const custom   = presets.filter(p => !p.isBuiltIn);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Built-in presets */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Built-in Presets
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <AnimatePresence mode="popLayout">
            {builtIn.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isActive={activePresetId === preset.id}
                onApply={() => applyPreset(preset.id)}
                onDelete={() => {}}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Custom presets */}
      {custom.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            My Presets
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <AnimatePresence mode="popLayout">
              {custom.map(preset => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isActive={activePresetId === preset.id}
                  onApply={() => applyPreset(preset.id)}
                  onDelete={() => deletePreset(preset.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Save / form toggle */}
      <AnimatePresence mode="wait">
        {showSaveForm ? (
          <SaveForm
            key="form"
            onSave={handleSave}
            onCancel={() => setShowSaveForm(false)}
          />
        ) : (
          <motion.button
            key="btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowSaveForm(true)}
            style={{
              width: '100%', fontSize: 11, fontWeight: 700,
              color: '#007AFF',
              background: 'rgba(0,122,255,0.07)',
              border: '1.5px dashed rgba(0,122,255,0.3)',
              borderRadius: 12, paddingBlock: 10,
              cursor: 'pointer',
            }}
          >
            + Save Current Selection as Preset
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
