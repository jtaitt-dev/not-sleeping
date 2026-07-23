import {
  ArrowDownUp,
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
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import { PositionBadge, StatusBadge, TierBadge } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import {
  EmptyState,
  InlineError,
  ResearchProgress,
} from "@/components/ui/states";
import { DEMO_PLAYERS } from "@/services/demo/fixtures";
import {
  type ImportValidation,
  readImportFile,
} from "@/services/imports/import-service";
import { type TradeAsset, evaluateTrade } from "@/services/ranking/trade";
import { getRecommendations, useAppStore } from "@/stores/app-store";
import type { Player, Strategy } from "@/types/domain";

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
  const [selected, setSelected] = useState<Player | null>(
    DEMO_PLAYERS[0] ?? null,
  );
  const [researching, setResearching] = useState(false);
  const watchlist = useAppStore((state) => state.watchlist);
  const toggleWatch = useAppStore((state) => state.toggleWatch);
  const results = DEMO_PLAYERS.filter(
    (player) =>
      (position === "ALL" || player.position === position) &&
      player.fullName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function research() {
    setResearching(true);
    window.setTimeout(() => setResearching(false), 900);
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
                onClick={() => setSelected(player)}
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
                  onClick={research}
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
            {roster.map((entry, index) => (
              <div key={entry.player.id}>
                <span className="slot-label">
                  {
                    ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "SF"][
                      index
                    ]
                  }
                </span>
                <PositionBadge position={entry.player.position} />
                <span>
                  <strong>{entry.player.fullName}</strong>
                  <small>{entry.player.team}</small>
                </span>
                <b>{entry.contextualScore}</b>
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
  const [automatic, setAutomatic] = useState(false);
  const [publicData, setPublicData] = useState(false);
  return (
    <Workspace
      title="Settings"
      subtitle="Quick controls for this side panel. Security-sensitive key setup opens separately."
    >
      <div className="settings-sections">
        <section className="surface settings-card">
          <header>
            <KeyRound />
            <div>
              <h2>OpenAI key</h2>
              <p>Keys never pass through extension messages.</p>
            </div>
            <StatusBadge tone="warning">Not configured</StatusBadge>
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
            checked={automatic}
            onChange={setAutomatic}
          />
          <Toggle
            label="Public data enrichment"
            detail="Opt in to verified nflverse roster metadata"
            checked={publicData}
            onChange={setPublicData}
          />
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

export function DiagnosticsWorkspace() {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [copied, setCopied] = useState(false);
  const checks = [
    ["Service worker", "Responsive", "success"],
    ["Sleeper API", "Reachable", "success"],
    ["Player cache", "24 entries", "success"],
    ["OpenAI", "Key not configured", "warning"],
    ["Browser storage", "Trusted contexts", "success"],
  ] as const;
  function runChecks() {
    setStatus("running");
    window.setTimeout(() => setStatus("done"), 800);
  }
  function copyReport() {
    void navigator.clipboard.writeText(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          extension: "0.1.0",
          checks: checks.map(([name, result]) => ({ name, result })),
        },
        null,
        2,
      ),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1000);
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
          {checks.map(([name, result, tone]) => (
            <div key={name}>
              <CheckCircle2 data-tone={tone} />
              <strong>{name}</strong>
              <span>{result}</span>
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
        <Button size="small" icon={<Copy />} onClick={copyReport}>
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
          <span className="section-label">Version 0.1.0</span>
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
