import {
  ArrowDownUp,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileJson,
  GitFork,
  Info,
  KeyRound,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldHalf,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { PositionBadge, StatusBadge, TierBadge } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import {
  EmptyState,
  InlineError,
  ResearchProgress,
} from "@/components/ui/states";
import { DEMO_PLAYERS } from "@/services/demo/fixtures";
import {
  DEFAULT_SOURCE_PREFERENCES,
  type SourcePreferences,
} from "@/providers/evidence/evidence-adapters";
import {
  ALERT_TYPES,
  getAlertSettings,
  hasNotificationsPermission,
  requestNotificationsPermission,
  saveAlertSettings,
  type AlertType,
  type AlertSettings,
} from "@/services/alerts/alert-service";
import {
  getSourcePreferences,
  saveSourcePreferences,
} from "@/services/evidence/source-preferences";
import {
  getFreshnessOverrides,
  saveFreshnessOverrides,
  type FreshnessOverrides,
} from "@/services/freshness/freshness-settings";
import { DEFAULT_FRESHNESS_POLICIES } from "@/services/freshness/freshness-policy";
import {
  type ImportValidation,
  readImportFile,
} from "@/services/imports/import-service";
import {
  requestRuntime,
  safeRuntimeError,
  type SafeRuntimeError,
} from "@/services/messaging/runtime-client";
import { type TradeAsset, evaluateTrade } from "@/services/ranking/trade";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
} from "@/services/storage/settings";
import { getRecommendations, useAppStore } from "@/stores/app-store";
import { useLeagueStore } from "@/stores/league-store";
import type { PlayerResearchOutput } from "@/schemas/openai";
import type { AppSettings, KeyStatus, Player, Strategy } from "@/types/domain";
import type { FreshnessDomain } from "@/types/league";

import "./all-workspaces.css";

const demoAssets: TradeAsset[] = DEMO_PLAYERS.slice(0, 10).map(
  (player, index) => ({
    id: player.id,
    label: player.fullName,
    kind: "player",
    dynastyValue: 92 - index * 4.1,
    contenderValue: 88 - index * 3.2,
    rebuilderValue: 95 - index * 4.4,
    age: player.age,
    risk: index % 4,
    rosterSpots: 1,
  }),
);

export function PlayersWorkspace() {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [results, setResults] = useState<Player[]>(DEMO_PLAYERS);
  const [selected, setSelected] = useState<Player | null>(
    DEMO_PLAYERS[0] ?? null,
  );
  const [researching, setResearching] = useState(false);
  const [research, setResearch] = useState<PlayerResearchOutput | null>(null);
  const [researchError, setResearchError] = useState<SafeRuntimeError | null>(
    null,
  );
  const liveState = useAppStore((state) => state.liveState);
  const watchlist = useAppStore((state) => state.watchlist);
  const toggleWatch = useAppStore((state) => state.toggleWatch);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!hasRuntimeApi()) {
        const normalized = query.trim().toLowerCase();
        setResults(
          DEMO_PLAYERS.filter(
            (player) =>
              (position === "ALL" || player.position === position) &&
              player.fullName.toLowerCase().includes(normalized),
          ),
        );
        return;
      }
      void requestRuntime<Player[]>({
        type: "SEARCH_PLAYERS",
        payload: {
          query,
          positions: position === "ALL" ? [] : [position],
          limit: 50,
        },
      })
        .then((players) => {
          if (!active) return;
          setResults(players);
          setSelected((current) => current ?? players[0] ?? null);
        })
        .catch(() => {
          if (active) setResults([]);
        });
    }, 140);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [position, query]);

  async function runResearch() {
    if (!selected) return;
    setResearching(true);
    setResearch(null);
    setResearchError(null);
    try {
      const storedSettings = await getSettings();
      const response = await requestRuntime<{ data: PlayerResearchOutput }>({
        type: "RESEARCH_PLAYER",
        payload: {
          playerId: selected.id,
          playerName: selected.fullName,
          depth: storedSettings.researchDepth,
          format: liveState
            ? `${liveState.format.teams}-team ${liveState.context.mode.replaceAll("_", " ")} ${liveState.format.scoring}`
            : "General fantasy football",
        },
      });
      setResearch(response.data);
    } catch (error) {
      setResearchError(safeRuntimeError(error));
    } finally {
      setResearching(false);
    }
  }

  return (
    <Workspace
      title="Players"
      subtitle="Search the local player index and inspect current context."
    >
      <div className="search-toolbar surface">
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Search players</span>
          <input
            type="search"
            placeholder="Search name, team, or ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Position</span>
          <select
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          >
            {["ALL", "QB", "RB", "WR", "TE"].map((value) => (
              <option key={value} value={value}>
                {value === "ALL" ? "All positions" : value}
              </option>
            ))}
          </select>
        </label>
        <StatusBadge tone="success">{results.length} indexed</StatusBadge>
      </div>

      <div className="player-explorer">
        <div className="surface result-list" aria-label="Player search results">
          {results.length ? (
            results.map((player) => (
              <button
                type="button"
                key={player.id}
                className={selected?.id === player.id ? "selected" : ""}
                onClick={() => {
                  setSelected(player);
                  setResearch(null);
                  setResearchError(null);
                }}
              >
                <PositionBadge position={player.position} />
                <span>
                  <strong>{player.fullName}</strong>
                  <small>
                    {player.team ?? "FA"} · Sleeper {player.sleeperId}
                  </small>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))
          ) : (
            <EmptyState
              title="No player found"
              detail="Try a broader name or position filter."
            />
          )}
        </div>

        {selected ? (
          <article className="surface player-profile">
            <header>
              <div className="profile-monogram">
                {selected.firstName[0]}
                {selected.lastName[0]}
              </div>
              <div>
                <span className="section-label">Verified local identity</span>
                <h2>{selected.fullName}</h2>
                <p>
                  {selected.team ?? "Free agent"} · age{" "}
                  {selected.age?.toFixed(1) ?? "unknown"}
                </p>
              </div>
              <IconButton
                label={
                  watchlist.includes(selected.id)
                    ? "Remove from watchlist"
                    : "Add to watchlist"
                }
                active={watchlist.includes(selected.id)}
                onClick={() => toggleWatch(selected.id)}
              >
                <Star />
              </IconButton>
            </header>
            <dl className="profile-facts">
              <div>
                <dt>Position</dt>
                <dd>
                  <PositionBadge position={selected.position} />
                </dd>
              </div>
              <div>
                <dt>NFL draft</dt>
                <dd>
                  {selected.nflDraftYear} · pick {selected.nflDraftPick}
                </dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{selected.yearsExperience} seasons</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge tone="success">{selected.status}</StatusBadge>
                </dd>
              </div>
            </dl>
            {researching ? (
              <ResearchProgress step="Checking current role, injuries, and recent reports…" />
            ) : researchError ? (
              <InlineError
                title={`${researchError.message} (${researchError.diagnosticCode})`}
                detail={`${researchError.safeDetail} ${researchError.suggestedAction}`}
                onRetry={() => void runResearch()}
              />
            ) : research ? (
              <div className="research-card" aria-live="polite">
                <span className="section-label">
                  Current research · {Math.round(research.confidence * 100)}%
                  confidence
                </span>
                <h3>Role and outlook</h3>
                <p>{research.currentRole}</p>
                <p>
                  <strong>Injury status:</strong> {research.injuryStatus}
                </p>
                <p>{research.redraftOutlook}</p>
                {research.citations.length ? (
                  <ul>
                    {research.citations.slice(0, 5).map((citation) => (
                      <li key={citation.id}>
                        <a href={citation.url} target="_blank" rel="noreferrer">
                          {citation.title} · {citation.publisher}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No validated source citations were returned.</p>
                )}
                <Button
                  size="small"
                  icon={<RefreshCw />}
                  onClick={() => void runResearch()}
                >
                  Refresh research
                </Button>
              </div>
            ) : (
              <div className="research-card">
                <span className="section-label">Research preview</span>
                <p>
                  Fresh web research is opt-in and runs only after a key is
                  configured. Deterministic player value remains available
                  without OpenAI.
                </p>
                <Button
                  size="small"
                  variant="primary"
                  icon={<Sparkles />}
                  onClick={() => void runResearch()}
                >
                  Research player
                </Button>
              </div>
            )}
          </article>
        ) : null}
      </div>
    </Workspace>
  );
}

const STARTER_SLOTS = [
  "QB",
  "RB",
  "RB",
  "WR",
  "WR",
  "WR",
  "TE",
  "FLEX",
  "SF",
] as const;

/** Which positions may legally fill each starting slot. */
const SLOT_ELIGIBILITY: Record<string, readonly string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  FLEX: ["RB", "WR", "TE"],
  SF: ["QB", "RB", "WR", "TE"],
};

/**
 * Places each player in the first slot its position is eligible for.
 *
 * This previously zipped a score-ordered list against the slot array by index,
 * so the highest-scoring player was labelled QB whatever they actually played
 * and a quarterback could appear in a running-back slot.
 */
export function assignStarterSlots<T extends { player: { position: string } }>(
  entries: T[],
): Array<{ slot: string; entry: T | null }> {
  const filled: Array<T | null> = STARTER_SLOTS.map(() => null);
  for (const entry of entries) {
    const index = STARTER_SLOTS.findIndex(
      (slot, slotIndex) =>
        filled[slotIndex] === null &&
        (SLOT_ELIGIBILITY[slot] ?? []).includes(entry.player.position),
    );
    if (index >= 0) filled[index] = entry;
  }
  return STARTER_SLOTS.map((slot, index) => ({
    slot,
    entry: filled[index] ?? null,
  }));
}

export function TeamWorkspace() {
  const fixtureId = useAppStore((state) => state.fixtureId);
  const draftStep = useAppStore((state) => state.draftStep);
  const strategy = useAppStore((state) => state.strategy);
  const risk = useAppStore((state) => state.riskTolerance);
  const hidden = useAppStore((state) => state.hiddenPlayers);
  const roster = getRecommendations(
    fixtureId,
    draftStep,
    strategy,
    risk,
    hidden,
  ).slice(2, 11);
  const positionCounts = roster.reduce<Record<string, number>>(
    (counts, entry) => {
      counts[entry.player.position] = (counts[entry.player.position] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return (
    <Workspace
      title="Team"
      subtitle="Roster construction, needs, and format-aware strengths."
    >
      <div className="insight-strip">
        <Insight
          label="Roster score"
          value="82"
          detail="Strong core"
          tone="accent"
        />
        <Insight label="Age profile" value="25.1" detail="Balanced window" />
        <Insight
          label="Need"
          value="RB2"
          detail="Before round 7"
          tone="warning"
        />
        <Insight
          label="Flex depth"
          value="+12%"
          detail="Above league"
          tone="success"
        />
      </div>
      <div className="team-layout">
        <section className="surface roster-card">
          <header>
            <h2>Projected starters</h2>
            <StatusBadge tone="info">12-team SF</StatusBadge>
          </header>
          <div className="roster-list">
            {assignStarterSlots(roster).map(({ slot, entry }, index) => (
              <div key={`${slot}-${index}`}>
                <span className="slot-label">{slot}</span>
                {entry ? (
                  <>
                    <PositionBadge position={entry.player.position} />
                    <span>
                      <strong>{entry.player.fullName}</strong>
                      <small>{entry.player.team}</small>
                    </span>
                    <b>{entry.contextualScore}</b>
                  </>
                ) : (
                  <>
                    <PositionBadge position={slot as Player["position"]} />
                    <span>
                      <strong>Open</strong>
                      <small>No eligible player rostered</small>
                    </span>
                    <b>—</b>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
        <aside className="surface needs-card">
          <header>
            <span className="section-label">Build map</span>
            <h2>Position balance</h2>
          </header>
          {["QB", "RB", "WR", "TE"].map((positionName) => {
            const count = positionCounts[positionName] ?? 0;
            const percentage = Math.min(100, count * 24 + 16);
            return (
              <div className="need-meter" key={positionName}>
                <span>
                  <b>{positionName}</b>
                  <small>{count} rostered</small>
                </span>
                <span>
                  <i style={{ width: `${percentage}%` }} />
                </span>
                <strong>{percentage}%</strong>
              </div>
            );
          })}
          <div className="callout">
            <Info aria-hidden="true" />
            <p>
              Wide receiver depth lets you prioritize scarce quarterback and
              tight end value.
            </p>
          </div>
        </aside>
      </div>
    </Workspace>
  );
}

export function DynastyWorkspace() {
  const strategy = useAppStore((state) => state.strategy);
  const setStrategy = useAppStore((state) => state.setStrategy);
  return (
    <Workspace
      title="Dynasty"
      subtitle="Age curves, value horizon, and competitive-window planning."
    >
      <div className="strategy-switch surface">
        <div>
          <span className="section-label">Team direction</span>
          <h2>Competitive window</h2>
        </div>
        <div role="group" aria-label="Dynasty strategy">
          {(
            [
              "contender",
              "balanced",
              "productive_struggle",
              "rebuild",
            ] as Strategy[]
          ).map((value) => (
            <button
              key={value}
              type="button"
              className={strategy === value ? "active" : ""}
              onClick={() => setStrategy(value)}
            >
              {value.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </div>
      <section className="surface horizon-card">
        <header>
          <div>
            <span className="section-label">Three-year outlook</span>
            <h2>Value horizon by position</h2>
          </div>
          <StatusBadge tone="success">Window: 2026–27</StatusBadge>
        </header>
        <div
          className="horizon-chart"
          aria-label="Illustrative three-year value horizon"
        >
          {[
            { name: "QB", values: [88, 91, 90], tone: "qb" },
            { name: "RB", values: [82, 71, 60], tone: "rb" },
            { name: "WR", values: [90, 92, 89], tone: "wr" },
            { name: "TE", values: [76, 82, 85], tone: "te" },
          ].map((series) => (
            <div key={series.name}>
              <b>{series.name}</b>
              {series.values.map((value, index) => (
                <span
                  key={index}
                  data-tone={series.tone}
                  style={{ height: `${value}%` }}
                >
                  <i>{value}</i>
                </span>
              ))}
            </div>
          ))}
          <footer>
            <span>2026</span>
            <span>2027</span>
            <span>2028</span>
          </footer>
        </div>
      </section>
      <div className="timeline">
        <article className="surface">
          <span>Now</span>
          <h3>Compete without forcing RB</h3>
          <p>
            Your receiver core and quarterback stability support selective
            win-now moves.
          </p>
        </article>
        <article className="surface">
          <span>Next offseason</span>
          <h3>Refresh the backfield</h3>
          <p>Two aging curves cross the replacement band after this season.</p>
        </article>
        <article className="surface">
          <span>2028</span>
          <h3>Preserve optionality</h3>
          <p>Retain at least one first-round pick to absorb value shocks.</p>
        </article>
      </div>
    </Workspace>
  );
}

export function TradeWorkspace() {
  const strategy = useAppStore((state) => state.strategy);
  const [sideA, setSideA] = useState<TradeAsset[]>(demoAssets.slice(0, 1));
  const [sideB, setSideB] = useState<TradeAsset[]>(demoAssets.slice(3, 5));
  const evaluation = evaluateTrade(sideA, sideB, strategy);

  function addAsset(side: "a" | "b") {
    const used = new Set([...sideA, ...sideB].map((asset) => asset.id));
    const next = demoAssets.find((asset) => !used.has(asset.id));
    if (!next) return;
    if (side === "a") setSideA((assets) => [...assets, next]);
    else setSideB((assets) => [...assets, next]);
  }

  return (
    <Workspace
      title="Trade"
      subtitle="Deterministic side-by-side value with strategy-aware conditions."
    >
      <div className="trade-builder">
        <TradeSide
          label="You send"
          assets={sideA}
          onAdd={() => addAsset("a")}
          onRemove={(id) =>
            setSideA((assets) => assets.filter((asset) => asset.id !== id))
          }
        />
        <div className="trade-swap">
          <ArrowDownUp aria-hidden="true" />
          <span>for</span>
        </div>
        <TradeSide
          label="You receive"
          assets={sideB}
          onAdd={() => addAsset("b")}
          onRemove={(id) =>
            setSideB((assets) => assets.filter((asset) => asset.id !== id))
          }
        />
      </div>
      <section className="surface trade-result">
        <header>
          <div>
            <span className="section-label">Local evaluation</span>
            <h2>{evaluation.recommendation}</h2>
          </div>
          <StatusBadge
            tone={evaluation.fairness === "fair" ? "success" : "warning"}
          >
            {evaluation.fairness.replace("_", " ")}
          </StatusBadge>
        </header>
        <div className="trade-balance">
          <span>
            <b>{evaluation.sideATotal}</b>
            <small>Send</small>
          </span>
          <div>
            <i
              style={{
                left: `${Math.max(4, Math.min(96, 50 + evaluation.percentageDifference))}%`,
              }}
            />
          </div>
          <span>
            <b>{evaluation.sideBTotal}</b>
            <small>Receive</small>
          </span>
        </div>
        <p>
          Difference {evaluation.difference} ·{" "}
          {Math.abs(evaluation.percentageDifference)}% ·{" "}
          {Math.round(evaluation.confidence * 100)}% confidence
        </p>
        <ul>
          {evaluation.conditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
      </section>
    </Workspace>
  );
}

export function WatchlistWorkspace() {
  const watchlist = useAppStore((state) => state.watchlist);
  const toggleWatch = useAppStore((state) => state.toggleWatch);
  const players = DEMO_PLAYERS.filter((player) =>
    watchlist.includes(player.id),
  );
  return (
    <Workspace
      title="Watchlist"
      subtitle="Targets and notes remain local to this browser profile."
    >
      {players.length ? (
        <div className="watch-grid">
          {players.map((player, index) => (
            <article className="surface watch-card" key={player.id}>
              <header>
                <PositionBadge position={player.position} />
                <IconButton
                  label={`Remove ${player.fullName}`}
                  onClick={() => toggleWatch(player.id)}
                >
                  <X />
                </IconButton>
              </header>
              <h2>{player.fullName}</h2>
              <p>
                {player.team} · age {player.age?.toFixed(1)}
              </p>
              <label>
                Target note
                <textarea
                  defaultValue={
                    index === 0
                      ? "Prioritize if the WR tier thins before pick 4.08."
                      : "Track role and camp usage before moving up."
                  }
                />
              </label>
              <footer>
                <TierBadge tier={index + 2} />
                <span>Target round {index + 4}</span>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No watched players"
          detail="Star a player from Draft or Players to track them here."
          action="Browse players"
          onAction={() => location.assign("#/players")}
        />
      )}
    </Workspace>
  );
}

export function CompareWorkspace() {
  const [ids, setIds] = useState(
    [DEMO_PLAYERS[0]?.id, DEMO_PLAYERS[1]?.id].filter(Boolean) as string[],
  );
  const players = ids
    .map((id) => DEMO_PLAYERS.find((player) => player.id === id))
    .filter(Boolean) as Player[];
  return (
    <Workspace
      title="Compare"
      subtitle="Put player profiles and decision factors on the same scale."
    >
      <div className="compare-picker surface">
        <select
          onChange={(event) =>
            setIds((current) =>
              [...new Set([...current, event.target.value])].slice(-3),
            )
          }
          defaultValue=""
        >
          <option value="" disabled>
            Add a player
          </option>
          {DEMO_PLAYERS.slice(0, 12).map((player) => (
            <option key={player.id} value={player.id}>
              {player.fullName}
            </option>
          ))}
        </select>
        <span>{players.length}/3 comparison slots</span>
      </div>
      <div
        className="compare-grid"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, players.length)}, minmax(0, 1fr))`,
        }}
      >
        {players.map((player, index) => (
          <article className="surface compare-player" key={player.id}>
            <button
              type="button"
              aria-label={`Remove ${player.fullName}`}
              onClick={() =>
                setIds((current) => current.filter((id) => id !== player.id))
              }
            >
              <X />
            </button>
            <PositionBadge position={player.position} />
            <h2>{player.fullName}</h2>
            <p>
              {player.team} · age {player.age?.toFixed(1)}
            </p>
            <dl>
              <div>
                <dt>Local value</dt>
                <dd>{92 - index * 5}</dd>
              </div>
              <div>
                <dt>Age curve</dt>
                <dd className={index === 0 ? "positive" : ""}>
                  {index === 0 ? "+4.2" : "+1.1"}
                </dd>
              </div>
              <div>
                <dt>Scarcity</dt>
                <dd>{index === 0 ? "High" : "Moderate"}</dd>
              </div>
              <div>
                <dt>Risk</dt>
                <dd>{index === 0 ? "Low" : "Moderate"}</dd>
              </div>
            </dl>
            <p className="comparison-note">
              {index === 0
                ? "Higher weekly ceiling and roster fit."
                : "Position premium improves long-horizon value."}
            </p>
          </article>
        ))}
      </div>
    </Workspace>
  );
}

export function RankingsWorkspace() {
  const fixtureId = useAppStore((state) => state.fixtureId);
  const draftStep = useAppStore((state) => state.draftStep);
  const strategy = useAppStore((state) => state.strategy);
  const risk = useAppStore((state) => state.riskTolerance);
  const hidden = useAppStore((state) => state.hiddenPlayers);
  const rankings = getRecommendations(
    fixtureId,
    draftStep,
    strategy,
    risk,
    hidden,
  );
  const [filter, setFilter] = useState("ALL");
  const filtered = rankings.filter(
    (entry) => filter === "ALL" || entry.player.position === filter,
  );
  return (
    <Workspace
      title="Rankings"
      subtitle="Transparent local baseline, adjusted for this league and strategy."
    >
      <div className="search-toolbar surface">
        <ListFilter aria-hidden="true" />
        {["ALL", "QB", "RB", "WR", "TE"].map((position) => (
          <button
            type="button"
            key={position}
            className={filter === position ? "active-filter" : ""}
            onClick={() => setFilter(position)}
          >
            {position}
          </button>
        ))}
        <span className="toolbar-spacer" />
        <Button size="small" icon={<Download />}>
          Export CSV
        </Button>
      </div>
      <div className="surface ranking-table" aria-label="Local rankings">
        <div>
          <span>#</span>
          <span>Player</span>
          <span>Tier</span>
          <span>Score</span>
          <span>VOR</span>
        </div>
        {filtered.map((entry) => (
          <div key={entry.player.id}>
            <span>{entry.rank}</span>
            <span>
              <PositionBadge position={entry.player.position} />
              <b>{entry.player.fullName}</b>
              <small>{entry.player.team}</small>
            </span>
            <span>
              <TierBadge tier={entry.tier} />
            </span>
            <strong>{entry.contextualScore}</strong>
            <span
              className={
                entry.valueOverReplacement >= 0 ? "positive" : "negative"
              }
            >
              {entry.valueOverReplacement > 0 ? "+" : ""}
              {entry.valueOverReplacement}
            </span>
          </div>
        ))}
      </div>
    </Workspace>
  );
}

export function DataCenterWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setError("");
    try {
      setValidation(await readImportFile(file));
    } catch (caught) {
      setValidation(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "The import could not be read.",
      );
    }
  }

  return (
    <Workspace
      title="Data Center"
      subtitle="Bring your own rankings and projections into the local valuation engine."
    >
      <div className="data-grid">
        <section className="surface import-zone">
          <Upload aria-hidden="true" />
          <h2>Import CSV or JSON</h2>
          <p>Files stay in this browser. Maximum 5 MB and 20,000 rows.</p>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            variant="primary"
            size="small"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
          <small>
            Recognizes rank, ADP, tier, projections, redraft, dynasty, and
            rookie values.
          </small>
        </section>
        <section className="surface source-list">
          <header>
            <div>
              <span className="section-label">Active sources</span>
              <h2>Local data stack</h2>
            </div>
            <StatusBadge tone="success">Healthy</StatusBadge>
          </header>
          <SourceRow
            icon={<Database />}
            name="Sleeper player index"
            detail="Native identities · refreshed daily"
            status="Ready"
          />
          <SourceRow
            icon={<FileJson />}
            name="Not Sleeping fallback values"
            detail="Bundled local baseline · v0.1"
            status="Ready"
          />
          <SourceRow
            icon={<Sparkles />}
            name="Current web research"
            detail="BYOK · only when requested"
            status="Optional"
          />
        </section>
      </div>
      {error ? <InlineError title="Import rejected" detail={error} /> : null}
      {validation ? (
        <section className="surface import-result">
          <header>
            <div>
              <span className="section-label">Validation complete</span>
              <h2>{fileName}</h2>
            </div>
            <StatusBadge
              tone={validation.errors.length ? "warning" : "success"}
            >
              {validation.validRows.length} valid rows
            </StatusBadge>
          </header>
          <p>
            Detected {validation.detectedColumns.length} columns and mapped{" "}
            {Object.keys(validation.mapping).length} recognized fields.
          </p>
          {validation.errors.length ? (
            <p>{validation.errors.length} rows need attention before import.</p>
          ) : (
            <Button size="small" variant="primary">
              Save local source
            </Button>
          )}
        </section>
      ) : null}
    </Workspace>
  );
}

export function UsageWorkspace() {
  const bars = [12, 34, 18, 55, 31, 62, 24, 42, 74, 48, 36, 58];
  return (
    <Workspace
      title="Usage"
      subtitle="Local request counts and token telemetry; no price estimates."
    >
      <div className="insight-strip">
        <Insight
          label="Requests"
          value="18"
          detail="This month"
          tone="accent"
        />
        <Insight
          label="Cache hits"
          value="61%"
          detail="11 avoided calls"
          tone="success"
        />
        <Insight label="Input tokens" value="42.8k" detail="Reported by API" />
        <Insight
          label="Failures"
          value="1"
          detail="Rate limited"
          tone="warning"
        />
      </div>
      <section className="surface usage-chart">
        <header>
          <div>
            <span className="section-label">Last 12 days</span>
            <h2>Requests by day</h2>
          </div>
          <StatusBadge tone="info">Local telemetry</StatusBadge>
        </header>
        <div>
          {bars.map((height, index) => (
            <span
              key={index}
              style={{ height: `${height}%` }}
              title={`${height}% relative volume`}
            />
          ))}
        </div>
        <footer>
          <span>Jul 12</span>
          <span>Jul 23</span>
        </footer>
      </section>
      <div className="surface usage-table">
        {[
          ["Player research", "gpt-5.6-sol", "8", "30.2k"],
          ["Draft adjustment", "gpt-5.6-terra", "6", "9.4k"],
          ["Compare summary", "gpt-5.6-terra", "4", "3.2k"],
        ].map(([feature, model, requests, tokens]) => (
          <div key={feature}>
            <span>
              <strong>{feature}</strong>
              <small>{model}</small>
            </span>
            <span>{requests} requests</span>
            <b>{tokens} tokens</b>
          </div>
        ))}
      </div>
      <div className="callout">
        <Info />
        <p>
          OpenAI pricing can change. Not Sleeping records API-reported tokens
          and links to official pricing instead of guessing cost.
        </p>
      </div>
    </Workspace>
  );
}

export function SettingsWorkspace() {
  const activeLeague = useLeagueStore((state) => state.activeContext);
  const setLeagueOverrides = useLeagueStore((state) => state.setOverrides);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    available: false,
    mode: null,
    masked: null,
  });
  const [saveError, setSaveError] = useState("");
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    enabled: false,
    quietHours: { start: "22:00", end: "07:00" },
    leagues: {},
  });
  const [alertsPermitted, setAlertsPermitted] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const [sourcePreferences, setSourcePreferences] = useState<SourcePreferences>(
    DEFAULT_SOURCE_PREFERENCES,
  );
  const [freshnessOverrides, setFreshnessOverrides] =
    useState<FreshnessOverrides>({});
  const [tiebreakerDraft, setTiebreakerDraft] = useState<{
    leagueId: string;
    value: string;
  } | null>(null);
  const eliminationTiebreaker =
    activeLeague && tiebreakerDraft?.leagueId === activeLeague.leagueId
      ? tiebreakerDraft.value
      : (activeLeague?.eliminationTiebreaker ?? "");

  useEffect(() => {
    let active = true;
    void Promise.all([
      getSettings(),
      getAlertSettings(),
      hasNotificationsPermission(),
      getSourcePreferences(),
      getFreshnessOverrides(),
      requestRuntime<{ keyStatus: KeyStatus }>({
        type: "GET_STATUS",
        payload: {},
      }),
    ])
      .then(([stored, alerts, permitted, sources, freshness, status]) => {
        if (!active) return;
        setSettings(stored);
        setAlertSettings(alerts);
        setAlertsPermitted(permitted);
        setSourcePreferences(sources);
        setFreshnessOverrides(freshness);
        setKeyStatus(status.keyStatus);
      })
      .catch((error: unknown) => {
        if (active) setSaveError(safeRuntimeError(error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaveError("");
    void saveSettings(updated).catch((error: unknown) => {
      setSaveError(
        error instanceof Error ? error.message : "The setting was not saved.",
      );
    });
  }

  async function enableAlerts() {
    const permitted = await requestNotificationsPermission();
    setAlertsPermitted(permitted);
    if (!permitted) return;
    const updated = { ...alertSettings, enabled: true };
    setAlertSettings(await saveAlertSettings(updated));
  }

  function updateSourceList(
    key: Exclude<keyof SourcePreferences, "optionalXEnabled">,
    value: string,
  ) {
    const updated = {
      ...sourcePreferences,
      [key]: value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    };
    setSourcePreferences(updated);
    void saveSourcePreferences(updated).then(setSourcePreferences);
  }

  function updateLeagueAlerts(input: {
    enabled?: boolean;
    includePrivateDetails?: boolean;
    toggleType?: AlertType;
  }) {
    if (!activeLeague) return;
    const current = alertSettings.leagues[activeLeague.leagueId] ?? {
      enabled: true,
      types: [...ALERT_TYPES],
      includePrivateDetails: false,
    };
    const types = input.toggleType
      ? current.types.includes(input.toggleType)
        ? current.types.filter((type) => type !== input.toggleType)
        : [...current.types, input.toggleType]
      : current.types;
    const updated: AlertSettings = {
      ...alertSettings,
      leagues: {
        ...alertSettings.leagues,
        [activeLeague.leagueId]: {
          ...current,
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.includePrivateDetails !== undefined
            ? { includePrivateDetails: input.includePrivateDetails }
            : {}),
          types,
        },
      },
    };
    setAlertSettings(updated);
    void saveAlertSettings(updated).then(setAlertSettings);
  }

  async function connectSleeperAccount() {
    const username = settings.sleeperUsername.trim();
    if (username.length === 0) return;
    setAccountBusy(true);
    setAccountNotice("");
    setSaveError("");
    try {
      const user = await requestRuntime<{
        user_id: string;
        username?: string | null;
      }>({ type: "RESOLVE_USER", payload: { username } });
      setSettings(await getSettings());
      // sync() also selects a league, so the switcher is usable immediately
      // rather than merely populated.
      await useLeagueStore.getState().sync();
      const count = useLeagueStore.getState().catalog.length;
      setAccountNotice(
        `Connected as ${user.username ?? username} · ${count} ${
          count === 1 ? "league" : "leagues"
        } loaded.`,
      );
    } catch (error) {
      setSaveError(safeRuntimeError(error).message);
    } finally {
      setAccountBusy(false);
    }
  }

  function updateFreshness(domain: FreshnessDomain, seconds: number) {
    const updated = {
      ...freshnessOverrides,
      [domain]: Math.max(1, Math.round(seconds)) * 1_000,
    };
    setFreshnessOverrides(updated);
    void saveFreshnessOverrides(updated).then(setFreshnessOverrides);
  }

  return (
    <Workspace
      title="Settings"
      subtitle="Quick controls for this side panel. Security-sensitive key setup opens separately."
    >
      <div className="settings-sections">
        <section className="surface settings-card">
          <header>
            <UserRound />
            <div>
              <h2>Sleeper account</h2>
              <p>Public username only. No password or Sleeper token.</p>
            </div>
            <StatusBadge tone={settings.sleeperUserId ? "success" : "warning"}>
              {settings.sleeperUserId ? "Connected" : "Not connected"}
            </StatusBadge>
          </header>
          <p>
            {settings.sleeperUserId
              ? "Every league across all seasons is loaded. Use the switcher at the top of the panel to move between them."
              : "Workspaces show demo data until an account is connected. Connecting loads every league across all seasons."}
          </p>
          <label className="capability-override-field">
            <span>Sleeper username</span>
            <input
              type="text"
              value={settings.sleeperUsername}
              maxLength={64}
              placeholder="Your Sleeper username"
              onChange={(event) =>
                updateSetting("sleeperUsername", event.target.value)
              }
            />
          </label>
          <Button
            variant="primary"
            size="small"
            disabled={
              accountBusy || settings.sleeperUsername.trim().length === 0
            }
            onClick={() => void connectSleeperAccount()}
          >
            {accountBusy
              ? "Connecting…"
              : settings.sleeperUserId
                ? "Reconnect and resync leagues"
                : "Connect and load my leagues"}
          </Button>
          {accountNotice ? <p>{accountNotice}</p> : null}
        </section>
        <section className="surface settings-card">
          <header>
            <KeyRound />
            <div>
              <h2>OpenAI key</h2>
              <p>Keys never pass through extension messages.</p>
            </div>
            <StatusBadge tone={keyStatus.available ? "success" : "warning"}>
              {keyStatus.available
                ? `${keyStatus.masked ?? "Configured"} · ${keyStatus.mode}`
                : "Not configured"}
            </StatusBadge>
          </header>
          <p>
            The default is session-only storage. Remembering a key requires
            explicit opt-in and stores it in trusted extension storage.
          </p>
          <Button
            variant="primary"
            size="small"
            onClick={() => void chrome.runtime.openOptionsPage()}
          >
            Open secure setup
          </Button>
        </section>
        <section className="surface settings-card freshness-settings-card">
          <header>
            <RefreshCw />
            <div>
              <h2>Data freshness</h2>
              <p>Per-domain stale thresholds in seconds.</p>
            </div>
          </header>
          <div className="freshness-setting-grid">
            {(
              Object.entries(DEFAULT_FRESHNESS_POLICIES) as Array<
                [
                  FreshnessDomain,
                  (typeof DEFAULT_FRESHNESS_POLICIES)[FreshnessDomain],
                ]
              >
            ).flatMap(([domain, policy]) =>
              policy.ttlMs === null
                ? []
                : [
                    <label key={domain}>
                      <span>{policy.description}</span>
                      <input
                        type="number"
                        min="1"
                        max="604800"
                        value={Math.round(
                          (freshnessOverrides[domain] ?? policy.ttlMs) / 1_000,
                        )}
                        onChange={(event) =>
                          updateFreshness(domain, Number(event.target.value))
                        }
                      />
                    </label>,
                  ],
            )}
          </div>
          <Button
            size="small"
            variant="ghost"
            onClick={() => {
              setFreshnessOverrides({});
              void saveFreshnessOverrides({});
            }}
          >
            Restore defaults
          </Button>
        </section>
        <section className="surface settings-card">
          <header>
            <ShieldHalf />
            <div>
              <h2>League capability overrides</h2>
              <p>Applied only to the selected league and preserved locally.</p>
            </div>
            <StatusBadge tone={activeLeague ? "info" : "neutral"}>
              {activeLeague?.leagueName ?? "No league selected"}
            </StatusBadge>
          </header>
          {activeLeague ? (
            <>
              <Toggle
                label="Weekly elimination / Chopped"
                detail="Enable only when confirmed by commissioner rules; league names are never used as evidence"
                checked={activeLeague.weeklyElimination}
                onChange={(weeklyElimination) => {
                  void setLeagueOverrides({ weeklyElimination }).catch(
                    (error: unknown) =>
                      setSaveError(safeRuntimeError(error).message),
                  );
                }}
              />
              <label className="capability-override-field">
                <span>Elimination tiebreaker</span>
                <input
                  value={eliminationTiebreaker}
                  placeholder="Example: bench points, then season points"
                  onChange={(event) => {
                    setTiebreakerDraft({
                      leagueId: activeLeague.leagueId,
                      value: event.target.value,
                    });
                  }}
                  onBlur={() => {
                    const trimmed = eliminationTiebreaker.trim();
                    void setLeagueOverrides({
                      eliminationTiebreaker: trimmed ? trimmed : null,
                    }).catch((error: unknown) =>
                      setSaveError(safeRuntimeError(error).message),
                    );
                  }}
                />
              </label>
              <p>
                Unknown settings and non-zero scoring categories remain visible
                in Diagnostics; no inferred override changes Sleeper.
              </p>
            </>
          ) : (
            <p>Select a league before configuring a manual capability.</p>
          )}
        </section>
        <section className="surface settings-card">
          <header>
            <SlidersHorizontal />
            <div>
              <h2>Analysis behavior</h2>
              <p>Local ranking is always available.</p>
            </div>
          </header>
          <Toggle
            label="Automatic analysis"
            detail="Run when draft context changes"
            checked={settings.automaticAnalysis}
            onChange={(value) => updateSetting("automaticAnalysis", value)}
          />
          <Toggle
            label="Public data enrichment"
            detail="Opt in to verified nflverse roster metadata"
            checked={settings.enablePublicData}
            onChange={(value) => updateSetting("enablePublicData", value)}
          />
          {saveError ? (
            <InlineError title="Setting not saved" detail={saveError} />
          ) : null}
        </section>
        <section className="surface settings-card">
          <header>
            <BookOpen />
            <div>
              <h2>Evidence source policy</h2>
              <p>
                One entry per line or comma; public social remains best-effort.
              </p>
            </div>
          </header>
          <div className="source-preference-grid">
            <SourceListField
              label="Trusted domains"
              value={sourcePreferences.trustedDomains}
              onChange={(value) => updateSourceList("trustedDomains", value)}
            />
            <SourceListField
              label="Blocked domains"
              value={sourcePreferences.blockedDomains}
              onChange={(value) => updateSourceList("blockedDomains", value)}
            />
            <SourceListField
              label="Trusted reporters"
              value={sourcePreferences.trustedReporters}
              onChange={(value) => updateSourceList("trustedReporters", value)}
            />
            <SourceListField
              label="Trusted social handles"
              value={sourcePreferences.trustedSocialHandles}
              onChange={(value) =>
                updateSourceList("trustedSocialHandles", value)
              }
            />
            <SourceListField
              label="Muted reporters"
              value={sourcePreferences.mutedReporters}
              onChange={(value) => updateSourceList("mutedReporters", value)}
            />
            <SourceListField
              label="Muted topics"
              value={sourcePreferences.mutedTopics}
              onChange={(value) => updateSourceList("mutedTopics", value)}
            />
          </div>
          <p>
            Official X API access is optional, disabled by default, and never
            required for core operation.
          </p>
        </section>
        <section className="surface settings-card">
          <header>
            <Bell />
            <div>
              <h2>Local alerts</h2>
              <p>Optional, deduplicated, and quiet-hours aware.</p>
            </div>
            <StatusBadge
              tone={
                alertsPermitted && alertSettings.enabled ? "success" : "neutral"
              }
            >
              {alertsPermitted && alertSettings.enabled ? "Enabled" : "Off"}
            </StatusBadge>
          </header>
          <p>
            Chrome must be running. Alerts are not guaranteed background
            infrastructure, and private league details stay hidden by default.
          </p>
          {alertsPermitted ? (
            <>
              <Toggle
                label="Allow local alerts"
                detail="Master switch for all locally generated alerts"
                checked={alertSettings.enabled}
                onChange={(enabled) => {
                  const updated = { ...alertSettings, enabled };
                  setAlertSettings(updated);
                  void saveAlertSettings(updated);
                }}
              />
              {activeLeague ? (
                <div className="league-alert-settings">
                  <h3>{activeLeague.leagueName}</h3>
                  <Toggle
                    label="Alerts for this league"
                    detail="Keeps settings isolated to the selected league"
                    checked={
                      alertSettings.leagues[activeLeague.leagueId]?.enabled ??
                      true
                    }
                    onChange={(enabled) => updateLeagueAlerts({ enabled })}
                  />
                  <Toggle
                    label="Show private details"
                    detail="Off by default for lock-screen privacy"
                    checked={
                      alertSettings.leagues[activeLeague.leagueId]
                        ?.includePrivateDetails ?? false
                    }
                    onChange={(includePrivateDetails) =>
                      updateLeagueAlerts({ includePrivateDetails })
                    }
                  />
                  <div className="alert-type-grid">
                    {ALERT_TYPES.map((type) => {
                      const selected =
                        alertSettings.leagues[
                          activeLeague.leagueId
                        ]?.types.includes(type) ?? true;
                      return (
                        <Button
                          key={type}
                          size="small"
                          variant={selected ? "primary" : "ghost"}
                          aria-pressed={selected}
                          onClick={() =>
                            updateLeagueAlerts({ toggleType: type })
                          }
                        >
                          {alertTypeLabel(type)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p>Select a league to configure league-specific alert types.</p>
              )}
            </>
          ) : (
            <Button size="small" onClick={() => void enableAlerts()}>
              Enable notification permission
            </Button>
          )}
        </section>
        <section className="surface settings-card">
          <header>
            <ShieldCheck />
            <div>
              <h2>Privacy posture</h2>
              <p>No analytics SDK, ad network, or remote code.</p>
            </div>
            <StatusBadge tone="success">Local-first</StatusBadge>
          </header>
          <ul>
            <li>Read-only Sleeper API access</li>
            <li>
              OpenAI requests use <code>store: false</code>
            </li>
            <li>Diagnostics redact IDs, URLs, and credential-like values</li>
          </ul>
        </section>
      </div>
    </Workspace>
  );
}

function SourceListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <textarea
        rows={2}
        value={value.join("\n")}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function DiagnosticsWorkspace() {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [copied, setCopied] = useState(false);
  const [checks, setChecks] = useState<DiagnosticCheck[]>([
    { name: "Service worker", result: "Not checked", tone: "warning" },
    { name: "Sleeper context", result: "Not checked", tone: "warning" },
    { name: "Player cache", result: "Not checked", tone: "warning" },
    { name: "OpenAI", result: "Not checked", tone: "warning" },
    { name: "Browser storage", result: "Not checked", tone: "warning" },
  ]);

  async function runChecks() {
    setStatus("running");
    try {
      const extension = await requestRuntime<DiagnosticStatus>({
        type: "GET_STATUS",
        payload: {},
      });
      let openAI: DiagnosticCheck = {
        name: "OpenAI",
        result: "Key not configured",
        tone: "warning",
      };
      if (extension.keyStatus.available) {
        try {
          const test = await requestRuntime<{ modelCount: number }>({
            type: "TEST_OPENAI",
            payload: {},
          });
          openAI = {
            name: "OpenAI",
            result: `Connected · ${test.modelCount} models`,
            tone: "success",
          };
        } catch (error) {
          const safe = safeRuntimeError(error);
          openAI = {
            name: "OpenAI",
            result: `${safe.message} · ${safe.diagnosticCode}`,
            tone: "warning",
          };
        }
      }
      const route = asUnknownRecord(extension.context);
      setChecks([
        {
          name: "Service worker",
          result: `Responsive · v${extension.extensionVersion}`,
          tone: "success",
        },
        {
          name: "Sleeper context",
          result:
            route["supported"] === true
              ? typeof route["draftId"] === "string"
                ? "Draft detected"
                : "Supported page detected"
              : "Open a Sleeper league or draft",
          tone: route["supported"] === true ? "success" : "warning",
        },
        {
          name: "Player cache",
          result: `${extension.players} indexed`,
          tone: extension.players > 0 ? "success" : "warning",
        },
        openAI,
        {
          name: "Browser storage",
          result: "Trusted extension contexts",
          tone: "success",
        },
      ]);
    } catch (error) {
      const safe = safeRuntimeError(error);
      setChecks([
        {
          name: "Service worker",
          result: `${safe.message} · ${safe.diagnosticCode}`,
          tone: "warning",
        },
      ]);
    } finally {
      setStatus("done");
    }
  }

  async function copyReport() {
    try {
      const report = await requestRuntime<unknown>({
        type: "EXPORT_DIAGNOSTICS",
        payload: {},
      });
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch (error) {
      const safe = safeRuntimeError(error);
      setChecks((current) => [
        ...current,
        {
          name: "Diagnostics export",
          result: `${safe.message} · ${safe.diagnosticCode}`,
          tone: "warning",
        },
      ]);
    }
  }
  return (
    <Workspace
      title="Diagnostics"
      subtitle="Safe health checks and a redacted support bundle."
    >
      <section className="surface diagnostic-card">
        <header>
          <div>
            <span className="section-label">System health</span>
            <h2>
              {status === "running" ? "Running checks…" : "Extension checks"}
            </h2>
          </div>
          <Button
            size="small"
            icon={<RefreshCw />}
            onClick={runChecks}
            disabled={status === "running"}
          >
            Run all
          </Button>
        </header>
        <div className="diagnostic-list">
          {checks.map((check) => (
            <div key={check.name}>
              <CheckCircle2 data-tone={check.tone} />
              <strong>{check.name}</strong>
              <span>{check.result}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="surface redaction-card">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h2>Redacted diagnostics</h2>
          <p>
            User IDs become stable aliases. Credentials, authorization headers,
            full URLs, and usernames are removed.
          </p>
        </div>
        <Button size="small" icon={<Copy />} onClick={() => void copyReport()}>
          {copied ? "Copied" : "Copy report"}
        </Button>
      </section>
    </Workspace>
  );
}

export function AboutWorkspace() {
  return (
    <Workspace
      title="About"
      subtitle="Independent, open-source, and built for informed fantasy decisions."
    >
      <section className="surface about-hero">
        <img src="/icons/icon-128.png" alt="" width="88" height="88" />
        <div>
          <span className="section-label">
            Version {chrome.runtime.getManifest().version}
          </span>
          <h1>Not Sleeping</h1>
          <p>
            An independent fantasy football intelligence companion for Sleeper.
            Not affiliated with or endorsed by Sleeper or OpenAI.
          </p>
          <div>
            <a
              className="button-link"
              href="https://github.com/jtaitt-dev/not-sleeping"
              target="_blank"
              rel="noreferrer"
            >
              <GitFork />
              View source
              <ExternalLink />
            </a>
            <Link to="/diagnostics">Diagnostics</Link>
          </div>
        </div>
      </section>
      <div className="about-grid">
        <article className="surface">
          <BookOpen />
          <h2>Transparent by design</h2>
          <p>
            Deterministic value components remain inspectable, and research
            adjustments are bounded.
          </p>
        </article>
        <article className="surface">
          <ShieldCheck />
          <h2>Security first</h2>
          <p>
            Minimal permissions, read-only Sleeper access, trusted key storage,
            and redacted diagnostics.
          </p>
        </article>
        <article className="surface">
          <Users />
          <h2>Built in public</h2>
          <p>
            MIT licensed with reproducible builds, tests, release checksums, and
            contribution guidance.
          </p>
        </article>
      </div>
      <section className="surface acknowledgements">
        <h2>Data acknowledgements</h2>
        <p>
          Sleeper provides public fantasy-football data. Optional nflverse
          sources may enrich public roster metadata. Player news research uses
          OpenAI only when users bring their own key.
        </p>
      </section>
    </Workspace>
  );
}

function Workspace({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="workspace-page generic-workspace">
      <header className="workspace-heading">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Insight({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <article className="surface insight" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TradeSide({
  label,
  assets,
  onAdd,
  onRemove,
}: {
  label: string;
  assets: TradeAsset[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="surface trade-side">
      <header>
        <div>
          <span className="section-label">{label}</span>
          <h2>Side {label === "You send" ? "A" : "B"}</h2>
        </div>
        <Button size="small" icon={<Plus />} onClick={onAdd}>
          Asset
        </Button>
      </header>
      {assets.map((asset) => (
        <div className="trade-asset" key={asset.id}>
          <PositionBadge
            position={
              DEMO_PLAYERS.find((player) => player.id === asset.id)?.position ??
              "FLEX"
            }
          />
          <span>
            <strong>{asset.label}</strong>
            <small>Dynasty value {asset.dynastyValue}</small>
          </span>
          <IconButton
            label={`Remove ${asset.label}`}
            onClick={() => onRemove(asset.id)}
          >
            <Trash2 />
          </IconButton>
        </div>
      ))}
      {assets.length === 0 ? (
        <p className="mini-empty">Add a player or pick.</p>
      ) : null}
    </section>
  );
}

function SourceRow({
  icon,
  name,
  detail,
  status,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  status: string;
}) {
  return (
    <div className="source-row">
      <span>{icon}</span>
      <div>
        <strong>{name}</strong>
        <small>{detail}</small>
      </div>
      <StatusBadge tone={status === "Ready" ? "success" : "neutral"}>
        {status}
      </StatusBadge>
    </div>
  );
}

function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

type DiagnosticCheck = {
  name: string;
  result: string;
  tone: "success" | "warning";
};

type DiagnosticStatus = {
  extensionVersion: string;
  context: unknown;
  keyStatus: KeyStatus;
  players: number;
};

function alertTypeLabel(type: AlertType): string {
  return type
    .split("_")
    .map((part) => (part[0] ?? "").toUpperCase() + part.slice(1))
    .join(" ");
}

function hasRuntimeApi(): boolean {
  return (
    typeof chrome !== "undefined" &&
    Boolean(chrome.runtime.id) &&
    typeof chrome.runtime.sendMessage === "function"
  );
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
