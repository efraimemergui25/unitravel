import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Uses Open-Meteo — completely free, no API key required
// Geocoding via Open-Meteo geocoding API, then forecast

async function geocode(city: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const res  = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { next: { revalidate: 3600 } },
    );
    const data = await res.json();
    if (!data.results?.length) return null;
    const r = data.results[0];
    return { lat: r.latitude, lon: r.longitude, name: r.name };
  } catch { return null; }
}

const WMO_CODE: Record<number, { label: string; icon: string }> = {
  0:  { label: 'Clear sky',         icon: '☀️' },
  1:  { label: 'Mainly clear',      icon: '🌤' },
  2:  { label: 'Partly cloudy',     icon: '⛅' },
  3:  { label: 'Overcast',          icon: '☁️' },
  45: { label: 'Foggy',             icon: '🌫' },
  48: { label: 'Icy fog',           icon: '🌫' },
  51: { label: 'Light drizzle',     icon: '🌦' },
  61: { label: 'Light rain',        icon: '🌧' },
  63: { label: 'Moderate rain',     icon: '🌧' },
  65: { label: 'Heavy rain',        icon: '🌧' },
  71: { label: 'Light snow',        icon: '🌨' },
  73: { label: 'Moderate snow',     icon: '❄️' },
  75: { label: 'Heavy snow',        icon: '❄️' },
  80: { label: 'Rain showers',      icon: '🌦' },
  95: { label: 'Thunderstorm',      icon: '⛈' },
};

function wmo(code: number) {
  const k = Object.keys(WMO_CODE).map(Number).sort((a, b) => b - a).find(k => code >= k) ?? 0;
  return WMO_CODE[k] ?? { label: 'Unknown', icon: '🌡' };
}

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city') ?? '';
  if (!city) return NextResponse.json({ error: 'city required' }, { status: 400 });

  const geo = await geocode(city);
  if (!geo) return NextResponse.json({ error: 'City not found' }, { status: 404 });

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude',           String(geo.lat));
    url.searchParams.set('longitude',          String(geo.lon));
    url.searchParams.set('daily',              'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max,windspeed_10m_max');
    url.searchParams.set('hourly',             'relativehumidity_2m');
    url.searchParams.set('current_weather',    'true');
    url.searchParams.set('timezone',           'auto');
    url.searchParams.set('forecast_days',      '7');
    url.searchParams.set('temperature_unit',   'celsius');
    url.searchParams.set('windspeed_unit',     'kmh');

    const res  = await fetch(url.toString(), { next: { revalidate: 1800 } });
    const data = await res.json();

    const daily   = data.daily;
    const current = data.current_weather;

    const forecast = (daily.time as string[]).map((date: string, i: number) => ({
      date,
      high:      Math.round(daily.temperature_2m_max[i]),
      low:       Math.round(daily.temperature_2m_min[i]),
      rain:      daily.precipitation_sum[i] ?? 0,
      uv:        Math.round(daily.uv_index_max?.[i] ?? 0),
      wind:      Math.round(daily.windspeed_10m_max[i]),
      ...wmo(daily.weathercode[i]),
    }));

    // average humidity from first 24h
    const humSamples = (data.hourly?.relativehumidity_2m as number[] | undefined)?.slice(0, 24) ?? [];
    const humidity   = humSamples.length
      ? Math.round(humSamples.reduce((a, b) => a + b, 0) / humSamples.length)
      : null;

    return NextResponse.json({
      city:       geo.name,
      lat:        geo.lat,
      lon:        geo.lon,
      current: {
        temp:      Math.round(current.temperature),
        wind:      Math.round(current.windspeed),
        ...wmo(current.weathercode),
      },
      humidity,
      forecast,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
