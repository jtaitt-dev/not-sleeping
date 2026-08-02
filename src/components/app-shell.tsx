import {
  Activity,
  BadgeDollarSign,
  CalendarClock,
  ChevronDown,
  CircleGauge,
  Database,
  DraftingCompass,
  Ellipsis,
  Eye,
  GitCompareArrows,
  ListOrdered,
  Newspaper,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShieldHalf,
  Sparkles,
  Star,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { IconButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badges";
import { LeagueSwitcher } from "@/components/league-switcher";
import { getActiveFixture, useAppStore } from "@/stores/app-store";
import { useLeagueStore } from "@/stores/league-store";
import { requestRuntime } from "@/services/messaging/runtime-client";
import type { LeagueWorkspaceState } from "@/types/league";

import "./app-shell.css";

const primaryNavigation = [
  { to: "/today", label: "Today", icon: Zap },
  { to: "/draft", label: "Draft", icon: DraftingCompass },
  { to: "/start-sit", label: "Start/Sit", icon: Users },
  { to: "/waivers", label: "Waivers", icon: WalletCards },
  { to: "/trade", label: "Trade", icon: GitCompareArrows },
  { to: "/dynasty", label: "Dynasty", icon: Activity },
  { to: "/more", label: "More", icon: Ellipsis },
] as const;

const moreNavigation = [
  { to: "/leagues", label: "Leagues", icon: Users },
  { to: "/mock-draft", label: "Mock Draft Lab", icon: DraftingCompass },
  { to: "/matchup", label: "Matchup Center", icon: GitCompareArrows },
  { to: "/chopped", label: "Chopped Survival", icon: ShieldCheck },
  { to: "/players", label: "Players", icon: Users },
  { to: "/rookie", label: "Rookie Center", icon: Star },
  { to: "/taxi", label: "Taxi Squad", icon: WalletCards },
  { to: "/idp", label: "IDP Center", icon: ShieldHalf },
  { to: "/auction", label: "Auction Room", icon: BadgeDollarSign },
  { to: "/team", label: "My Team", icon: WalletCards },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/rankings", label: "Rankings", icon: ListOrdered },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/research", label: "Research", icon: Newspaper },
  { to: "/data-center", label: "Data Center", icon: Database },
  { to: "/usage", label: "Usage", icon: CircleGauge },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/diagnostics", label: "Diagnostics", icon: ShieldCheck },
  { to: "/calendar", label: "Deadlines", icon: CalendarClock },
  { to: "/about", label: "About", icon: Eye },
] as const;

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const leagueContext = useLeagueStore((state) => state.activeContext);
  const leagueSnapshot = useLeagueStore((state) => state.snapshot);
  const leagueStatus = useLeagueStore((state) => state.status);
  const fixtureId = useAppStore((state) => state.fixtureId);
  const draftStep = useAppStore((state) => state.draftStep);
  const demoEnabled = useAppStore((state) => state.demoEnabled);
  const liveState = useAppStore((state) => state.liveState);
  const keyStatus = useAppStore((state) => state.keyStatus);
  const [now, setNow] = useState(0);
  const fixture = getActiveFixture(fixtureId);
  const liveUnavailable = !demoEnabled && !liveState;
  const context =
    !demoEnabled && liveState ? liveState.context : fixture.context;
  const format = !demoEnabled && liveState ? liveState.format : fixture.format;
  const currentPick = liveUnavailable
    ? 1
    : context.currentPick + (demoEnabled ? draftStep : 0);
  const picksUntil =
    context.picksUntilUser === undefined
      ? undefined
      : Math.max(0, context.picksUntilUser - (demoEnabled ? draftStep : 0));
  const updatedSeconds = Math.max(
    0,
    Math.round(
      (now -
        (leagueContext && location.pathname !== "/draft"
          ? (leagueSnapshot?.fetchedAt ?? now)
          : context.lastUpdatedAt)) /
        1000,
    ),
  );
  const showLeagueContext = Boolean(
    leagueContext && location.pathname !== "/draft",
  );
  const restoredLeague = useRef<string | null>(null);

  useEffect(() => {
    if (!leagueContext || restoredLeague.current === leagueContext.leagueId)
      return;
    restoredLeague.current = leagueContext.leagueId;
    let active = true;
    void requestRuntime<LeagueWorkspaceState | null>({
      type: "GET_LEAGUE_WORKSPACE",
      payload: { leagueId: leagueContext.leagueId, workspace: "__last__" },
    })
      .then((stored) => {
        if (!active || !stored) return;
        const path = stored.filters["path"];
        if (
          typeof path === "string" &&
          path.startsWith("/") &&
          path !== location.pathname
        )
          void navigate(path);
        window.requestAnimationFrame(() =>
          window.scrollTo(0, stored.scrollTop),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [leagueContext, location.pathname, navigate]);

  useEffect(() => {
    if (!leagueContext) return;
    const save = () => {
      const base = {
        leagueId: leagueContext.leagueId,
        week: leagueContext.week,
        scrollTop: window.scrollY,
        strategy: leagueContext.strategy,
      };
      void requestRuntime({
        type: "SAVE_LEAGUE_WORKSPACE",
        payload: { ...base, workspace: location.pathname, filters: {} },
      }).catch(() => undefined);
      void requestRuntime({
        type: "SAVE_LEAGUE_WORKSPACE",
        payload: {
          ...base,
          workspace: "__last__",
          filters: { path: location.pathname },
        },
      }).catch(() => undefined);
    };
    const timer = window.setInterval(save, 2_000);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [leagueContext, location.pathname]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-shell">
      <header className="league-header">
        <div className="brand-lockup">
          <img src="/icons/icon-32.png" alt="" width="28" height="28" />
          <div className="brand-wordmark">
            <strong>Not Sleeping</strong>
            <span>Independent Sleeper companion</span>
          </div>
        </div>
        <LeagueSwitcher />
        <div className="pick-context" aria-live="polite">
          <span className="live-label">
            <i />
            {showLeagueContext
              ? leagueStatus === "ready"
                ? "League live"
                : leagueStatus
              : context.status === "complete"
                ? "Complete"
                : liveUnavailable
                  ? "Retry needed"
                  : context.connected
                    ? "Live"
                    : "Cached"}
          </span>
          <strong className="tabular">
            {showLeagueContext && leagueContext ? (
              <>
                Week {leagueContext.week} ·{" "}
                {leagueContext.leagueType.replaceAll("_", " ")}
              </>
            ) : (
              <>
                Pick {Math.ceil(currentPick / format.teams)}.
                {String(((currentPick - 1) % format.teams) + 1).padStart(
                  2,
                  "0",
                )}
              </>
            )}
          </strong>
          <span>
            {showLeagueContext && leagueContext
              ? [
                  leagueContext.lineupType === "best_ball"
                    ? "Best Ball"
                    : "Classic",
                  leagueContext.weeklyElimination ? "Chopped" : null,
                  leagueContext.rosterPositions.includes("SUPER_FLEX")
                    ? "Superflex"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : liveUnavailable
                ? "Live data unavailable"
                : picksUntil === undefined
                  ? draftStatusLabel(context.status)
                  : picksUntil === 0
                    ? "Your turn"
                    : `${picksUntil} picks until you`}
          </span>
        </div>
        <div className="header-actions">
          <IconButton
            label="Search players"
            onClick={() => navigate("/players")}
          >
            <Search />
          </IconButton>
          <IconButton
            label="Open settings"
            onClick={() => navigate("/settings")}
          >
            <Settings />
          </IconButton>
        </div>
        <div className="freshness-row">
          <RefreshCw aria-hidden="true" />
          <span>
            {!showLeagueContext && demoEnabled ? "Demo data · " : ""}
            {updatedSeconds < 2
              ? "Updated now"
              : `Updated ${updatedSeconds}s ago`}
          </span>
        </div>
      </header>

      <nav className="primary-navigation" aria-label="Primary">
        {primaryNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="active-workspace">
        <Outlet />
      </main>

      <footer className="bottom-status">
        <span>
          <i
            className={
              showLeagueContext
                ? leagueStatus === "ready"
                  ? "online"
                  : "offline"
                : !liveUnavailable && context.connected
                  ? "online"
                  : "offline"
            }
          />
          {showLeagueContext
            ? leagueStatus === "ready"
              ? "League context isolated"
              : "League refresh pending"
            : liveUnavailable
              ? "Live refresh failed"
              : context.connected
                ? "Connection live"
                : "Using cached data"}
        </span>
        <span>
          <Sparkles aria-hidden="true" />
          Analysis local-first
        </span>
        <span className="tabular">
          {keyStatus.available ? "OpenAI ready" : "OpenAI optional"}
        </span>
      </footer>
    </div>
  );
}

function draftStatusLabel(status: string): string {
  switch (status) {
    case "pre_draft":
      return "Waiting to start";
    case "complete":
      return "Draft complete";
    case "paused":
      return "Draft paused";
    default:
      return "Live draft";
  }
}

export function MoreWorkspace() {
  return (
    <section className="more-workspace workspace-page">
      <header className="workspace-heading">
        <div>
          <h1>More</h1>
          <p>Analysis tools, data controls, and project information.</p>
        </div>
        <StatusBadge tone="success">All systems operational</StatusBadge>
      </header>
      <nav className="more-menu" aria-label="More tools">
        {moreNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <ChevronDown aria-hidden="true" />
          </NavLink>
        ))}
      </nav>
    </section>
  );
}
