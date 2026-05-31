'use client';

import { motion } from 'framer-motion';

interface BaggageVisualizerProps {
  accentColor: string;
}

const BAGS = [
  { label: 'Carry-On',    dims: '22×16×8 in',  w: 48, h: 58, delay: 0   },
  { label: 'Checked Bag', dims: '27×21×14 in', w: 60, h: 74, delay: 0.1 },
] as const;

export function BaggageVisualizer({ accentColor }: BaggageVisualizerProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#AEAEB2]">
        Baggage Allowance
      </span>
      <div className="flex items-end gap-6">
        {BAGS.map((bag) => (
          <motion.div
            key={bag.label}
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28, delay: bag.delay }}
          >
            {/* Luggage box */}
            <div className="relative" style={{ width: bag.w, height: bag.h }}>
              {/* Main body */}
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  border:     '1.5px solid rgba(0,0,0,0.10)',
                  boxShadow:  '0 2px 8px rgba(0,0,0,0.06)',
                }}
              />
              {/* Handle */}
              <div
                className="absolute rounded-t-full"
                style={{
                  width:           bag.w * 0.4,
                  height:          10,
                  top:             -9,
                  insetInlineStart: bag.w * 0.3,
                  border:          '2px solid rgba(0,0,0,0.15)',
                  borderBlockEnd:  'none',
                  background:      'transparent',
                }}
              />
              {/* Wheels */}
              {([0.18, 0.72] as const).map((x, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width:           6,
                    height:          6,
                    bottom:          -3,
                    insetInlineStart: bag.w * x,
                    background:      'rgba(0,0,0,0.18)',
                  }}
                />
              ))}
              {/* Accent stripe */}
              <div
                className="absolute rounded-sm"
                style={{
                  width:           3,
                  top:             bag.h * 0.2,
                  bottom:          bag.h * 0.2,
                  insetInlineStart: bag.w * 0.15,
                  background:      accentColor,
                  opacity:         0.6,
                }}
              />
            </div>
            {/* Labels */}
            <span className="text-[9px] font-bold text-[#1D1D1F]">{bag.label}</span>
            <span className="text-[8px] text-[#AEAEB2]">{bag.dims}</span>
            <span className="text-[8px] font-semibold" style={{ color: accentColor }}>✓ Included</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
