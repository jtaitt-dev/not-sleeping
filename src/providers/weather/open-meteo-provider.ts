import { z } from "zod";

import { AppError } from "@/services/errors/app-error";

export type StadiumRoof = "dome" | "retractable" | "outdoor";

export type Stadium = {
  team: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  roof: StadiumRoof;
  surface: "grass" | "turf" | "hybrid" | "unknown";
};

export type StadiumWeather = {
  team: string;
  stadium: string;
  kickoff: string;
  retrievedAt: string;
  roof: StadiumRoof;
  roofStatus: "open" | "closed" | "unknown";
  temperatureF: number | null;
  apparentTemperatureF: number | null;
  precipitationProbability: number | null;
  precipitationInches: number | null;
  snowfallInches: number | null;
  windMph: number | null;
  windGustMph: number | null;
  humidity: number | null;
  visibilityMiles: number | null;
  weatherCode: number | null;
  forecastAgeMs: number;
  hoursUntilKickoff: number;
  uncertainty: number;
  sourceUrl: string;
};

const hourlySchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(z.number().nullable()).optional(),
  apparent_temperature: z.array(z.number().nullable()).optional(),
  precipitation_probability: z.array(z.number().nullable()).optional(),
  precipitation: z.array(z.number().nullable()).optional(),
  snowfall: z.array(z.number().nullable()).optional(),
  relative_humidity_2m: z.array(z.number().nullable()).optional(),
  visibility: z.array(z.number().nullable()).optional(),
  wind_speed_10m: z.array(z.number().nullable()).optional(),
  wind_gusts_10m: z.array(z.number().nullable()).optional(),
  weather_code: z.array(z.number().nullable()).optional(),
});

const forecastSchema = z
  .object({
    generationtime_ms: z.number().optional(),
    utc_offset_seconds: z.number().optional(),
    timezone: z.string().optional(),
    hourly: hourlySchema,
  })
  .loose();

const stadiumRows = [
  [
    "ARI",
    "State Farm Stadium",
    33.5276,
    -112.2626,
    "America/Phoenix",
    "retractable",
    "grass",
  ],
  [
    "ATL",
    "Mercedes-Benz Stadium",
    33.7554,
    -84.4008,
    "America/New_York",
    "retractable",
    "turf",
  ],
  [
    "BAL",
    "M&T Bank Stadium",
    39.278,
    -76.6227,
    "America/New_York",
    "outdoor",
    "grass",
  ],
  [
    "BUF",
    "Highmark Stadium",
    42.7738,
    -78.7868,
    "America/New_York",
    "outdoor",
    "turf",
  ],
  [
    "CAR",
    "Bank of America Stadium",
    35.2258,
    -80.8528,
    "America/New_York",
    "outdoor",
    "turf",
  ],
  [
    "CHI",
    "Soldier Field",
    41.8623,
    -87.6167,
    "America/Chicago",
    "outdoor",
    "grass",
  ],
  [
    "CIN",
    "Paycor Stadium",
    39.0955,
    -84.5161,
    "America/New_York",
    "outdoor",
    "turf",
  ],
  [
    "CLE",
    "Huntington Bank Field",
    41.5061,
    -81.6995,
    "America/New_York",
    "outdoor",
    "grass",
  ],
  [
    "DAL",
    "AT&T Stadium",
    32.7473,
    -97.0945,
    "America/Chicago",
    "retractable",
    "turf",
  ],
  [
    "DEN",
    "Empower Field at Mile High",
    39.7439,
    -105.0201,
    "America/Denver",
    "outdoor",
    "grass",
  ],
  ["DET", "Ford Field", 42.34, -83.0456, "America/Detroit", "dome", "turf"],
  [
    "GB",
    "Lambeau Field",
    44.5013,
    -88.0622,
    "America/Chicago",
    "outdoor",
    "grass",
  ],
  [
    "HOU",
    "NRG Stadium",
    29.6847,
    -95.4107,
    "America/Chicago",
    "retractable",
    "turf",
  ],
  [
    "IND",
    "Lucas Oil Stadium",
    39.7601,
    -86.1639,
    "America/Indiana/Indianapolis",
    "retractable",
    "turf",
  ],
  [
    "JAX",
    "EverBank Stadium",
    30.3239,
    -81.6373,
    "America/New_York",
    "outdoor",
    "grass",
  ],
  [
    "KC",
    "GEHA Field at Arrowhead Stadium",
    39.0489,
    -94.4839,
    "America/Chicago",
    "outdoor",
    "grass",
  ],
  [
    "LAC",
    "SoFi Stadium",
    33.9535,
    -118.3392,
    "America/Los_Angeles",
    "dome",
    "turf",
  ],
  [
    "LAR",
    "SoFi Stadium",
    33.9535,
    -118.3392,
    "America/Los_Angeles",
    "dome",
    "turf",
  ],
  [
    "LV",
    "Allegiant Stadium",
    36.0909,
    -115.1833,
    "America/Los_Angeles",
    "dome",
    "grass",
  ],
  [
    "MIA",
    "Hard Rock Stadium",
    25.958,
    -80.2389,
    "America/New_York",
    "outdoor",
    "grass",
  ],
  [
    "MIN",
    "U.S. Bank Stadium",
    44.9736,
    -93.2575,
    "America/Chicago",
    "dome",
    "turf",
  ],
  [
    "NE",
    "Gillette Stadium",
    42.0909,
    -71.2643,
    "America/New_York",
    "outdoor",
    "turf",
  ],
  [
    "NO",
    "Caesars Superdome",
    29.9511,
    -90.0812,
    "America/Chicago",
    "dome",
    "turf",
  ],
  [
    "NYG",
    "MetLife Stadium",
    40.8135,
    -74.0745,
    "America/New_York",
    "outdoor",
    "turf",
  ],
  [
    "NYJ",
    "MetLife Stadium",
    40.8135,
    -74.0745,
    "America/New_York",
    "outdoor",
    "turf",
  ],
  [
    "PHI",
    "Lincoln Financial Field",
    39.9008,
    -75.1675,
    "America/New_York",
    "outdoor",
    "hybrid",
  ],
  [
    "PIT",
    "Acrisure Stadium",
    40.4468,
    -80.0158,
    "America/New_York",
    "outdoor",
    "grass",
  ],
  [
    "SEA",
    "Lumen Field",
    47.5952,
    -122.3316,
    "America/Los_Angeles",
    "outdoor",
    "turf",
  ],
  [
    "SF",
    "Levi's Stadium",
    37.403,
    -121.97,
    "America/Los_Angeles",
    "outdoor",
    "grass",
  ],
  [
    "TB",
    "Raymond James Stadium",
    27.9759,
    -82.5033,
    "America/New_York",
    "outdoor",
    "grass",
  ],
  [
    "TEN",
    "Nissan Stadium",
    36.1665,
    -86.7713,
    "America/Chicago",
    "outdoor",
    "turf",
  ],
  [
    "WAS",
    "Northwest Stadium",
    38.9077,
    -76.8645,
    "America/New_York",
    "outdoor",
    "grass",
  ],
] as const satisfies ReadonlyArray<
  readonly [
    string,
    string,
    number,
    number,
    string,
    StadiumRoof,
    Stadium["surface"],
  ]
>;

export const NFL_STADIUMS: Record<string, Stadium> = Object.fromEntries(
  stadiumRows.map(
    ([team, name, latitude, longitude, timezone, roof, surface]) => [
      team,
      { team, name, latitude, longitude, timezone, roof, surface },
    ],
  ),
);

export class OpenMeteoProvider {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async getKickoffWeather(input: {
    team: string;
    kickoff: string;
    roofStatus?: "open" | "closed" | "unknown";
  }): Promise<StadiumWeather> {
    const team = input.team.toUpperCase();
    const stadium = NFL_STADIUMS[team];
    if (!stadium) throw new Error(`No stadium mapping exists for ${team}.`);
    const kickoff = new Date(input.kickoff);
    if (!Number.isFinite(kickoff.getTime()))
      throw new Error("Kickoff must be an ISO date.");
    const params = new URLSearchParams({
      latitude: String(stadium.latitude),
      longitude: String(stadium.longitude),
      timezone: stadium.timezone,
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      precipitation_unit: "inch",
      forecast_days: "16",
      hourly: [
        "temperature_2m",
        "apparent_temperature",
        "precipitation_probability",
        "precipitation",
        "snowfall",
        "relative_humidity_2m",
        "visibility",
        "wind_speed_10m",
        "wind_gusts_10m",
        "weather_code",
      ].join(","),
    });
    const sourceUrl = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    let response: Response;
    try {
      response = await this.fetcher.call(globalThis, sourceUrl, {
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      throw new AppError({
        code: "UNKNOWN",
        message: "The stadium forecast is unavailable.",
        safeDetail: "Open-Meteo could not be reached.",
        suggestedAction: "Keep the last forecast visible and retry later.",
        retryable: true,
        cause: error,
      });
    }
    if (!response.ok)
      throw new Error(`Open-Meteo returned HTTP ${response.status}.`);
    const forecast = forecastSchema.parse(await response.json());
    const index = closestHourIndex(
      forecast.hourly.time,
      kickoff,
      stadium.timezone,
    );
    const retrieved = this.now();
    return {
      team,
      stadium: stadium.name,
      kickoff: kickoff.toISOString(),
      retrievedAt: new Date(retrieved).toISOString(),
      roof: stadium.roof,
      roofStatus:
        stadium.roof === "dome" ? "closed" : (input.roofStatus ?? "unknown"),
      temperatureF: valueAt(forecast.hourly.temperature_2m, index),
      apparentTemperatureF: valueAt(
        forecast.hourly.apparent_temperature,
        index,
      ),
      precipitationProbability: valueAt(
        forecast.hourly.precipitation_probability,
        index,
      ),
      precipitationInches: valueAt(forecast.hourly.precipitation, index),
      snowfallInches: valueAt(forecast.hourly.snowfall, index),
      windMph: valueAt(forecast.hourly.wind_speed_10m, index),
      windGustMph: valueAt(forecast.hourly.wind_gusts_10m, index),
      humidity: valueAt(forecast.hourly.relative_humidity_2m, index),
      visibilityMiles: metersToMiles(
        valueAt(forecast.hourly.visibility, index),
      ),
      weatherCode: valueAt(forecast.hourly.weather_code, index),
      forecastAgeMs: 0,
      hoursUntilKickoff: (kickoff.getTime() - retrieved) / 3_600_000,
      uncertainty: forecastUncertainty(kickoff.getTime() - retrieved),
      sourceUrl,
    };
  }
}

export function weatherAdjustment(
  weather: StadiumWeather,
  position: string,
): { adjustment: number; confidence: number; factors: string[] } {
  if (weather.roof === "dome" || weather.roofStatus === "closed") {
    return { adjustment: 0, confidence: 0.98, factors: ["Indoor conditions"] };
  }
  const factors: string[] = [];
  let adjustment = 0;
  const wind = weather.windMph ?? 0;
  const gust = weather.windGustMph ?? wind;
  const precipitation = weather.precipitationInches ?? 0;
  const temperature = weather.temperatureF;
  const normalized = position.toUpperCase();
  if (wind >= 18 || gust >= 28) {
    if (["QB", "WR"].includes(normalized))
      adjustment -= Math.min(2.5, (wind - 14) * 0.12);
    if (normalized === "K") adjustment -= Math.min(3.5, (wind - 12) * 0.18);
    factors.push(`Wind ${Math.round(wind)} mph, gusts ${Math.round(gust)} mph`);
  }
  if (precipitation >= 0.1) {
    if (["QB", "WR", "K"].includes(normalized))
      adjustment -= Math.min(1.5, precipitation * 4);
    if (normalized === "RB") adjustment += Math.min(0.4, precipitation);
    factors.push(`Precipitation ${precipitation.toFixed(2)} in`);
  }
  if (temperature !== null && (temperature <= 15 || temperature >= 98)) {
    adjustment -= normalized === "K" ? 0.8 : 0.35;
    factors.push(`Extreme temperature ${Math.round(temperature)}°F`);
  }
  const confidence = clamp(1 - weather.uncertainty * 0.65, 0.25, 0.95);
  return {
    adjustment: Math.round(clamp(adjustment, -4, 1) * 100) / 100,
    confidence,
    factors:
      factors.length > 0 ? factors : ["No material weather threshold crossed"],
  };
}

function closestHourIndex(
  times: string[],
  kickoff: Date,
  timezone: string,
): number {
  const local = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
    .format(kickoff)
    .replace(" ", "T");
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const localHour = Date.parse(`${local}:00Z`);
  times.forEach((time, index) => {
    const candidateHour = Date.parse(`${time}:00Z`);
    const distance = Number.isFinite(candidateHour)
      ? Math.abs(candidateHour - localHour)
      : time === local
        ? 0
        : Number.POSITIVE_INFINITY;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function valueAt(
  values: (number | null)[] | undefined,
  index: number,
): number | null {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metersToMiles(value: number | null): number | null {
  return value === null ? null : Math.round((value / 1609.344) * 100) / 100;
}

function forecastUncertainty(millisecondsUntilKickoff: number): number {
  const hours = Math.max(0, millisecondsUntilKickoff / 3_600_000);
  return clamp(hours / (14 * 24), 0.08, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
