export type TransitMode =
  | 'flight' | 'train' | 'bus' | 'rideshare'
  | 'car-rental' | 'ferry' | 'walk' | 'shuttle';

export interface TransitSegment {
  mode:        TransitMode;
  provider:    string;
  label:       string;
  durationMin: number;
  cost:        number;
  departTime?: string;
  arriveTime?: string;
}

export type ComfortLevel = 1 | 2 | 3 | 4 | 5;

export interface RouteOption {
  id:            string;
  label:         string;
  segments:      TransitSegment[];
  totalMin:      number;
  totalCost:     number;
  comfort:       ComfortLevel;
  co2Kg:         number;
  isRecommended: boolean;
  isFastest:     boolean;
  isCheapest:    boolean;
  tags:          string[];
}

export interface TransitQuery {
  id:          string;
  from:        string;
  fromLabel:   string;
  to:          string;
  toLabel:     string;
  distance:    string;
  options:     RouteOption[];
  aiSummary:   string;
  tripContext: string;
  icon:        string;
}
