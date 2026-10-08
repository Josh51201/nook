import { useEffect, useState } from "react";

import { forecastUrl, geocodingUrl, parsePlaces, parseWeather, type Place, type Unit, type Weather } from "./weather";

// Fetching weather (CORE-056, CORE-057). Only the place you picked is sent,
// to Open-Meteo (open-meteo.com), a free service with no account or key.

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather service said ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Places that match what you typed, e.g. "Austin" -> Austin, Texas, United States.
export async function searchPlaces(query: string): Promise<Place[]> {
  if (query.trim().length < 2) return [];
  return parsePlaces(await getJson(geocodingUrl(query)));
}

// Remembered for 15 minutes, so a Hearth full of weather isn't a flood of requests.
const cache = new Map<string, { at: number; weather: Weather }>();
const inFlight = new Map<string, Promise<Weather>>();
const FRESH_MS = 15 * 60 * 1000;

export async function fetchWeather(place: Place, unit: Unit): Promise<Weather> {
  const key = `${place.lat.toFixed(3)},${place.lon.toFixed(3)},${unit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.weather;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = getJson(forecastUrl(place, unit))
    .then((json) => {
      const weather = parseWeather(json);
      if (!weather) throw new Error("Couldn't read the weather");
      cache.set(key, { at: Date.now(), weather });
      return weather;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export type WeatherState = { weather: Weather | null; loading: boolean; failed: boolean };

// The weather for a place, refreshed when you come back to the screen.
export function useWeather(place: Place | null | undefined, unit: Unit, refreshKey = 0): WeatherState {
  const [state, setState] = useState<WeatherState>({ weather: null, loading: Boolean(place), failed: false });
  const lat = place?.lat;
  const lon = place?.lon;

  useEffect(() => {
    if (!place) {
      setState({ weather: null, loading: false, failed: false });
      return;
    }
    let live = true;
    setState((s) => ({ ...s, loading: s.weather === null, failed: false }));
    fetchWeather(place, unit)
      .then((weather) => live && setState({ weather, loading: false, failed: false }))
      .catch(() => live && setState((s) => ({ weather: s.weather, loading: false, failed: s.weather === null })));
    return () => {
      live = false;
    };
  }, [lat, lon, unit, refreshKey]);

  return state;
}
