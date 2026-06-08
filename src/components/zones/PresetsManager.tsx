'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useZoneStore }   from '@/store/useZoneStore';
import type { ZoneId }    from '@/lib/zoneEngines';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 420, damping: 26 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;

const PRESET_ICONS = ['🎯', '💎', '🌴', '🚀', '🌹', '⚡', '🧭', '🌍'];

// ── Built-in preset pill ──────────────────────────────────────────────────────

function PresetPill({ id, label, icon, isActive, isBuiltIn, onApply, onDelete }: {
  id:       string;
  label:    string;
  icon:     string;
  isActive: boolean;
  isBuiltIn: boolean;
  onApply:  () => void;
  onDelete?: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={SPRING_POP}
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
    >
      <motion.button
        onClick={onApply}
        aria-pressed={isActive}
        whileHover={{ y: -1, scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        transition={SPRING}
        className={[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold cursor-pointer transition-all',
          isActive
            ? 'bg-white/80 border-white shadow-[inset_0_2px_8px_rgba(255,255,255,1),0_3px_12px_rgba(0,0,0,0.07)]'
            : 'bg-white/30 border-white/50 hover:bg-white/50',
        ].join(' ')}
        style={{
          fontFamily:    'inherit',
          letterSpacing: '-0.01em',
          color:         isActive ? '#1C1C1E' : '#6E6E73',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <span style={{ fontSize: 11 }}>{icon}</span>
        {label}
        {isActive && (
          <motion.span
            layoutId={`preset-check-${id}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#30D158',
              boxShadow: '0 0 4px #30D15899',
            }}
          />
        )}
      </motion.button>

      {/* Delete button for custom presets */}
      {!isBuiltIn && onDelete && (
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.8 }}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete preset ${label}`}
          style={{
            position:   'absolute',
            insetBlockStart: -4,
            insetInlineEnd: -4,
            width: 14, height: 14,
            borderRadius: '50%',
            background:   'rgba(255,69,58,0.85)',
            border:       '1px solid white',
            color:        'white',
            fontSize:     9, fontWeight: 900,
            cursor:       'pointer',
            display:      'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight:   1,
          }}
        >
          ×
        </motion.button>
      )}
    </motion.div>
  );
}

// ── Save preset flow ──────────────────────────────────────────────────────────

function SavePresetForm({ zone, onSave, onCancel }: {
  zone:     ZoneId;
  onSave:   (label: string, icon: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel]     = useState('');
  const [iconIdx, setIconIdx] = useState(0);
  const icon = PRESET_ICONS[iconIdx] ?? '🎯';

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={SPRING}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        paddingBlock:   8,
        paddingInline:  12,
        borderRadius:   14,
        background:     'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border:         '1.5px solid rgba(255,255,255,0.70)',
        boxShadow:      'inset 0 1px 0 rgba(255,255,255,1), 0 4px 16px rgba(0,0,0,0.06)',
      }}
    >
      {/* Icon picker */}
      <button
        onClick={() => setIconIdx(i => (i + 1) % PRESET_ICONS.length)}
        style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(255,255,255,0.70)',
          border: '1px solid rgba(0,0,0,0.07)',
          cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Cycle preset icon"
      >
        {icon}
      </button>

      {/* Name input */}
      <input
        autoFocus
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && label.trim()) onSave(label.trim(), icon);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={`Name this ${zone} preset…`}
        style={{
          flex:           1,
          minWidth:       0,
          background:     'transparent',
          border:         'none',
          outline:        'none',
          fontSize:       11,
          fontWeight:     600,
          color:          '#1C1C1E',
          fontFamily:     'inherit',
          letterSpacing:  '-0.01em',
        }}
      />

      {/* Confirm */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => label.trim() && onSave(label.trim(), icon)}
        disabled={!label.trim()}
        style={{
          paddingBlock:  5, paddingInline: 12,
          borderRadius:  8, border: 'none',
          background:    label.trim()
            ? 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)'
            : 'rgba(0,0,0,0.08)',
          color:         label.trim() ? 'white' : '#6E6E73',
          fontSize:      10, fontWeight: 800,
          cursor:        label.trim() ? 'pointer' : 'default',
          fontFamily:    'inherit',
          letterSpacing: '-0.01em',
          flexShrink:    0,
        }}
      >
        Save
      </motion.button>

      {/* Cancel */}
      <button
        onClick={onCancel}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6E6E73', fontSize: 14, paddingBlock: 0, paddingInline: 2,
          fontFamily: 'inherit',
        }}
      >
        ×
      </button>
    </motion.div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PresetsManagerProps {
  zone: ZoneId;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PresetsManager({ zone }: PresetsManagerProps) {
  const { presets, activePresetId, selectedIds, savePreset, applyPreset, deletePreset } = useZoneStore();
  const [isSaving, setIsSaving] = useState(false);

  const currentIds  = selectedIds(zone);
  const zonePresets = presets.filter(p => p.engines[zone]);

  const handleSave = useCallback((label: string, icon: string) => {
    savePreset({
      label,
      icon,
      description: `Custom ${zone} engine selection`,
      engines: { [zone]: currentIds } as Record<ZoneId, string[]>,
    });
    setIsSaving(false);
  }, [zone, currentIds, savePreset]);

  return (
    <LayoutGroup id={`presets-${zone}`}>
      <motion.div
        layout
        style={{
          display:    'flex',
          flexDirection: 'column',
          gap:        8,
          paddingInline: 14,
          paddingBlockEnd: 10,
        }}
      >
        {/* Preset pills row */}
        <div
          className="flex flex-row flex-wrap gap-2"
          aria-label="Engine presets"
        >
          <AnimatePresence>
            {zonePresets.map(p => (
              <PresetPill
                key={p.id}
                id={p.id}
                label={p.label}
                icon={p.icon}
                isActive={activePresetId === p.id}
                isBuiltIn={p.isBuiltIn}
                onApply={() => applyPreset(p.id)}
                onDelete={() => deletePreset(p.id)}
              />
            ))}
          </AnimatePresence>

          {/* Save current selection CTA */}
          {!isSaving && currentIds.length > 0 && (
            <motion.button
              layout
              key="save-cta"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={SPRING_POP}
              whileHover={{ y: -1, scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsSaving(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white/20 border-white/40 hover:bg-white/40"
              style={{
                fontSize:   9.5,
                fontWeight: 700,
                color:      '#6E6E73',
                cursor:     'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 10 }}>＋</span>
              Save {currentIds.length} engines as preset
            </motion.button>
          )}
        </div>

        {/* Save form */}
        <AnimatePresence>
          {isSaving && (
            <SavePresetForm
              zone={zone}
              onSave={handleSave}
              onCancel={() => setIsSaving(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
}
