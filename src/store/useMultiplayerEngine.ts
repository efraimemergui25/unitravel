'use client';

import { create }  from 'zustand';
import { immer }   from 'zustand/middleware/immer';

// ── Peer color palette (Apple-spectrum) ───────────────────────────────────────

const PEER_COLORS = [
  '#FF453A', '#FF9F0A', '#30D158', '#00C7BE',
  '#007AFF', '#5E5CE6', '#BF5AF2', '#FF2D55',
];

function randomColor(): string {
  return PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)] ?? '#007AFF';
}

// ── Peer ID generation (stable per tab session) ───────────────────────────────

let _myId: string | null = null;
let _myColor: string | null = null;

function getMyId(): string {
  if (!_myId) {
    try {
      _myId = crypto.randomUUID();
    } catch {
      _myId = `peer-${Date.now().toString(36)}`;
    }
  }
  return _myId;
}

function getMyColor(): string {
  if (!_myColor) _myColor = randomColor();
  return _myColor;
}

// ── Message protocol ──────────────────────────────────────────────────────────

export type MultiplayerMessage =
  | { type: 'cursor';     peerId: string; displayName: string; color: string; x: number; y: number }
  | { type: 'typing';     peerId: string; displayName: string; color: string; isTypingAI: boolean }
  | { type: 'entity';     peerId: string; displayName: string; dayId: string; entityTitle: string; entityTime?: string }
  | { type: 'heartbeat';  peerId: string; displayName: string; color: string }
  | { type: 'disconnect'; peerId: string };

// ── Peer state ────────────────────────────────────────────────────────────────

export interface MultiplayerPeer {
  id:          string;
  displayName: string;
  color:       string;
  cursor:      { x: number; y: number } | null;
  isTypingAI:  boolean;
  lastSeen:    number;
}

export interface TimelineConflict {
  id:         string;
  dayId:      string;
  peerName:   string;
  entityTitle: string;
  resolvedAt?: number;
}

// ── Store types ───────────────────────────────────────────────────────────────

interface MultiplayerState {
  myId:        string;
  myColor:     string;
  displayName: string;
  peers:       Record<string, MultiplayerPeer>;
  conflicts:   TimelineConflict[];
  isConnected: boolean;
  peerCount:   number;

  setDisplayName:   (name: string) => void;
  broadcastCursor:  (x: number, y: number) => void;
  broadcastTyping:  (isTypingAI: boolean) => void;
  broadcastEntity:  (dayId: string, entityTitle: string, entityTime?: string) => void;
  resolveConflict:  (id: string) => void;
  connect:          () => void;
  disconnect:       () => void;
}

// ── BroadcastChannel singleton ────────────────────────────────────────────────
// Works cross-tab in the same origin. On Supabase Realtime, swap this out.

let _channel: BroadcastChannel | null = null;
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const CHANNEL_NAME = 'unitravel-multiplayer';
const PEER_TIMEOUT_MS = 12_000;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME);
  return _channel;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMultiplayerEngine = create<MultiplayerState>()(
  immer((set, get) => {
    const broadcast = (msg: MultiplayerMessage) => {
      try {
        getChannel()?.postMessage(msg);
      } catch {
        // BroadcastChannel not available (SSR or unsupported browser)
      }
    };

    const pruneStale = () => {
      set(s => {
        const now = Date.now();
        for (const id of Object.keys(s.peers)) {
          if (now - (s.peers[id]?.lastSeen ?? 0) > PEER_TIMEOUT_MS) {
            delete s.peers[id];
          }
        }
        s.peerCount = Object.keys(s.peers).length;
      });
    };

    const handleMessage = (e: MessageEvent<MultiplayerMessage>) => {
      const msg = e.data;
      if (!msg || msg.peerId === getMyId()) return;

      if (msg.type === 'cursor') {
        set(s => {
          if (!s.peers[msg.peerId]) {
            s.peers[msg.peerId] = {
              id:          msg.peerId,
              displayName: msg.displayName,
              color:       msg.color,
              cursor:      null,
              isTypingAI:  false,
              lastSeen:    Date.now(),
            };
          }
          const peer = s.peers[msg.peerId];
          if (peer) {
            peer.cursor   = { x: msg.x, y: msg.y };
            peer.lastSeen = Date.now();
            peer.displayName = msg.displayName;
            peer.color       = msg.color;
          }
          s.peerCount = Object.keys(s.peers).length;
        });
      }

      else if (msg.type === 'typing') {
        set(s => {
          if (!s.peers[msg.peerId]) {
            s.peers[msg.peerId] = {
              id:          msg.peerId,
              displayName: msg.displayName,
              color:       msg.color,
              cursor:      null,
              isTypingAI:  false,
              lastSeen:    Date.now(),
            };
          }
          const peer = s.peers[msg.peerId];
          if (peer) {
            peer.isTypingAI  = msg.isTypingAI;
            peer.lastSeen    = Date.now();
            peer.displayName = msg.displayName;
          }
          s.peerCount = Object.keys(s.peers).length;
        });
      }

      else if (msg.type === 'entity') {
        // Check if this conflicts with a recent local entity placement (< 3s)
        const state = get();
        const hasConflict = Object.values(state.peers).some(p =>
          p.id !== msg.peerId && p.lastSeen > Date.now() - 3000,
        );
        if (hasConflict) {
          const conflictId = `conflict-${Date.now()}`;
          set(s => {
            s.conflicts.push({
              id:          conflictId,
              dayId:       msg.dayId,
              peerName:    msg.displayName,
              entityTitle: msg.entityTitle,
            });
          });
          setTimeout(() => get().resolveConflict(conflictId), 5000);
        }
        set(s => {
          if (s.peers[msg.peerId]) {
            const peer = s.peers[msg.peerId];
            if (peer) peer.lastSeen = Date.now();
          }
        });
      }

      else if (msg.type === 'heartbeat') {
        set(s => {
          if (!s.peers[msg.peerId]) {
            s.peers[msg.peerId] = {
              id:          msg.peerId,
              displayName: msg.displayName,
              color:       msg.color,
              cursor:      null,
              isTypingAI:  false,
              lastSeen:    Date.now(),
            };
          } else {
            const peer = s.peers[msg.peerId];
            if (peer) {
              peer.lastSeen    = Date.now();
              peer.displayName = msg.displayName;
              peer.color       = msg.color;
            }
          }
          s.peerCount = Object.keys(s.peers).length;
        });
      }

      else if (msg.type === 'disconnect') {
        set(s => {
          delete s.peers[msg.peerId];
          s.peerCount = Object.keys(s.peers).length;
        });
      }
    };

    return {
      myId:        getMyId(),
      myColor:     getMyColor(),
      displayName: 'Co-Planner',
      peers:       {},
      conflicts:   [],
      isConnected: false,
      peerCount:   0,

      setDisplayName: (name) => set(s => { s.displayName = name; }),

      broadcastCursor: (x, y) => {
        const { myId, myColor, displayName } = get();
        broadcast({ type: 'cursor', peerId: myId, displayName, color: myColor, x, y });
      },

      broadcastTyping: (isTypingAI) => {
        const { myId, myColor, displayName } = get();
        broadcast({ type: 'typing', peerId: myId, displayName, color: myColor, isTypingAI });
      },

      broadcastEntity: (dayId, entityTitle, entityTime) => {
        const { myId, displayName } = get();
        broadcast({ type: 'entity', peerId: myId, displayName, dayId, entityTitle, entityTime });
      },

      resolveConflict: (id) => {
        set(s => {
          const conflict = s.conflicts.find(c => c.id === id);
          if (conflict) conflict.resolvedAt = Date.now();
          setTimeout(() => {
            set(ss => { ss.conflicts = ss.conflicts.filter(c => c.id !== id); });
          }, 1200);
        });
      },

      connect: () => {
        const ch = getChannel();
        if (!ch) return;

        ch.onmessage = handleMessage;
        set(s => { s.isConnected = true; });

        // Announce presence
        const { myId, myColor, displayName } = get();
        broadcast({ type: 'heartbeat', peerId: myId, displayName, color: myColor });

        // Heartbeat every 5s + stale peer pruning
        _heartbeatInterval = setInterval(() => {
          const state = get();
          broadcast({ type: 'heartbeat', peerId: state.myId, displayName: state.displayName, color: state.myColor });
          pruneStale();
        }, 5000);

        // Cleanup on tab close
        if (typeof window !== 'undefined') {
          window.addEventListener('beforeunload', () => {
            broadcast({ type: 'disconnect', peerId: myId });
          }, { once: true });
        }
      },

      disconnect: () => {
        const { myId } = get();
        broadcast({ type: 'disconnect', peerId: myId });
        if (_heartbeatInterval) { clearInterval(_heartbeatInterval); _heartbeatInterval = null; }
        _channel?.close();
        _channel = null;
        set(s => { s.isConnected = false; s.peers = {}; s.peerCount = 0; });
      },
    };
  }),
);
