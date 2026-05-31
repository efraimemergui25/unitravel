import type { AggregatedLodging, LodgingTier, SentimentScore } from '@/services/OmniAggregator';

export type { AggregatedLodging, LodgingTier, SentimentScore };

export interface HiddenFee {
  name:     string;
  amount:   number;
  perNight: boolean;
  sources:  string[];
  severity: 'low' | 'medium' | 'high';
}

export interface PhotoSlide {
  id:       number;
  label:    string;
  sublabel: string;
  gradient: string;
}

export interface LodgingSourcePrice {
  engineId:     string;
  engineName:   string;
  pricePerNight: number;
  totalPrice:   number;
  available:    boolean;
}

export interface LodgingEntity extends AggregatedLodging {
  trustScore:    number;
  hiddenFees:    HiddenFee[];
  photos:        PhotoSlide[];
  sourcePrices:  LodgingSourcePrice[];
  feeTotal:      number;
  totalWithFees: number;
  recommendation: 'book-now' | 'compare' | 'watch' | 'skip';
}
