import type { AttractionEntity, WeatherDependency, WeatherMatch } from '@/types/attractions';

// ── WMO Weather Code labels ────────────────────────────────────────────────────
// Reference: https://open-meteo.com/en/docs#weathervariables

const WMO_LABELS: Record<number, { label: string; icon: string }> = {
  0:  { label: 'Clear sky',                    icon: '☀️'  },
  1:  { label: 'Mainly clear',                 icon: '🌤'  },
  2:  { label: 'Partly cloudy',                icon: '⛅'  },
  3:  { label: 'Overcast',                     icon: '☁️'  },
  45: { label: 'Fog',                          icon: '🌫'  },
  48: { label: 'Depositing rime fog',          icon: '🌫'  },
  51: { label: 'Light drizzle',                icon: '🌦'  },
  53: { label: 'Drizzle',                      icon: '🌦'  },
  55: { label: 'Heavy drizzle',                icon: '🌧'  },
  61: { label: 'Slight rain',                  icon: '🌧'  },
  63: { label: 'Moderate rain',                icon: '🌧'  },
  65: { label: 'Heavy rain',                   icon: '⛈'  },
  71: { label: 'Slight snow',                  icon: '🌨'  },
  73: { label: 'Moderate snow',                icon: '❄️'  },
  75: { label: 'Heavy snow',                   icon: '❄️'  },
  77: { label: 'Snow grains',                  icon: '❄️'  },
  80: { label: 'Slight rain showers',          icon: '🌦'  },
  81: { label: 'Moderate rain showers',        icon: '🌧'  },
  82: { label: 'Violent rain showers',         icon: '⛈'  },
  85: { label: 'Slight snow showers',          icon: '🌨'  },
  86: { label: 'Heavy snow showers',           icon: '🌨'  },
  95: { label: 'Thunderstorm',                 icon: '⛈'  },
  96: { label: 'Thunderstorm with slight hail',icon: '⛈'  },
  99: { label: 'Thunderstorm with heavy hail', icon: '⛈'  },
};

function wmoEntry(code: number): { label: string; icon: string } {
  return WMO_LABELS[code] ?? WMO_LABELS[0];
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeatherDay {
  date:              string;   // ISO: 2026-10-03
  conditionCode:     number;
  condition:         string;
  icon:              string;
  tempMaxC:          number;
  tempMinC:          number;
  precipProbability: number;   // 0–100
  precipMm:          number;
  windSpeedKmh:      number;
  uvIndex:           number;
  quality:           WeatherMatch['quality'];
}

export interface WeatherForecast {
  destination: string;
  lat:         number;
  lon:         number;
  timezone:    string;
  days:        WeatherDay[];
  fetchedAt:   number;
}

interface GeoResult {
  lat:      number;
  lon:      number;
  timezone: string;
  name:     string;
}

// ── Quality resolution ────────────────────────────────────────────────────────

export function resolveWeatherQuality(
  code:          number,
  precipProb:    number,
  dependency:    WeatherDependency,
): WeatherMatch['quality'] {
  if (dependency === 'none') return 'perfect';

  const isWet    = code >= 51 || precipProb >= 65;
  const isHeavy  = code >= 65 || code === 80 || precipProb >= 85;
  const isStorm  = code >= 95;

  if (dependency === 'low') {
    if (isStorm)  return 'fair';
    if (isHeavy)  return 'fair';
    return code <= 1 ? 'perfect' : 'good';
  }

  if (dependency === 'moderate') {
    if (isWet)  return 'warning';
    if (code >= 45) return 'fair';
    return code <= 1 ? 'perfect' : 'good';
  }

  // high
  if (isWet)  return 'warning';
  if (code >= 45) return 'fair';
  return code <= 1 ? 'perfect' : 'good';
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

export async function geocodeDestination(destination: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } } as RequestInit);
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ latitude: number; longitude: number; timezone: string; name: string }> };
    const r = data.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lon: r.longitude, timezone: r.timezone, name: r.name };
  } catch {
    return null;
  }
}

// ── Weather fetch ─────────────────────────────────────────────────────────────

export async function fetchWeatherForecast(
  lat:       number,
  lon:       number,
  startDate: string,
  endDate:   string,
  timezone:  string,
): Promise<WeatherDay[]> {
  const params = new URLSearchParams({
    latitude:   String(lat),
    longitude:  String(lon),
    daily:      [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'wind_speed_10m_max',
      'uv_index_max',
    ].join(','),
    start_date: startDate,
    end_date:   endDate,
    timezone,
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const data = await res.json() as {
    daily?: {
      time:                            string[];
      weather_code:                    number[];
      temperature_2m_max:              number[];
      temperature_2m_min:              number[];
      precipitation_probability_max:   number[];
      precipitation_sum:               number[];
      wind_speed_10m_max:              number[];
      uv_index_max:                    number[];
    };
  };

  const dates = data.daily?.time ?? [];
  return dates.map((date, i) => {
    const code       = data.daily!.weather_code[i] ?? 0;
    const precipProb = data.daily!.precipitation_probability_max[i] ?? 0;
    const wmo        = wmoEntry(code);
    return {
      date,
      conditionCode:     code,
      condition:         wmo.label,
      icon:              wmo.icon,
      tempMaxC:          data.daily!.temperature_2m_max[i] ?? 25,
      tempMinC:          data.daily!.temperature_2m_min[i] ?? 20,
      precipProbability: precipProb,
      precipMm:          data.daily!.precipitation_sum[i] ?? 0,
      windSpeedKmh:      data.daily!.wind_speed_10m_max[i] ?? 10,
      uvIndex:           data.daily!.uv_index_max[i] ?? 5,
      quality:           resolveWeatherQuality(code, precipProb, 'high'),
    };
  });
}

// ── Best alternative day ──────────────────────────────────────────────────────

export function findBestAlternativeDay(
  forecast:           WeatherDay[],
  scheduledDayIndex:  number,
  dependency:         WeatherDependency,
): string | null {
  const candidates = forecast
    .map((day, i) => ({ day, i }))
    .filter(({ i }) => i !== scheduledDayIndex)
    .map(({ day, i }) => ({ day, i, quality: resolveWeatherQuality(day.conditionCode, day.precipProbability, dependency) }))
    .filter(({ quality }) => quality === 'perfect' || quality === 'good')
    .sort((a, b) => {
      if (a.quality !== b.quality) return a.quality === 'perfect' ? -1 : 1;
      return Math.abs(a.i - scheduledDayIndex) - Math.abs(b.i - scheduledDayIndex);
    });

  if (!candidates.length) return null;
  const best = candidates[0];
  // Format as short human label, e.g. "Mon, Oct 6"
  const d = new Date(`${best.day.date}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Main enrichment function ──────────────────────────────────────────────────
// Fetches real weather from Open-Meteo and cross-references against each entity's
// weatherDependency to populate weatherMatch with quality/warning data.

export async function enrichAttractionsWithWeather(
  entities:       AttractionEntity[],
  destination:    string,
  scheduledDates: string[],   // ISO dates, parallel-indexed to entities
): Promise<AttractionEntity[]> {
  if (!scheduledDates.length || !entities.length) return entities;

  const geo = await geocodeDestination(destination);
  if (!geo) return entities;

  const sorted  = [...scheduledDates].filter(Boolean).sort();
  const dateMin = sorted[0];
  const dateMax = sorted[sorted.length - 1];

  let forecast: WeatherDay[] = [];
  try {
    forecast = await fetchWeatherForecast(geo.lat, geo.lon, dateMin, dateMax, geo.timezone);
  } catch {
    return entities;
  }

  return entities.map((entity, i) => {
    if (entity.weatherDependency === 'none') return entity;

    const scheduledDate = scheduledDates[i];
    if (!scheduledDate) return entity;

    const dayIndex = forecast.findIndex(d => d.date === scheduledDate);
    if (dayIndex === -1) return entity;

    const day     = forecast[dayIndex];
    const quality = resolveWeatherQuality(day.conditionCode, day.precipProbability, entity.weatherDependency);
    const avgTemp = Math.round((day.tempMaxC + day.tempMinC) / 2);

    const match: WeatherMatch = {
      dayIndex,
      dayLabel:            new Date(`${scheduledDate}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      city:                geo.name,
      condition:           day.condition,
      tempC:               avgTemp,
      icon:                day.icon,
      quality,
      precipProbability:   quality === 'warning' ? day.precipProbability : undefined,
      suggestedDayLabel:   quality === 'warning'
        ? (findBestAlternativeDay(forecast, dayIndex, entity.weatherDependency) ?? undefined)
        : undefined,
    };

    return { ...entity, weatherMatch: match };
  });
}
