import {
  Activity,
  ChevronDown,
  CircleGauge,
  Database,
  DraftingCompass,
  Ellipsis,
  Eye,
  GitCompareArrows,
  ListOrdered,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { IconButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badges";
import { getActiveFixture, useAppStore } from "@/stores/app-store";

import "./app-shell.css";

const primaryNavigation = [
  { to: "/draft", label: "Draft", icon: DraftingCompass },
  { to: "/players", label: "Players", icon: Users },
  { to: "/team", label: "Team", icon: WalletCards },
  { to: "/dynasty", label: "Dynasty", icon: Activity },
  { to: "/trade", label: "Trade", icon: GitCompareArrows },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/more", label: "More", icon: Ellipsis },
] as const;

const moreNavigation = [
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/rankings", label: "Rankings", icon: ListOrdered },
  { to: "/data-center", label: "Data Center", icon: Database },
  { to: "/usage", label: "Usage", icon: CircleGauge },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/diagnostics", label: "Diagnostics", icon: ShieldCheck },
  { to: "/about", label: "About", icon: Eye },
] as const;

export function AppShell() {
  const navigate = useNavigate();
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
  const leagueName = liveUnavailable
    ? "Sleeper draft unavailable"
    : (context.leagueName ?? context.draftName ?? "Sleeper draft");
  const initials = leagueName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const updatedSeconds = Math.max(
    0,
    Math.round((now - context.lastUpdatedAt) / 1000),
  );

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
        <div className="league-context">
          <div className="league-avatar" aria-hidden="true">
            {initials || "NS"}
          </div>
          <div className="league-copy">
            <strong>{leagueName}</strong>
            <span>
              {context.mode.replaceAll("_", " ")}
              {format.superflex ? " · Superflex" : ""}
            </span>
          </div>
          <ChevronDown aria-hidden="true" />
        </div>
        <div className="pick-context" aria-live="polite">
          <span className="live-label">
            <i />
            {context.status === "complete"
              ? "Complete"
              : liveUnavailable
                ? "Retry needed"
                : context.connected
                  ? "Live"
                  : "Cached"}
          </span>
          <strong className="tabular">
            Pick {Math.ceil(currentPick / format.teams)}.
            {String(((currentPick - 1) % format.teams) + 1).padStart(2, "0")}
          </strong>
          <span>
            {liveUnavailable
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
            {demoEnabled ? "Demo data · " : ""}
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
              !liveUnavailable && context.connected ? "online" : "offline"
            }
          />
          {liveUnavailable
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
