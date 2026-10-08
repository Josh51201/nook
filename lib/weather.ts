import type { IconName } from "../components/icon";
import type { AmbienceKind } from "./decor";
import type { HearthItem } from "./hearth-layout";

// Weather for the Weather and Window widgets (CORE-056, CORE-057): pure, so
// it's unit-testable. You pick a place by name; Nook never asks for your
// phone's location. The weather comes from Open-Meteo, a free service that
// needs no account: it is sent only the place you picked. Fetching is in
// lib/weather-data.ts.

export type Place = { name: string; lat: number; lon: number; region?: string };

export type Unit = "f" | "c";

export type Condition = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunder";

export const conditions: { key: Condition; label: string }[] = [
  { key: "clear", label: "Clear" },
  { key: "partly", label: "Partly cloudy" },
  { key: "cloudy", label: "Cloudy" },
  { key: "fog", label: "Foggy" },
  { key: "drizzle", label: "Drizzle" },
  { key: "rain", label: "Rain" },
  { key: "snow", label: "Snow" },
  { key: "thunder", label: "Thunderstorm" },
];

// WMO weather codes, as Open-Meteo reports them.
export function conditionFromCode(code: number): Condition {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  return "cloudy";
}

export function conditionLabel(condition: Condition) {
  return conditions.find((c) => c.key === condition)?.label ?? "Clear";
}

export function conditionIcon(condition: Condition, isDay: boolean): IconName {
  switch (condition) {
    case "clear":
      return isDay ? "sun" : "moon";
    case "partly":
      return isDay ? "sun" : "cloud";
    case "cloudy":
    case "fog":
      return "cloud";
    case "drizzle":
    case "rain":
      return "umbrella";
    case "snow":
      return "christmas";
    case "thunder":
      return "bolt";
  }
}

export type ForecastDay = { day: string; condition: Condition; high: number; low: number };

export type Weather = {
  temp: number;
  condition: Condition;
  isDay: boolean;
  days: ForecastDay[];
};

// --- Talking to Open-Meteo ---------------------------------------------------------------

export function geocodingUrl(query: string) {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=en&format=json`;
}

export function forecastUrl(place: Place, unit: Unit) {
  const params = [
    `latitude=${place.lat.toFixed(4)}`,
    `longitude=${place.lon.toFixed(4)}`,
    "current=temperature_2m,weather_code,is_day",
    "daily=weather_code,temperature_2m_max,temperature_2m_min",
    `temperature_unit=${unit === "f" ? "fahrenheit" : "celsius"}`,
    "timezone=auto",
    "forecast_days=3",
  ];
  return `https://api.open-meteo.com/v1/forecast?${params.join("&")}`;
}

// What the geocoding service sends back, as a list of places (never throws).
export function parsePlaces(json: unknown): Place[] {
  const results = (json as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((r) => {
    const item = r as { name?: unknown; latitude?: unknown; longitude?: unknown; admin1?: unknown; country?: unknown };
    if (typeof item.name !== "string" || typeof item.latitude !== "number" || typeof item.longitude !== "number") return [];
    const region = [item.admin1, item.country].filter((v): v is string => typeof v === "string" && v.length > 0).join(", ");
    return [{ name: item.name, lat: item.latitude, lon: item.longitude, region: region || undefined }];
  });
}

// What the forecast service sends back, as the weather (or null if it
// isn't what we expected).
export function parseWeather(json: unknown): Weather | null {
  const data = json as {
    current?: { temperature_2m?: unknown; weather_code?: unknown; is_day?: unknown };
    daily?: { time?: unknown[]; weather_code?: unknown[]; temperature_2m_max?: unknown[]; temperature_2m_min?: unknown[] };
  } | null;
  const current = data?.current;
  if (!current || typeof current.temperature_2m !== "number" || typeof current.weather_code !== "number") return null;

  const daily = data?.daily;
  const days: ForecastDay[] = [];
  if (daily && Array.isArray(daily.time)) {
    daily.time.forEach((day, i) => {
      const code = daily.weather_code?.[i];
      const high = daily.temperature_2m_max?.[i];
      const low = daily.temperature_2m_min?.[i];
      if (typeof day === "string" && typeof code === "number" && typeof high === "number" && typeof low === "number") {
        days.push({ day, condition: conditionFromCode(code), high, low });
      }
    });
  }
  return {
    temp: current.temperature_2m,
    condition: conditionFromCode(current.weather_code),
    isDay: current.is_day !== 0,
    days,
  };
}

export function formatTemp(value: number) {
  return `${Math.round(value)}°`;
}

// "Today", "Tomorrow", then the weekday.
export function dayName(day: string, today: string) {
  if (day === today) return "Today";
  const [y, m, d] = day.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const gap = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  if (gap === 1) return "Tomorrow";
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
}

export function placeLabel(place: Place) {
  return place.region ? `${place.name}, ${place.region}` : place.name;
}

// --- The Window widget (CORE-057) ----------------------------------------------------------

export type WindowFrame = "wood" | "white" | "sage";

export const windowFrames: { key: WindowFrame; label: string }[] = [
  { key: "wood", label: "Wood" },
  { key: "white", label: "White" },
  { key: "sage", label: "Sage" },
];

// Daytime by the phone's clock, for a sky you chose (live weather says for itself).
export function isDaytime(now: Date) {
  const hour = now.getHours();
  return hour >= 6 && hour < 19;
}

// What to show outside a window: the live weather once it's in (clear until
// then), or the sky you chose; day or night from the weather, the clock, or your pick.
export function windowSky(
  settings: { source: "live" | "pick"; condition: Condition; time: "auto" | "day" | "night" },
  weather: Weather | null,
  now: Date
): { condition: Condition; isDay: boolean } {
  const live = settings.source === "live";
  const condition = live ? weather?.condition ?? "clear" : settings.condition;
  const isDay = settings.time === "day" ? true : settings.time === "night" ? false : live && weather ? weather.isDay : isDaytime(now);
  return { condition, isDay };
}

// --- Ambience that matches the weather (CORE-058) ---------------------------------------------

// The air over the Hearth for the weather outside: rain for rain, drizzle and
// storms, snow for snow, and nothing special otherwise (null: follow the season).
export function ambienceForWeather(condition: Condition): AmbienceKind | null {
  if (condition === "rain" || condition === "drizzle" || condition === "thunder") return "rain";
  if (condition === "snow") return "snow";
  return null;
}

// The place to match: the first Weather widget, or Window showing live
// weather, that has one, on the Hearth before inside any Hollow.
export function weatherPlaceOf(items: HearthItem[]): { place: Place; unit: Unit } | null {
  const fromItem = (item: HearthItem) => {
    if (item.kind !== "widget") return null;
    const w = item.widget;
    if (w.kind === "weather" && w.settings.place) return { place: w.settings.place, unit: w.settings.unit };
    if (w.kind === "window" && w.settings.source === "live" && w.settings.place) return { place: w.settings.place, unit: w.settings.unit };
    return null;
  };
  for (const item of items) {
    const found = fromItem(item);
    if (found) return found;
  }
  for (const item of items) {
    if (item.kind !== "hollow") continue;
    for (const inner of item.items) {
      const found = fromItem(inner);
      if (found) return found;
    }
  }
  return null;
}
