// The Sky widget (CORE-112): sunrise and sunset for a town you pick, the
// moon's phase and the season, all worked out on the phone (nothing to
// look up). Pure, so the sums are unit-tested. Times are shown in the
// phone's own time zone.

const rad = Math.PI / 180;
const DAY_MS = 86400000;
const toJulian = (ms: number) => ms / DAY_MS + 2440587.5;
const fromJulian = (j: number) => new Date((j - 2440587.5) * DAY_MS);

export type SunTimes =
  | { kind: "normal"; sunrise: Date; sunset: Date; noon: Date }
  // Far north or south: the sun doesn't rise, or doesn't set, today.
  | { kind: "polarNight"; noon: Date }
  | { kind: "midnightSun"; noon: Date };

// The sunrise equation (as NOAA's simpler form): when the sun's top edge
// crosses the horizon at this latitude and longitude on `date`'s day.
export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  const middayUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const n = Math.round(toJulian(middayUtc) - 2451545.0 + 0.0008);
  const meanSolar = n - lon / 360;
  const anomaly = (357.5291 + 0.98560028 * meanSolar) % 360;
  const center = 1.9148 * Math.sin(anomaly * rad) + 0.02 * Math.sin(2 * anomaly * rad) + 0.0003 * Math.sin(3 * anomaly * rad);
  const longitude = (anomaly + center + 180 + 102.9372) % 360;
  const transit = 2451545.0 + meanSolar + 0.0053 * Math.sin(anomaly * rad) - 0.0069 * Math.sin(2 * longitude * rad);
  const sinDec = Math.sin(longitude * rad) * Math.sin(23.4397 * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosHour = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDec) / (Math.cos(lat * rad) * cosDec);
  const noon = fromJulian(transit);
  if (cosHour > 1) return { kind: "polarNight", noon };
  if (cosHour < -1) return { kind: "midnightSun", noon };
  const hour = Math.acos(cosHour) / rad / 360;
  return { kind: "normal", sunrise: fromJulian(transit - hour), sunset: fromJulian(transit + hour), noon };
}

// How far across the sky the sun is, 0 at sunrise to 1 at sunset, or null
// at night.
export function sunProgress(now: Date, sun: SunTimes): number | null {
  if (sun.kind === "midnightSun") return 0.5;
  if (sun.kind === "polarNight") return null;
  const t = (now.getTime() - sun.sunrise.getTime()) / (sun.sunset.getTime() - sun.sunrise.getTime());
  return t < 0 || t > 1 ? null : t;
}

// "10h 42m of daylight".
export function daylightWords(sun: SunTimes) {
  if (sun.kind === "midnightSun") return "The sun won't set today";
  if (sun.kind === "polarNight") return "The sun won't rise today";
  const minutes = Math.round((sun.sunset.getTime() - sun.sunrise.getTime()) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m of daylight`;
}

// --- The moon ----------------------------------------------------------------

const SYNODIC = 29.530588853;
// A new moon everyone agrees on: 6 January 2000, 18:14 UTC.
const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14);

export type MoonName =
  | "New moon"
  | "Waxing crescent"
  | "First quarter"
  | "Waxing gibbous"
  | "Full moon"
  | "Waning gibbous"
  | "Last quarter"
  | "Waning crescent";

// `phase` runs 0 (new) → 0.5 (full) → 1 (new again); `lit` is how much of
// the face is lit, 0 to 1.
export function moonPhase(date: Date): { phase: number; lit: number; name: MoonName; daysToFull: number } {
  const age = ((((date.getTime() - KNOWN_NEW) / DAY_MS) % SYNODIC) + SYNODIC) % SYNODIC;
  const phase = age / SYNODIC;
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const name: MoonName =
    phase < 0.0339 || phase > 0.9661
      ? "New moon"
      : phase < 0.216
        ? "Waxing crescent"
        : phase < 0.284
          ? "First quarter"
          : phase < 0.466
            ? "Waxing gibbous"
            : phase < 0.534
              ? "Full moon"
              : phase < 0.716
                ? "Waning gibbous"
                : phase < 0.784
                  ? "Last quarter"
                  : "Waning crescent";
  const daysToFull = Math.round((((0.5 - phase + 1) % 1) * SYNODIC) % SYNODIC);
  return { phase, lit, name, daysToFull };
}

// An SVG path for the lit part of a moon of radius `r` centred at (cx, cy).
// Waxing moons are lit on the right, waning on the left (as seen from the
// northern half of the world).
export function moonLitPath(phase: number, cx: number, cy: number, r: number) {
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  if (lit < 0.01) return "";
  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  const bulge = Math.abs(1 - 2 * lit) * r;
  const waxing = phase < 0.5;
  const gibbous = lit > 0.5;
  // Round the lit side, then back along the line between light and dark.
  const edge = waxing ? `A ${r} ${r} 0 0 1 ${bottom}` : `A ${r} ${r} 0 0 0 ${bottom}`;
  const back = `A ${bulge} ${r} 0 0 ${waxing === gibbous ? 1 : 0} ${top}`;
  return `M ${top} ${edge} ${back} Z`;
}

// --- The season --------------------------------------------------------------

export type Season = "spring" | "summer" | "fall" | "winter";

export const seasonInfo: Record<Season, { label: string; icon: "flower" | "sun" | "leaf" | "christmas" }> = {
  spring: { label: "Spring", icon: "flower" },
  summer: { label: "Summer", icon: "sun" },
  fall: { label: "Fall", icon: "leaf" },
  winter: { label: "Winter", icon: "christmas" },
};

// By month, as weather people count it; flipped south of the equator.
export function seasonOf(date: Date, lat: number | null = null): Season {
  const north: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "winter"];
  const season = north[date.getMonth()];
  if (lat === null || lat >= 0) return season;
  return ({ spring: "fall", summer: "winter", fall: "spring", winter: "summer" } as const)[season];
}
