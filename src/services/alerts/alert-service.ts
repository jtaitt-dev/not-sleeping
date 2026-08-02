export type AlertType =
  | "draft_turn"
  | "watched_player_drafted"
  | "injury_update"
  | "inactive_lineup"
  | "weather_threshold"
  | "waiver_deadline"
  | "taxi_deadline"
  | "trade_deadline"
  | "rookie_draft"
  | "research_complete";

export type LeagueAlertSettings = {
  enabled: boolean;
  types: AlertType[];
  includePrivateDetails: boolean;
};

export type AlertSettings = {
  enabled: boolean;
  quietHours: { start: string; end: string } | null;
  leagues: Record<string, LeagueAlertSettings>;
};

export type AlertRequest = {
  id: string;
  leagueId: string;
  type: AlertType;
  title: string;
  message: string;
  privateMessage?: string;
  expiresAt: number;
};

const SETTINGS_KEY = "phase2AlertSettings";
const HISTORY_KEY = "phase2AlertHistory";
export const ALERT_TYPES: AlertType[] = [
  "draft_turn",
  "watched_player_drafted",
  "injury_update",
  "inactive_lineup",
  "weather_threshold",
  "waiver_deadline",
  "taxi_deadline",
  "trade_deadline",
  "rookie_draft",
  "research_complete",
];

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: false,
  quietHours: { start: "22:00", end: "07:00" },
  leagues: {},
};

export async function requestNotificationsPermission(): Promise<boolean> {
  if (!hasChromeAlerts()) return false;
  return chrome.permissions.request({ permissions: ["notifications"] });
}

export async function hasNotificationsPermission(): Promise<boolean> {
  if (!hasChromeAlerts()) return false;
  return chrome.permissions.contains({ permissions: ["notifications"] });
}

export async function getAlertSettings(): Promise<AlertSettings> {
  if (!hasChromeAlerts()) return structuredClone(DEFAULT_ALERT_SETTINGS);
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return parseAlertSettings(stored[SETTINGS_KEY]);
}

export async function saveAlertSettings(
  settings: AlertSettings,
): Promise<AlertSettings> {
  const parsed = parseAlertSettings(settings);
  if (hasChromeAlerts())
    await chrome.storage.local.set({ [SETTINGS_KEY]: parsed });
  return parsed;
}

export async function showLocalAlert(
  request: AlertRequest,
  now = Date.now(),
): Promise<
  | "shown"
  | "disabled"
  | "quiet"
  | "duplicate"
  | "expired"
  | "permission_missing"
> {
  if (request.expiresAt <= now) return "expired";
  const settings = await getAlertSettings();
  if (!settings.enabled) return "disabled";
  const league = settings.leagues[request.leagueId] ?? {
    enabled: true,
    types: ALERT_TYPES,
    includePrivateDetails: false,
  };
  if (!league.enabled || !league.types.includes(request.type))
    return "disabled";
  if (settings.quietHours && isQuietTime(new Date(now), settings.quietHours))
    return "quiet";
  if (!(await hasNotificationsPermission())) return "permission_missing";
  const history = await readHistory();
  const previous = history[request.id];
  if (previous !== undefined && previous > now - 24 * 60 * 60_000)
    return "duplicate";
  const message =
    league.includePrivateDetails && request.privateMessage
      ? request.privateMessage
      : request.message;
  await chrome.notifications.create(`not-sleeping:${request.id}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("/icons/icon-128.png"),
    title: request.title.slice(0, 120),
    message: message.slice(0, 240),
  });
  history[request.id] = now;
  const recent = Object.fromEntries(
    Object.entries(history)
      .filter(([, timestamp]) => timestamp > now - 7 * 24 * 60 * 60_000)
      .slice(-500),
  );
  await chrome.storage.local.set({ [HISTORY_KEY]: recent });
  return "shown";
}

export function isQuietTime(
  date: Date,
  quiet: { start: string; end: string },
): boolean {
  const minute = date.getHours() * 60 + date.getMinutes();
  const start = parseClock(quiet.start);
  const end = parseClock(quiet.end);
  if (start === null || end === null || start === end) return false;
  return start < end
    ? minute >= start && minute < end
    : minute >= start || minute < end;
}

function parseAlertSettings(value: unknown): AlertSettings {
  if (!value || typeof value !== "object")
    return structuredClone(DEFAULT_ALERT_SETTINGS);
  const record = value as Record<string, unknown>;
  const leagues: Record<string, LeagueAlertSettings> = {};
  if (record["leagues"] && typeof record["leagues"] === "object") {
    for (const [leagueId, candidate] of Object.entries(
      record["leagues"] as Record<string, unknown>,
    )) {
      if (!candidate || typeof candidate !== "object" || leagueId.length > 80)
        continue;
      const league = candidate as Record<string, unknown>;
      leagues[leagueId] = {
        enabled: league["enabled"] !== false,
        types: Array.isArray(league["types"])
          ? league["types"].filter((type): type is AlertType =>
              ALERT_TYPES.includes(type as AlertType),
            )
          : [...ALERT_TYPES],
        includePrivateDetails: league["includePrivateDetails"] === true,
      };
    }
  }
  const quiet = record["quietHours"];
  const quietHours =
    quiet && typeof quiet === "object"
      ? {
          start: clockOrDefault(
            (quiet as Record<string, unknown>)["start"],
            "22:00",
          ),
          end: clockOrDefault(
            (quiet as Record<string, unknown>)["end"],
            "07:00",
          ),
        }
      : null;
  return { enabled: record["enabled"] === true, quietHours, leagues };
}

async function readHistory(): Promise<Record<string, number>> {
  if (!hasChromeAlerts()) return {};
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  if (!stored[HISTORY_KEY] || typeof stored[HISTORY_KEY] !== "object")
    return {};
  return Object.fromEntries(
    Object.entries(stored[HISTORY_KEY] as Record<string, unknown>).flatMap(
      ([key, value]) =>
        typeof value === "number" && Number.isFinite(value)
          ? [[key, value]]
          : [],
    ),
  );
}

function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

function clockOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && parseClock(value) !== null
    ? value
    : fallback;
}

function hasChromeAlerts(): boolean {
  return typeof chrome !== "undefined";
}
