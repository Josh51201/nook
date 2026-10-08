import { describe, expect, it } from "vitest";

import { activeAmbience } from "../lib/decor";
import type { HearthItem } from "../lib/hearth-layout";
import {
  ambienceForWeather,
  conditionFromCode,
  dayName,
  forecastUrl,
  geocodingUrl,
  parsePlaces,
  parseWeather,
  placeLabel,
  weatherPlaceOf,
  windowSky,
  type Place,
  type Weather,
} from "../lib/weather";
import { defaultWidget, type WidgetConfig } from "../lib/widgets";

const austin: Place = { name: "Austin", lat: 30.2672, lon: -97.7431, region: "Texas, United States" };
const at = (hour: number) => new Date(2026, 9, 8, hour, 0);
const weather = (over: Partial<Weather> = {}): Weather => ({ temp: 61.4, condition: "rain", isDay: false, days: [], ...over });

describe("weather codes (CORE-056)", () => {
  it("turns Open-Meteo's codes into our conditions", () => {
    expect(conditionFromCode(0)).toBe("clear");
    expect(conditionFromCode(1)).toBe("clear");
    expect(conditionFromCode(2)).toBe("partly");
    expect(conditionFromCode(3)).toBe("cloudy");
    expect(conditionFromCode(45)).toBe("fog");
    expect(conditionFromCode(53)).toBe("drizzle");
    expect(conditionFromCode(63)).toBe("rain");
    expect(conditionFromCode(81)).toBe("rain");
    expect(conditionFromCode(73)).toBe("snow");
    expect(conditionFromCode(86)).toBe("snow");
    expect(conditionFromCode(95)).toBe("thunder");
    expect(conditionFromCode(99)).toBe("thunder");
    expect(conditionFromCode(42)).toBe("cloudy"); // anything unknown
  });
});

describe("talking to Open-Meteo", () => {
  it("sends only the place, never a key or anything about you", () => {
    expect(geocodingUrl("  San José ")).toBe(
      "https://geocoding-api.open-meteo.com/v1/search?name=San%20Jos%C3%A9&count=6&language=en&format=json"
    );
    const url = forecastUrl(austin, "f");
    expect(url).toContain("latitude=30.2672");
    expect(url).toContain("longitude=-97.7431");
    expect(url).toContain("temperature_unit=fahrenheit");
    expect(forecastUrl(austin, "c")).toContain("temperature_unit=celsius");
  });

  it("reads places, skipping anything odd", () => {
    const places = parsePlaces({
      results: [
        { name: "Austin", latitude: 30.27, longitude: -97.74, admin1: "Texas", country: "United States" },
        { name: "Nowhere", latitude: "x", longitude: 1 },
        { name: "Austin", latitude: 43.67, longitude: -92.97, country: "United States" },
      ],
    });
    expect(places).toEqual([
      { name: "Austin", lat: 30.27, lon: -97.74, region: "Texas, United States" },
      { name: "Austin", lat: 43.67, lon: -92.97, region: "United States" },
    ]);
    expect(parsePlaces(null)).toEqual([]);
    expect(parsePlaces({})).toEqual([]);
    expect(placeLabel(places[0])).toBe("Austin, Texas, United States");
    expect(placeLabel({ name: "Paris", lat: 0, lon: 0 })).toBe("Paris");
  });

  it("reads the weather now and the next days", () => {
    const parsed = parseWeather({
      current: { temperature_2m: 71.2, weather_code: 2, is_day: 1 },
      daily: {
        time: ["2026-10-08", "2026-10-09", "2026-10-10"],
        weather_code: [2, 61, 71],
        temperature_2m_max: [75, 68, 40],
        temperature_2m_min: [58, 55, null],
      },
    });
    expect(parsed).toEqual({
      temp: 71.2,
      condition: "partly",
      isDay: true,
      days: [
        { day: "2026-10-08", condition: "partly", high: 75, low: 58 },
        { day: "2026-10-09", condition: "rain", high: 68, low: 55 },
      ],
    });
    expect(parseWeather({ current: { temperature_2m: 50, weather_code: 0, is_day: 0 } })?.isDay).toBe(false);
    expect(parseWeather({})).toBeNull();
    expect(parseWeather(null)).toBeNull();
  });

  it("names the days", () => {
    expect(dayName("2026-10-08", "2026-10-08")).toBe("Today");
    expect(dayName("2026-10-09", "2026-10-08")).toBe("Tomorrow");
    expect(dayName("2026-11-01", "2026-10-31")).toBe("Tomorrow");
    expect(dayName("2026-10-10", "2026-10-08")).toBe(new Date(2026, 9, 10).toLocaleDateString(undefined, { weekday: "short" }));
  });
});

describe("the Window widget (CORE-057)", () => {
  const pick = { source: "pick" as const, condition: "snow" as const, time: "auto" as const };
  const live = { ...pick, source: "live" as const };

  it("shows the sky you chose, day or night by the clock", () => {
    expect(windowSky(pick, null, at(12))).toEqual({ condition: "snow", isDay: true });
    expect(windowSky(pick, null, at(22))).toEqual({ condition: "snow", isDay: false });
    expect(windowSky(pick, null, at(5))).toEqual({ condition: "snow", isDay: false });
    // Live weather is ignored when you chose your own sky.
    expect(windowSky(pick, weather(), at(12))).toEqual({ condition: "snow", isDay: true });
  });

  it("shows the real weather when live, and a clear sky until it arrives", () => {
    expect(windowSky(live, weather(), at(12))).toEqual({ condition: "rain", isDay: false });
    expect(windowSky(live, null, at(12))).toEqual({ condition: "clear", isDay: true });
  });

  it("can be always day or always night", () => {
    expect(windowSky({ ...live, time: "day" }, weather(), at(23))).toEqual({ condition: "rain", isDay: true });
    expect(windowSky({ ...pick, time: "night" }, null, at(12))).toEqual({ condition: "snow", isDay: false });
  });

  it("starts as a rainy window you chose, so it never asks for a place first", () => {
    const w = defaultWidget("window");
    expect(w.kind === "window" && w.settings.source).toBe("pick");
    expect(w.kind === "window" && w.settings.place).toBeNull();
    const weatherWidget = defaultWidget("weather");
    expect(weatherWidget.kind === "weather" && weatherWidget.settings.place).toBeNull();
  });
});

describe("ambience that matches the weather (CORE-058)", () => {
  it("rains for rain, drizzle and storms, snows for snow", () => {
    expect(ambienceForWeather("rain")).toBe("rain");
    expect(ambienceForWeather("drizzle")).toBe("rain");
    expect(ambienceForWeather("thunder")).toBe("rain");
    expect(ambienceForWeather("snow")).toBe("snow");
    expect(ambienceForWeather("clear")).toBeNull();
    expect(ambienceForWeather("fog")).toBeNull();
  });

  it("follows the season when it's not raining or snowing, or not known yet", () => {
    const winterNoon = new Date(2026, 0, 10, 12);
    const summerNoon = new Date(2026, 6, 10, 12);
    expect(activeAmbience("weather", summerNoon, "rain")).toBe("rain");
    expect(activeAmbience("weather", summerNoon, null)).toBe("motes");
    expect(activeAmbience("weather", winterNoon, undefined)).toBe("snow");
    expect(activeAmbience("rain", summerNoon)).toBe("rain");
  });

  const widget = (id: string, config: WidgetConfig): HearthItem => ({ id, kind: "widget", x: 0, y: 0, w: 2, h: 2, widget: config });
  const weatherAt = (place: Place | null, unit: "f" | "c" = "f"): WidgetConfig => ({
    ...defaultWidget("weather"),
    kind: "weather",
    settings: { place, unit, showForecast: true },
  });
  const windowAt = (source: "live" | "pick", place: Place | null): WidgetConfig => {
    const base = defaultWidget("window");
    if (base.kind !== "window") throw new Error("not a window");
    return { ...base, settings: { ...base.settings, source, place } };
  };
  const paris: Place = { name: "Paris", lat: 48.85, lon: 2.35 };

  it("finds the place on your Weather widget, or a live Window", () => {
    expect(weatherPlaceOf([])).toBeNull();
    expect(weatherPlaceOf([widget("a", weatherAt(null))])).toBeNull();
    expect(weatherPlaceOf([widget("a", weatherAt(austin, "c"))])).toEqual({ place: austin, unit: "c" });
    // A window showing a sky you chose doesn't count, even with a place saved.
    expect(weatherPlaceOf([widget("a", windowAt("pick", paris))])).toBeNull();
    expect(weatherPlaceOf([widget("a", windowAt("live", paris))])?.place).toEqual(paris);
  });

  it("prefers the Hearth over a Hollow", () => {
    const hollow: HearthItem = { id: "h", kind: "hollow", x: 0, y: 0, w: 1, h: 1, name: "Den", look: "house", items: [widget("b", weatherAt(paris))] };
    expect(weatherPlaceOf([hollow])?.place).toEqual(paris);
    expect(weatherPlaceOf([hollow, widget("a", weatherAt(austin))])?.place).toEqual(austin);
  });
});
