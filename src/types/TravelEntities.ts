import { z } from 'zod';

// ── Shared primitives ─────────────────────────────────────────────────────────

const AvailabilitySchema = z.enum(['available', 'limited', 'sold_out', 'unknown']);

const BaseSchema = z.object({
  id:          z.string(),
  sourceId:    z.string(),          // which engine produced this
  availableAt: z.array(z.string()), // engine IDs that have this entity
  confidence:  z.number().min(0).max(1),
  priceUSD:    z.number().nonnegative(),
  availability:AvailabilitySchema,
  deepLink:    z.string().url().optional(),
  fetchedAt:   z.string().datetime(),
});

// ── Flight ────────────────────────────────────────────────────────────────────

export const NormalizedFlightSchema = BaseSchema.extend({
  type:         z.literal('flight'),
  airline:      z.string(),
  flightNumber: z.string(),
  origin:       z.string().length(3), // IATA code
  destination:  z.string().length(3),
  departureISO: z.string().datetime(),
  arrivalISO:   z.string().datetime(),
  durationMin:  z.number().positive(),
  stops:        z.number().int().min(0),
  cabinClass:   z.enum(['economy', 'premium_economy', 'business', 'first']),
  baggage:      z.object({ included: z.boolean(), pieces: z.number().int().min(0) }).optional(),
  co2Kg:        z.number().nonnegative().optional(),
  tags:         z.array(z.string()),
});

// ── Hotel ─────────────────────────────────────────────────────────────────────

export const NormalizedHotelSchema = BaseSchema.extend({
  type:           z.literal('hotel'),
  name:           z.string(),
  city:           z.string(),
  country:        z.string().length(2), // ISO 3166-1 alpha-2
  starRating:     z.number().min(1).max(5),
  guestRating:    z.number().min(0).max(10).optional(),
  reviewCount:    z.number().int().nonnegative().optional(),
  pricePerNight:  z.number().nonnegative(),
  totalNights:    z.number().int().positive(),
  amenities:      z.array(z.string()),
  tier:           z.enum(['budget', 'midscale', 'upscale', 'luxury', 'ultra-luxury']),
  lat:            z.number().optional(),
  lng:            z.number().optional(),
  tags:           z.array(z.string()),
});

// ── Restaurant ────────────────────────────────────────────────────────────────

export const NormalizedRestaurantSchema = BaseSchema.extend({
  type:              z.literal('restaurant'),
  name:              z.string(),
  city:              z.string(),
  cuisine:           z.string(),
  michelinStars:     z.number().int().min(0).max(3).optional(),
  guestRating:       z.number().min(0).max(5).optional(),
  reviewCount:       z.number().int().nonnegative().optional(),
  pricePerPerson:    z.number().nonnegative(),
  reservationWindow: z.string().optional(), // e.g., "Booked 30 days out"
  availableSlots:    z.array(z.string()),   // e.g., ["19:00", "19:30"]
  tags:              z.array(z.string()),
});

// ── Attraction ────────────────────────────────────────────────────────────────

export const NormalizedAttractionSchema = BaseSchema.extend({
  type:            z.literal('attraction'),
  title:           z.string(),
  city:            z.string(),
  category:        z.enum(['outdoor', 'cultural', 'culinary', 'adventure', 'wellness']),
  durationHours:   z.number().positive(),
  pricePerPerson:  z.number().nonnegative(),
  instantBook:     z.boolean(),
  rating:          z.number().min(0).max(5).optional(),
  reviewCount:     z.number().int().nonnegative().optional(),
  weatherSensitive:z.boolean(),
  groupSizeMax:    z.number().int().positive().optional(),
  tags:            z.array(z.string()),
});

// ── Transit ───────────────────────────────────────────────────────────────────

export const NormalizedTransitSchema = BaseSchema.extend({
  type:      z.literal('transit'),
  fromLabel: z.string(),
  toLabel:   z.string(),
  mode:      z.enum(['flight', 'train', 'bus', 'rideshare', 'car-rental', 'ferry', 'walk', 'shuttle']),
  provider:  z.string(),
  totalMin:  z.number().positive(),
  co2Kg:     z.number().nonnegative().optional(),
  tags:      z.array(z.string()),
});

// ── Discriminated union ───────────────────────────────────────────────────────

export const NormalizedResultSchema = z.discriminatedUnion('type', [
  NormalizedFlightSchema,
  NormalizedHotelSchema,
  NormalizedRestaurantSchema,
  NormalizedAttractionSchema,
  NormalizedTransitSchema,
]);

export type NormalizedFlight      = z.infer<typeof NormalizedFlightSchema>;
export type NormalizedHotel       = z.infer<typeof NormalizedHotelSchema>;
export type NormalizedRestaurant  = z.infer<typeof NormalizedRestaurantSchema>;
export type NormalizedAttraction  = z.infer<typeof NormalizedAttractionSchema>;
export type NormalizedTransit     = z.infer<typeof NormalizedTransitSchema>;
export type NormalizedResult      = z.infer<typeof NormalizedResultSchema>;
export type NormalizedResultType  = NormalizedResult['type'];
