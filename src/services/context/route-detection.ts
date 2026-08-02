export type SleeperRouteContext = {
  supported: boolean;
  route:
    | "draft"
    | "league"
    | "matchup"
    | "team"
    | "players"
    | "home"
    | "unsupported";
  leagueId?: string;
  draftId?: string;
  sanitizedUrl: string;
};

const IDENTIFIER = /^[A-Za-z0-9_-]{4,80}$/;

export function parseSleeperRoute(value: string): SleeperRouteContext {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      supported: false,
      route: "unsupported",
      sanitizedUrl: "",
    };
  }
  const supportedHost =
    url.hostname === "sleeper.com" || url.hostname.endsWith(".sleeper.com");
  if (!supportedHost || url.protocol !== "https:") {
    return {
      supported: false,
      route: "unsupported",
      sanitizedUrl: `${url.origin}${url.pathname}`,
    };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const draftIndex = parts.findIndex((part) => part === "draft");
  const leagueIndex = parts.findIndex(
    (part) => part === "leagues" || part === "league",
  );
  const draftCandidate =
    draftIndex >= 0
      ? parts[draftIndex + 1] === "nfl"
        ? parts[draftIndex + 2]
        : parts[draftIndex + 1]
      : undefined;
  const leagueCandidate = leagueIndex >= 0 ? parts[leagueIndex + 1] : undefined;
  const draftId =
    draftCandidate && IDENTIFIER.test(draftCandidate)
      ? draftCandidate
      : undefined;
  const leagueId =
    leagueCandidate && IDENTIFIER.test(leagueCandidate)
      ? leagueCandidate
      : undefined;

  let route: SleeperRouteContext["route"] = "home";
  if (draftId) route = "draft";
  else if (leagueId && parts.includes("matchup")) route = "matchup";
  else if (leagueId && parts.includes("team")) route = "team";
  else if (leagueId && parts.includes("players")) route = "players";
  else if (leagueId) route = "league";

  return {
    supported: true,
    route,
    ...(leagueId ? { leagueId } : {}),
    ...(draftId ? { draftId } : {}),
    sanitizedUrl: `${url.origin}${url.pathname}`,
  };
}

export function observeSleeperNavigation(
  onChange: (context: SleeperRouteContext) => void,
): () => void {
  let lastUrl = location.href;
  let disposed = false;
  const emit = () => {
    if (disposed || location.href === lastUrl) return;
    lastUrl = location.href;
    onChange(parseSleeperRoute(lastUrl));
  };
  // Preserve the original method identities so disposal restores the page exactly.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalPush = history.pushState;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalReplace = history.replaceState;
  history.pushState = function pushState(data, unused, url) {
    originalPush.call(history, data, unused, url);
    queueMicrotask(emit);
  };
  history.replaceState = function replaceState(data, unused, url) {
    originalReplace.call(history, data, unused, url);
    queueMicrotask(emit);
  };
  window.addEventListener("popstate", emit);
  window.addEventListener("hashchange", emit);
  const navigation = (window as Window & { navigation?: EventTarget })
    .navigation;
  navigation?.addEventListener("navigatesuccess", emit);
  const fallback = window.setInterval(() => {
    if (document.visibilityState === "visible") emit();
  }, 1500);

  return () => {
    disposed = true;
    window.clearInterval(fallback);
    window.removeEventListener("popstate", emit);
    window.removeEventListener("hashchange", emit);
    navigation?.removeEventListener("navigatesuccess", emit);
    history.pushState = originalPush;
    history.replaceState = originalReplace;
  };
}
