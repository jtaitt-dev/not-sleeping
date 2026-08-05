import {
  Activity,
  BadgeDollarSign,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Database,
  DraftingCompass,
  Ellipsis,
  Eye,
  FlaskConical,
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
import { BUILD_FLAVOR, IS_LABS_BUILD } from "@/build-flavor";
import { getActiveFixture, useAppStore } from "@/stores/app-store";
import { useLeagueStore } from "@/stores/league-store";
import { requestRuntime } from "@/services/messaging/runtime-client";
import type { LeagueWorkspaceState } from "@/types/league";

import "./app-shell.css";

/**
 * Six labelled pills is the ceiling at 400px; a seventh needs 533px. At 320px
 * the row drops to five and Players moves under More.
 */
const primaryNavigation = [
  { to: "/today", label: "Today", icon: Zap, narrow: true },
  { to: "/draft", label: "Draft", icon: DraftingCompass, narrow: true },
  { to: "/team", label: "Team", icon: WalletCards, narrow: true },
  { to: "/players", label: "Players", icon: Users, narrow: false },
  { to: "/trade", label: "Trade", icon: GitCompareArrows, narrow: true },
  { to: "/more", label: "More", icon: Ellipsis, narrow: true },
] as const;

type MoreItem = {
  to: string;
  label: string;
  detail: string;
  icon: typeof Zap;
};

/**
 * Grouped rather than flat. The previous single list put 21 destinations in
 * 966px of ungrouped, unsearchable scroll inside a 400px panel.
 */
const moreSections: Array<{ title: string; items: MoreItem[] }> = [
  {
    title: "This week",
    items: [
      {
        to: "/start-sit",
        label: "Start & Sit",
        detail: "Legal lineup by slot",
        icon: Users,
      },
      {
        to: "/waivers",
        label: "Waivers",
        detail: "FAAB bids and claims",
        icon: WalletCards,
      },
      {
        to: "/matchup",
        label: "Matchup Center",
        detail: "Win odds this week",
        icon: GitCompareArrows,
      },
      {
        to: "/chopped",
        label: "Chopped Survival",
        detail: "Elimination odds",
        icon: ShieldCheck,
      },
      {
        to: "/research",
        label: "Research",
        detail: "Sourced player context",
        icon: Newspaper,
      },
      {
        to: "/calendar",
        label: "Deadlines",
        detail: "What is due next",
        icon: CalendarClock,
      },
    ],
  },
  {
    title: "Roster",
    items: [
      {
        to: "/team",
        label: "My Team",
        detail: "Current roster",
        icon: WalletCards,
      },
      {
        to: "/players",
        label: "Players",
        detail: "Search the player index",
        icon: Users,
      },
      {
        to: "/dynasty",
        label: "Dynasty",
        detail: "Long-term value",
        icon: Activity,
      },
      {
        to: "/rankings",
        label: "Rankings",
        detail: "Ordered player values",
        icon: ListOrdered,
      },
      {
        to: "/compare",
        label: "Compare",
        detail: "Side-by-side players",
        icon: GitCompareArrows,
      },
      {
        to: "/watchlist",
        label: "Watchlist",
        detail: "Players you follow",
        icon: Star,
      },
      {
        to: "/rookie",
        label: "Rookie Center",
        detail: "Incoming class",
        icon: Star,
      },
      {
        to: "/taxi",
        label: "Taxi Squad",
        detail: "Eligibility and moves",
        icon: WalletCards,
      },
      {
        to: "/idp",
        label: "IDP Center",
        detail: "Defensive players",
        icon: ShieldHalf,
      },
    ],
  },
  {
    title: "Drafts",
    items: [
      {
        to: "/mock-draft",
        label: "Mock Draft Lab",
        detail: "Practice against agents",
        icon: DraftingCompass,
      },
      {
        to: "/auction",
        label: "Auction Room",
        detail: "Budget and nominations",
        icon: BadgeDollarSign,
      },
    ],
  },
  {
    title: "Leagues & data",
    items: [
      {
        to: "/leagues",
        label: "Leagues",
        detail: "Switch or sync leagues",
        icon: Users,
      },
      {
        to: "/data-center",
        label: "Data Center",
        detail: "Caches and imports",
        icon: Database,
      },
      {
        to: "/usage",
        label: "Usage",
        detail: "Requests and budget",
        icon: CircleGauge,
      },
    ],
  },
  {
    title: "App",
    items: [
      {
        to: "/settings",
        label: "Settings",
        detail: "Account, keys, appearance",
        icon: Settings,
      },
      {
        to: "/diagnostics",
        label: "Diagnostics",
        detail: "Redacted export",
        icon: ShieldCheck,
      },
      {
        to: "/about",
        label: "About",
        detail: "Version and licence",
        icon: Eye,
      },
      ...(IS_LABS_BUILD
        ? [
            {
              to: "/labs",
              label: "Labs",
              detail: "Research-only tools",
              icon: FlaskConical,
            },
          ]
        : []),
    ],
  },
];

const moreItems = moreSections.flatMap((section) => section.items);
const primaryPaths = new Set<string>(
  primaryNavigation.map((entry) => entry.to),
);

/** True for any destination reached through More rather than a primary pill. */
function isMoreLevelPath(pathname: string): boolean {
  return !primaryPaths.has(pathname) && pathname !== "/";
}

function moreItemFor(pathname: string): MoreItem | undefined {
  return moreItems.find((item) => item.to === pathname);
}

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
  const onMoreLevelScreen = isMoreLevelPath(location.pathname);
  const currentMoreItem = moreItemFor(location.pathname);

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
        {primaryNavigation.map(({ to, label, icon: Icon, narrow }) => (
          <NavLink
            key={to}
            to={to}
            data-narrow={narrow}
            // More stays lit while you are inside anything it leads to, so the
            // nav never shows an empty selection on a sub-screen.
            className={({ isActive }) =>
              isActive || (to === "/more" && onMoreLevelScreen) ? "active" : ""
            }
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {onMoreLevelScreen ? (
        <div className="subscreen-header">
          <IconButton label="Back to More" onClick={() => navigate("/more")}>
            <ChevronLeft />
          </IconButton>
          <div>
            <strong>{currentMoreItem?.label ?? "Back"}</strong>
            <span>{currentMoreItem?.detail ?? "Return to More"}</span>
          </div>
        </div>
      ) : null}

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
          {keyStatus.available ? "AI provider ready" : "AI optional"} ·{" "}
          {BUILD_FLAVOR === "labs" ? "Labs" : "Core"}
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
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const sections = moreSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        normalized.length === 0
          ? true
          : `${item.label} ${item.detail}`.toLowerCase().includes(normalized),
      ),
    }))
    .filter((section) => section.items.length > 0);
  const matchCount = sections.reduce(
    (total, section) => total + section.items.length,
    0,
  );

  return (
    <section className="more-workspace workspace-page">
      <header className="workspace-heading">
        <div>
          <h1>More</h1>
          <p>Everything not on the main tabs, grouped by what you are doing.</p>
        </div>
        <StatusBadge tone="success">All systems operational</StatusBadge>
      </header>

      <label className="more-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search destinations</span>
        <input
          type="search"
          value={query}
          placeholder="Search tools"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {sections.map((section) => (
        <nav
          className="more-menu"
          aria-label={section.title}
          key={section.title}
        >
          <h2>{section.title}</h2>
          {section.items.map(({ to, label, detail, icon: Icon }) => (
            <NavLink key={`${section.title}-${to}`} to={to}>
              <Icon aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </NavLink>
          ))}
        </nav>
      ))}

      {matchCount === 0 ? (
        <p className="more-empty">Nothing matches “{query}”.</p>
      ) : null}
    </section>
  );
}
