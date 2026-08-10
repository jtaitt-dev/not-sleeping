import type { Player } from "@/types/domain";

const failedUrls = new Set<string>();
const SLEEPER_CDN = "https://sleepercdn.com/content/nfl/players";

export function resolvePlayerHeadshot(
  player: Pick<Player, "sleeperId" | "id" | "position">,
  size: "thumb" | "full" = "thumb",
): string | null {
  if (player.position === "DEF") return null;
  const id = safeId(player.sleeperId ?? player.id);
  if (!id) return null;
  const url =
    size === "full"
      ? `${SLEEPER_CDN}/${id}.jpg`
      : `${SLEEPER_CDN}/thumb/${id}.jpg`;
  return failedUrls.has(url) ? null : url;
}

export function markPlayerHeadshotFailed(url: string): void {
  if (url.startsWith(`${SLEEPER_CDN}/`)) failedUrls.add(url);
}

export function hasPlayerHeadshotFailed(url: string): boolean {
  return failedUrls.has(url);
}

export function resetFailedPlayerHeadshots(): void {
  failedUrls.clear();
}

function safeId(value: string | undefined): string | null {
  // Sleeper NFL player identifiers are numeric. Synthetic/import IDs may be
  // otherwise safe strings, but treating them as CDN keys can show a wrong
  // person's photo if the value later collides with a real asset.
  return value && /^\d{1,20}$/.test(value) ? value : null;
}
