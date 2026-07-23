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
  const fixture = getActiveFixture(fixtureId);
  const currentPick = fixture.context.currentPick + draftStep;
  const picksUntil = Math.max(
    0,
    (fixture.context.picksUntilUser ?? 0) - draftStep,
  );

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
            SS
          </div>
          <div className="league-copy">
            <strong>{fixture.context.leagueName}</strong>
            <span>{fixture.context.mode.replaceAll("_", " ")} · Superflex</span>
          </div>
          <ChevronDown aria-hidden="true" />
        </div>
        <div className="pick-context" aria-live="polite">
          <span className="live-label">
            <i />
            {fixture.context.connected ? "Live" : "Cached"}
          </span>
          <strong className="tabular">
            Pick {Math.ceil(currentPick / 12)}.
            {String(((currentPick - 1) % 12) + 1).padStart(2, "0")}
          </strong>
          <span>
            {picksUntil === 0 ? "Your turn" : `${picksUntil} picks until you`}
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
            {demoEnabled ? "Demo data · " : ""}Updated{" "}
            {Math.max(1, 8 - draftStep)}s ago
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
          <i className={fixture.context.connected ? "online" : "offline"} />
          {fixture.context.connected ? "Connection live" : "Using cached data"}
        </span>
        <span>
          <Sparkles aria-hidden="true" />
          Analysis local-first
        </span>
        <span className="tabular">Usage 2 / 20</span>
      </footer>
    </div>
  );
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
