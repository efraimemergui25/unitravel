'use client';

import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PeerCursor = {
  id:       string;
  name:     string;
  color:    string;
  x:        number;
  y:        number;
  dayId:    string | null;
  lastSeen: number;
};

type DropPayload   = { peerId: string; peerName: string; sourceId: string; targetDayId: string; timestamp: number };
type CursorPayload = { peerId: string; peerName: string; color: string; x: number; y: number; dayId: string | null };
type DNAPayload    = { peerId: string; field: string; value: number | string };
type PingPayload   = { peerId: string; peerName: string; color: string };

type BroadcastMessage =
  | { type: 'drop';   payload: DropPayload }
  | { type: 'cursor'; payload: CursorPayload }
  | { type: 'dna';    payload: DNAPayload }
  | { type: 'ping';   payload: PingPayload };

// ── Constants ─────────────────────────────────────────────────────────────────

const CHANNEL_NAME  = 'unitravel-collab';
const STALE_PRUNE_MS = 30_000;
const PEER_COLORS   = ['#007AFF', '#34C759', '#FF9F0A', '#FF375F', '#BF5AF2', '#5AC8FA'];

const myId    = `peer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const myName  = 'Effi';
const myColor = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];

// ── Store ─────────────────────────────────────────────────────────────────────

interface MultiplayerState {
  peers:   Record<string, PeerCursor>;
  channel: BroadcastChannel | null;
  myId:    string;
  myName:  string;
  myColor: string;
}

interface MultiplayerActions {
  initChannel:     () => void;
  destroyChannel:  () => void;
  broadcastDrop:   (source: { id: string }, targetDayId: string) => string;
  broadcastCursor: (x: number, y: number, dayId: string | null) => void;
  broadcastDNA:    (field: string, value: number | string) => void;
}

export const useMultiplayerStore = create<MultiplayerState & MultiplayerActions>((set, get) => ({
  peers:   {},
  channel: null,
  myId,
  myName,
  myColor,

  initChannel: () => {
    if (typeof window === 'undefined') return;
    if (get().channel) return; // already initialized

    const ch = new BroadcastChannel(CHANNEL_NAME);

    ch.onmessage = (evt: MessageEvent<BroadcastMessage>) => {
      const msg = evt.data;
      if (!msg?.type) return;

      const now = Date.now();

      if (msg.type === 'ping') {
        const p = msg.payload;
        set(s => ({
          peers: {
            ...s.peers,
            [p.peerId]: {
              id:       p.peerId,
              name:     p.peerName,
              color:    p.color,
              x:        s.peers[p.peerId]?.x    ?? 0,
              y:        s.peers[p.peerId]?.y    ?? 0,
              dayId:    s.peers[p.peerId]?.dayId ?? null,
              lastSeen: now,
            },
          },
        }));
      }

      if (msg.type === 'cursor') {
        const p = msg.payload;
        set(s => ({
          peers: {
            ...s.peers,
            [p.peerId]: {
              id:       p.peerId,
              name:     p.peerName,
              color:    p.color,
              x:        p.x,
              y:        p.y,
              dayId:    p.dayId,
              lastSeen: now,
            },
          },
        }));

        // Prune stale peers opportunistically on every cursor tick
        set(s => {
          const pruned = { ...s.peers };
          for (const id of Object.keys(pruned)) {
            if (now - pruned[id].lastSeen > STALE_PRUNE_MS) delete pruned[id];
          }
          return { peers: pruned };
        });
      }

      if (msg.type === 'drop' || msg.type === 'dna') {
        // Keep lastSeen fresh for peers who send non-cursor events
        const peerId = msg.payload.peerId;
        set(s => ({
          peers: s.peers[peerId]
            ? { ...s.peers, [peerId]: { ...s.peers[peerId], lastSeen: now } }
            : s.peers,
        }));
      }
    };

    set({ channel: ch });
    ch.postMessage({ type: 'ping', payload: { peerId: myId, peerName: myName, color: myColor } });
  },

  destroyChannel: () => {
    get().channel?.close();
    set({ channel: null, peers: {} });
  },

  broadcastDrop: (source, targetDayId) => {
    const broadcastId = `drop-${Date.now()}`;
    get().channel?.postMessage({
      type:    'drop',
      payload: { peerId: myId, peerName: myName, sourceId: source.id, targetDayId, timestamp: Date.now() },
    });
    return broadcastId;
  },

  broadcastCursor: (x, y, dayId) => {
    get().channel?.postMessage({
      type:    'cursor',
      payload: { peerId: myId, peerName: myName, color: myColor, x, y, dayId },
    });
  },

  broadcastDNA: (field, value) => {
    get().channel?.postMessage({
      type:    'dna',
      payload: { peerId: myId, field, value },
    });
  },
}));
