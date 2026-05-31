export type ExperienceType    = 'cultural' | 'outdoor' | 'culinary' | 'adventure' | 'wellness';
export type WeatherDependency = 'none' | 'low' | 'moderate' | 'high';
export type DayTimePreference = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface WeatherMatch {
  dayIndex:            number;
  dayLabel:            string;
  city:                string;
  condition:           string;
  tempC:               number;
  icon:                string;
  quality:             'perfect' | 'good' | 'fair' | 'warning';
  precipProbability?:  number;   // 0–100; populated when quality === 'warning'
  suggestedDayLabel?:  string;   // e.g. "Fri, Oct 5" — best AI-suggested alternative
}

export interface AttractionEntity {
  id:                string;
  title:             string;
  description:       string;
  type:              ExperienceType;
  destination:       string;
  city:              string;
  lat?:              number;
  lon?:              number;
  durationHours:     number;
  groupSizeMax:      number;
  pricePerPerson:    number;
  difficulty:        'easy' | 'moderate' | 'challenging';
  weatherDependency: WeatherDependency;
  bestTimeOfDay:     DayTimePreference;
  instantBook:       boolean;
  rating:            number;
  reviewCount:       number;
  aiHighlight:       string;
  weatherMatch:      WeatherMatch | null;
  gradient:          string;
  tags:              string[];
  aiConfidence:      number;
  providers:         string[];
  sourceCount:       number;
}
