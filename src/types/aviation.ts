import type { FlightClass } from '@/services/OmniAggregator';

export type { FlightClass };

export type FlightAlliance = 'Star Alliance' | 'Oneworld' | 'SkyTeam' | 'Independent';
export type CabinClass     = FlightClass;

export interface AirportInfo {
  iata:     string;
  city:     string;
  country:  string;
  terminal?: string;
  lat:      number;
  lon:      number;
}

export interface Stop {
  airport:     AirportInfo;
  arrivalTime: string;
  depTime:     string;
  durationMin: number;
}

export interface LuggagePolicy {
  carryOnKg:   number;
  carryOnCm:   [number, number, number]; // [L, W, H]
  checkedKg:   number;
  checkedCm:   [number, number, number];
  included:    boolean;
  extraFeeUSD: number;
}

export interface PricePrediction {
  currentPrice:      number;
  priceRange:        [number, number];
  dropProbability:   number;
  expectedDropUSD:   number;
  recommendAction:   string;
  sparkline:         number[]; // 14-day relative price index 0–1
  trend:             'rising' | 'falling' | 'stable';
}

export interface LayoverCognitiveLoad {
  durationMin:  number;
  airport:      AirportInfo;
  score:        number; // 0–1, higher = more stressful
  factors:      string[];
  loungeAccess: boolean;
  transitVisa:  boolean;
}

export interface CarbonData {
  totalKg:         number;
  perPassengerKg:  number;
  label:           string;
  vsAverageRoute:  number; // ratio vs avg (1.0 = average)
  offsetUSD:       number;
  alternative:     string;
}

export interface SourceMatch {
  engineId:   string;
  engineName: string;
  price:      number;
  available:  boolean;
  deepLink?:  string;
}

export type RecommendationAction = 'book-now' | 'wait' | 'watch' | 'skip';

export interface AviationEntity {
  id:               string;
  airline:          string;
  alliance:         FlightAlliance;
  flightNumber:     string;
  origin:           AirportInfo;
  destination:      AirportInfo;
  departure:        string;
  arrival:          string;
  durationMin:      number;
  durationLabel:    string;
  stops:            number;
  stopDetails:      Stop[];
  cabin:            CabinClass;
  luggage:          LuggagePolicy;
  price:            number;
  pricePrediction:  PricePrediction;
  carbon:           CarbonData;
  layoverLoad:      LayoverCognitiveLoad | null;
  sourceMatches:    SourceMatch[];
  sourceCount:      number;
  aiConfidence:     number;
  seats:            number;
  refundable:       boolean;
  tags:             string[];
  recommendation:   RecommendationAction;
  aiSummary:        string;
}
