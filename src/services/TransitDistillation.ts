import type { TransitMode } from '@/types/transit';

// ── Mode colors (used externally by TransitVisualizer + MultiModalGraph) ──────

export const MODE_COLOR: Record<TransitMode, string> = {
  flight:      '#007AFF',
  train:       '#5E5CE6',
  bus:         '#FF9F0A',
  rideshare:   '#1C1C1E',
  'car-rental':'#30D158',
  ferry:       '#00C7BE',
  walk:        '#8E8E93',
  shuttle:     '#FF6B35',
};

export const MODE_ICON: Record<TransitMode, string> = {
  flight:      '✈',
  train:       '🚄',
  bus:         '🚌',
  rideshare:   '🚗',
  'car-rental':'🚙',
  ferry:       '⛴',
  walk:        '🚶',
  shuttle:     '🚐',
};
