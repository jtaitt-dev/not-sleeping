import { Check, ChevronDown, Search, Star, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { IconButton } from "@/components/ui/button";
import { useLeagueStore } from "@/stores/league-store";
import { getActiveFixture, useAppStore } from "@/stores/app-store";

import "./league-switcher.css";

export function LeagueSwitcher() {
  const demoEnabled = useAppStore((state) => state.demoEnabled);
  const fixtureId = useAppStore((state) => state.fixtureId);
  const catalog = useLeagueStore((state) => state.catalog);
  const activeContext = useLeagueStore((state) => state.activeContext);
  const status = useLeagueStore((state) => state.status);
  const open = useLeagueStore((state) => state.switcherOpen);
  const query = useLeagueStore((state) => state.query);
  const setOpen = useLeagueStore((state) => state.setSwitcherOpen);
  const setQuery = useLeagueStore((state) => state.setQuery);
  const selectLeague = useLeagueStore((state) => state.selectLeague);
  const favoriteLeague = useLeagueStore((state) => state.favoriteLeague);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeLeague = catalog.find(
    (league) => league.leagueId === activeContext?.leagueId,
  );
  const demoFixture = getActiveFixture(fixtureId);
  const displayName =
    activeLeague?.name ??
    activeContext?.leagueName ??
    (demoEnabled ? `Demo · ${demoFixture.label}` : "Choose a league");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return catalog.filter((league) =>
      normalized.length === 0
        ? true
        : `${league.name} ${league.season} ${league.leagueId}`
            .toLowerCase()
            .includes(normalized),
    );
  }, [catalog, query]);
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const league of filtered) {
      const group = groups.get(league.season) ?? [];
      group.push(league);
      groups.set(league.season, group);
    }
    return [...groups.entries()].toSorted(([left], [right]) =>
      right.localeCompare(left),
    );
  }, [filtered]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setOpen(!useLeagueStore.getState().switcherOpen);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div className="league-switcher">
      <button
        className="league-switcher-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="league-avatar" aria-hidden="true">
          {initials(displayName)}
        </span>
        <span className="league-switcher-copy">
          <strong>{displayName}</strong>
          <small>
            {activeContext
              ? `${activeContext.season} · ${activeContext.leagueType.replaceAll("_", " ")}${activeContext.rosterPositions.includes("SUPER_FLEX") ? " · Superflex" : ""}`
              : demoEnabled
                ? "Local fixture · no Sleeper writes"
                : status === "loading"
                  ? "Loading Sleeper leagues"
                  : "Alt+L"}
          </small>
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="league-switcher-popover"
          role="dialog"
          aria-label="Switch league"
        >
          <header>
            <div>
              <strong>Switch league</strong>
              <small>Alt+L</small>
            </div>
            <IconButton
              label="Close league switcher"
              onClick={() => setOpen(false)}
            >
              <X />
            </IconButton>
          </header>
          <label className="league-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search leagues</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search league, season, or ID"
            />
          </label>
          <div className="league-switcher-list">
            {grouped.map(([season, leagues]) => (
              <section key={season}>
                <h2>{season}</h2>
                {leagues.map((league) => {
                  const selected = league.leagueId === activeContext?.leagueId;
                  return (
                    <div
                      className="league-option"
                      data-selected={selected}
                      key={league.leagueId}
                    >
                      <button
                        type="button"
                        onClick={() => void selectLeague(league.leagueId)}
                      >
                        <span>
                          <strong>{league.name}</strong>
                          <small>
                            {league.leagueType} ·{" "}
                            {league.lineupType.replace("_", " ")} · ID{" "}
                            {league.leagueId.slice(-5)}
                          </small>
                        </span>
                        {selected ? <Check aria-label="Selected" /> : null}
                      </button>
                      <IconButton
                        label={`${league.favorite ? "Unfavorite" : "Favorite"} ${league.name}`}
                        onClick={() =>
                          void favoriteLeague(league.leagueId, !league.favorite)
                        }
                      >
                        <Star data-filled={league.favorite} />
                      </IconButton>
                    </div>
                  );
                })}
              </section>
            ))}
            {filtered.length === 0 ? (
              <p className="league-switcher-empty">
                No leagues match this search.
              </p>
            ) : null}
          </div>
          <footer>
            <span>
              {status === "switching"
                ? "Switching while cached view remains visible…"
                : `${catalog.length} leagues available`}
            </span>
            <button
              type="button"
              onClick={() => void useLeagueStore.getState().sync()}
            >
              Sync
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
