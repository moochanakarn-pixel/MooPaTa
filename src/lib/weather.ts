// Weather at the time/place of an activity, via Open-Meteo's free, keyless
// historical archive API (https://open-meteo.com — no signup, no API key).
// Uses hourly reanalysis data, which typically lags a few days behind
// real-time, so very recent activities may come back empty — callers should
// treat a null result as "not available yet", not an error.

export interface ActivityWeather {
  temperatureC: number;
  windKmh: number;
  weatherCode: number;
}

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    weathercode: (number | null)[];
    windspeed_10m: (number | null)[];
  };
}

export async function fetchActivityWeather(
  lat: number,
  lng: number,
  startedAt: Date
): Promise<ActivityWeather | null> {
  const dateStr = startedAt.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    start_date: dateStr,
    end_date: dateStr,
    hourly: "temperature_2m,weathercode,windspeed_10m",
    timezone: "UTC",
  });

  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`);
  if (!res.ok) return null;

  const data = (await res.json()) as OpenMeteoResponse;
  const hourly = data.hourly;
  if (!hourly || hourly.time.length === 0) return null;

  // Find the hour closest to the activity's start time.
  const targetMs = startedAt.getTime();
  let bestIndex = 0;
  let bestDiff = Infinity;
  hourly.time.forEach((t, i) => {
    const diff = Math.abs(new Date(`${t}:00Z`).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  });

  const temperatureC = hourly.temperature_2m[bestIndex];
  const windKmh = hourly.windspeed_10m[bestIndex];
  const weatherCode = hourly.weathercode[bestIndex];
  if (temperatureC === null || windKmh === null || weatherCode === null) return null;

  return { temperatureC, windKmh, weatherCode };
}

// WMO weather interpretation codes, condensed to what's worth showing.
const WEATHER_LABELS: Record<number, string> = {
  0: "ท้องฟ้าแจ่มใส",
  1: "แจ่มใสเป็นส่วนใหญ่",
  2: "มีเมฆบางส่วน",
  3: "มีเมฆมาก",
  45: "หมอก",
  48: "หมอกน้ำแข็ง",
  51: "ฝนปรอยเบา",
  53: "ฝนปรอย",
  55: "ฝนปรอยหนัก",
  61: "ฝนตกเบา",
  63: "ฝนตก",
  65: "ฝนตกหนัก",
  71: "หิมะตกเบา",
  73: "หิมะตก",
  75: "หิมะตกหนัก",
  80: "ฝนตกเป็นช่วง",
  81: "ฝนตกเป็นช่วงหนัก",
  82: "ฝนตกเป็นช่วงรุนแรง",
  95: "พายุฝนฟ้าคะนอง",
  96: "พายุฝนฟ้าคะนองมีลูกเห็บ",
  99: "พายุฝนฟ้าคะนองรุนแรง",
};

export function weatherLabel(code: number): string {
  return WEATHER_LABELS[code] ?? "ไม่ทราบสภาพอากาศ";
}

const WEATHER_ICONS: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
};

export function weatherIcon(code: number): string {
  if (WEATHER_ICONS[code]) return WEATHER_ICONS[code];
  if (code >= 51 && code <= 67) return "🌦️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}
