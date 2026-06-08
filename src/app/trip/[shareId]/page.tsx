import { notFound }             from 'next/navigation';
import { decodePayload }         from '@/utils/PayloadSanitizer';
import type { PublicDay, PublicEntity } from '@/utils/PayloadSanitizer';
import { ConversionWatermark }   from '@/components/plg/ConversionWatermark';

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const trip = decodePayload(shareId);
  if (!trip) return { title: 'Unitravel Trip' };
  return {
    title:       `${trip.title} · Unitravel`,
    description: `${trip.travelers} traveler${trip.travelers !== 1 ? 's' : ''} · ${trip.days.length} day${trip.days.length !== 1 ? 's' : ''} · ${trip.destination}`,
    openGraph:   {
      title:       `${trip.title} · Unitravel`,
      description: `A ${trip.days.length}-day trip to ${trip.destination}, crafted by Unitravel AI.`,
      type:        'article',
    },
  };
}

// ── Sub-components (server) ───────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  flight:     '✈️',
  hotel:      '🏨',
  restaurant: '🍽️',
  activity:   '🎯',
  transport:  '🚌',
  transit:    '🚌',
};

const CATEGORY_COLOR: Record<string, string> = {
  flight:     '#007AFF',
  hotel:      '#30D158',
  restaurant: '#FF9F0A',
  activity:   '#BF5AF2',
  transport:  '#00C7BE',
  transit:    '#00C7BE',
};

function EntityCard({ entity }: { entity: PublicEntity }) {
  const emoji = CATEGORY_EMOJI[entity.category] ?? '📍';
  const color = CATEGORY_COLOR[entity.category] ?? '#6E6E73';

  return (
    <div
      style={{
        display:        'flex',
        gap:            12,
        padding:        '12px 16px',
        borderRadius:   16,
        background:     'rgba(255,255,255,0.30)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border:         '1.5px solid rgba(255,255,255,0.60)',
        boxShadow:      'inset 0 1px 0 rgba(255,255,255,0.9)',
        marginBlockEnd: 10,
      }}
    >
      {/* Icon */}
      <div style={{
        width:          38, height: 38,
        borderRadius:   12,
        background:     `${color}15`,
        border:         `1.5px solid ${color}30`,
        display:        'flex', alignItems: 'center', justifyContent: 'center',
        fontSize:       18, flexShrink: 0,
      }}>
        {emoji}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:      13, fontWeight: 800,
          color:         '#1C1C1E', letterSpacing: '-0.02em',
          fontFamily:    '-apple-system, "SF Pro Display", Inter, sans-serif',
          overflow:      'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entity.title}
        </div>
        <div style={{
          fontSize:      11, fontWeight: 500,
          color:         '#6E6E73', marginBlockStart: 1,
          fontFamily:    '-apple-system, "SF Pro Display", Inter, sans-serif',
          overflow:      'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entity.subtitle}
          {entity.time && <span style={{ color }}> · {entity.time}</span>}
        </div>

        {/* AI highlight */}
        {entity.aiHighlight && (
          <div style={{
            marginBlockStart: 5, paddingBlock: 4, paddingInline: 8,
            borderRadius:     8,
            background:       `${color}10`,
            border:           `1px solid ${color}20`,
            fontSize:         10, fontWeight: 600,
            color:            `${color}`,
            fontFamily:       '-apple-system, "SF Pro Display", Inter, sans-serif',
            lineHeight:       1.5,
          }}>
            ✦ {entity.aiHighlight}
          </div>
        )}

        {/* Rating */}
        {entity.rating && (
          <div style={{
            marginBlockStart: 4, fontSize: 10,
            color: '#6E6E73', fontWeight: 500,
            fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
          }}>
            {'★'.repeat(Math.round(entity.rating))}
            {'☆'.repeat(5 - Math.round(entity.rating))}
            {' '}{entity.rating.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}

function DayCard({ day }: { day: PublicDay }) {
  const date = day.date
    ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })
    : `Day ${day.dayNumber}`;

  return (
    <section
      style={{
        marginBlockEnd:  20,
        borderRadius:    24,
        background:      'rgba(255,255,255,0.20)',
        backdropFilter:  'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        border:          '1.5px solid rgba(255,255,255,0.55)',
        boxShadow:       'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 32px rgba(0,0,0,0.06)',
        overflow:        'hidden',
      }}
    >
      {/* Day header */}
      <div style={{
        paddingBlock:    14, paddingInline: 18,
        borderBlockEnd:  '1px solid rgba(255,255,255,0.40)',
        display:         'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize:      9.5, fontWeight: 800, color: '#007AFF',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily:    '-apple-system, "SF Pro Display", Inter, sans-serif',
          }}>
            Day {day.dayNumber}
          </div>
          <div style={{
            fontSize:      16, fontWeight: 900, color: '#1C1C1E',
            letterSpacing: '-0.03em', marginBlockStart: 1,
            fontFamily:    '-apple-system, "SF Pro Display", Inter, sans-serif',
          }}>
            {day.destination || date}
          </div>
          {day.destination && (
            <div style={{
              fontSize: 11, color: '#6E6E73', fontWeight: 500,
              fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
            }}>
              {date}
            </div>
          )}
        </div>

        {/* Weather chip */}
        {day.weather && (
          <div style={{
            display:        'flex', alignItems: 'center', gap: 5,
            paddingBlock:   6, paddingInline: 12,
            borderRadius:   20,
            background:     'rgba(255,255,255,0.50)',
            border:         '1px solid rgba(255,255,255,0.70)',
            fontSize:       12, fontWeight: 700,
            color:          '#1C1C1E',
            fontFamily:     '-apple-system, "SF Pro Display", Inter, sans-serif',
          }}>
            {day.weather.icon} {day.weather.temp}°
          </div>
        )}
      </div>

      {/* Entities */}
      <div style={{ padding: '12px 14px' }}>
        {day.entities.map(entity => (
          <EntityCard key={entity.id} entity={entity} />
        ))}
        {day.entities.length === 0 && (
          <p style={{
            fontSize: 11, color: '#6E6E73', textAlign: 'center',
            paddingBlock: 20, fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
          }}>
            Free day · No plans set
          </p>
        )}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TripSharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const trip = decodePayload(shareId);

  if (!trip) notFound();

  const mainDestination = trip.destination;

  return (
    <>
      {/* Full-page mesh gradient background */}
      <div
        style={{
          minHeight:       '100vh',
          background:      'linear-gradient(160deg, #e0eafc 0%, #cfdef3 40%, #d8f0e8 70%, #f8e8f5 100%)',
          fontFamily:      '-apple-system, "SF Pro Display", Inter, sans-serif',
          paddingBlockEnd: 120, // space for watermark
        }}
      >
        {/* Hero section */}
        <div style={{ position: 'relative', height: 340, overflow: 'hidden' }}>
          {/* Destination image placeholder — beautifully masked */}
          <img
            src={`https://source.unsplash.com/800x600/?${encodeURIComponent(mainDestination)},travel,landscape`}
            alt={mainDestination}
            width={800}
            height={600}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {/* Gradient fade to background */}
          <div
            style={{
              position:   'absolute',
              insetInlineStart: 0, insetInlineEnd: 0,
              insetBlockEnd:    0,
              height:     '65%',
              background: 'linear-gradient(to bottom, transparent, #dde8f5)',
              pointerEvents: 'none',
            }}
          />
          {/* Top fade */}
          <div
            style={{
              position:   'absolute',
              insetInlineStart: 0, insetInlineEnd: 0,
              insetBlockStart:  0,
              height:     '30%',
              background: 'linear-gradient(to bottom, rgba(224,234,252,0.6), transparent)',
              pointerEvents: 'none',
            }}
          />

          {/* Unitravel badge */}
          <div style={{
            position:       'absolute',
            insetBlockStart: 20,
            insetInlineStart: 20,
            paddingBlock:    6, paddingInline: 14,
            borderRadius:    20,
            background:      'rgba(255,255,255,0.50)',
            backdropFilter:  'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border:          '1px solid rgba(255,255,255,0.70)',
            fontSize:        11, fontWeight: 800,
            color:           '#007AFF',
            letterSpacing:   '-0.01em',
          }}>
            ✦ Unitravel
          </div>
        </div>

        {/* Trip header */}
        <div style={{
          paddingInline: 20, paddingBlockStart: 24, paddingBlockEnd: 16,
        }}>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 900,
            color: '#1C1C1E', letterSpacing: '-0.04em', lineHeight: 1.1,
          }}>
            {trip.title}
          </h1>
          <div style={{
            marginBlockStart: 8, display: 'flex', gap: 10, flexWrap: 'wrap',
          }}>
            {[
              trip.travelers > 1 ? `${trip.travelers} travelers` : 'Solo',
              `${trip.days.length} day${trip.days.length !== 1 ? 's' : ''}`,
              trip.startDate && new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            ].filter(Boolean).map((chip, i) => (
              <span
                key={i}
                style={{
                  paddingBlock: 5, paddingInline: 12,
                  borderRadius: 20,
                  background:   'rgba(255,255,255,0.50)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border:       '1px solid rgba(255,255,255,0.70)',
                  fontSize:     11, fontWeight: 700,
                  color:        '#6E6E73',
                  display:      'inline-block',
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ paddingInline: 16 }}>
          {trip.days.map(day => (
            <DayCard key={day.id} day={day} />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          paddingInline: 20, paddingBlockStart: 8,
          fontSize: 10, color: '#6E6E73', textAlign: 'center',
          fontWeight: 500,
        }}>
          Generated by Unitravel AI · {new Date(trip.generatedAt).toLocaleDateString()}
        </div>
      </div>

      {/* Viral conversion watermark — fixed to viewport */}
      <ConversionWatermark />
    </>
  );
}
