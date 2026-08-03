import { Clock3, FlaskConical, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useLeagueStore } from "@/stores/league-store";
import type { Player } from "@/types/domain";

import {
  buildResponsibleParlayCandidates,
  type LegAvailability,
  type ManualOddsLeg,
  type OddsSourceKind,
  type ParlayCandidate,
  type PropMarket,
} from "./parlay-analysis";

const PREFERENCES_KEY = "labsParlayPreferences";
const DAY_MS = 24 * 60 * 60 * 1_000;

const marketOptions: Array<{ value: PropMarket; label: string }> = [
  { value: "passing_yards", label: "Passing yards" },
  { value: "passing_touchdowns", label: "Passing touchdowns" },
  { value: "rushing_yards", label: "Rushing yards" },
  { value: "rushing_attempts", label: "Rushing attempts" },
  { value: "receiving_yards", label: "Receiving yards" },
  { value: "receptions", label: "Receptions" },
  { value: "anytime_touchdown", label: "Anytime touchdown" },
  { value: "kicking_points", label: "Kicking points" },
  { value: "idp_tackles", label: "IDP tackles" },
];

type LabsPreferences = {
  permanentlyDisabled: boolean;
  cooldownUntil: number | null;
};

const defaultPreferences: LabsPreferences = {
  permanentlyDisabled: false,
  cooldownUntil: null,
};

export default function ParlayLabWorkspace() {
  const catalog = useLeagueStore((state) => state.catalog);
  const activeContext = useLeagueStore((state) => state.activeContext);
  const snapshot = useLeagueStore((state) => state.snapshot);
  const selectLeague = useLeagueStore((state) => state.selectLeague);
  const watchedPlayerIds = useAppStore((state) => state.watchlist);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [jurisdictionConfirmed, setJurisdictionConfirmed] = useState(false);
  const [correlationPenalty, setCorrelationPenalty] = useState(0.08);
  const [weekOverride, setWeekOverride] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [includeBench, setIncludeBench] = useState(false);
  const [includeOpponent, setIncludeOpponent] = useState(false);
  const [includeWatched, setIncludeWatched] = useState(false);
  const [legs, setLegs] = useState<ManualOddsLeg[]>([createBlankLeg()]);

  useEffect(() => {
    let active = true;
    void loadPreferences().then((stored) => {
      if (!active) return;
      setPreferences(stored);
      setPreferencesReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = globalThis.setInterval(
      () => setCurrentTime(Date.now()),
      60_000,
    );
    return () => globalThis.clearInterval(timer);
  }, []);

  const playerPool = useMemo(
    () =>
      resolvePlayerPool({
        rosterId: activeContext?.rosterId ?? null,
        players: snapshot?.players ?? [],
        rosters: snapshot?.rosters ?? [],
        matchups: snapshot?.matchups ?? [],
        includeBench,
        includeOpponent,
        includeWatched,
        watchedPlayerIds,
      }),
    [
      activeContext?.rosterId,
      includeBench,
      includeOpponent,
      includeWatched,
      snapshot?.matchups,
      snapshot?.players,
      snapshot?.rosters,
      watchedPlayerIds,
    ],
  );
  const allowedPlayerIds = useMemo(
    () => playerPool.map((player) => player.id),
    [playerPool],
  );
  const result = useMemo(
    () =>
      buildResponsibleParlayCandidates(legs, {
        correlationPenalty,
        ...(allowedPlayerIds.length > 0 ? { allowedPlayerIds } : {}),
      }),
    [allowedPlayerIds, correlationPenalty, legs],
  );
  const acknowledged = adultConfirmed && jurisdictionConfirmed;
  const week = weekOverride ?? activeContext?.week ?? 1;
  const cooldownActive =
    preferences.cooldownUntil !== null &&
    preferences.cooldownUntil > currentTime;

  async function updatePreferences(patch: Partial<LabsPreferences>) {
    const updated = { ...preferences, ...patch };
    setPreferences(updated);
    await savePreferences(updated);
  }

  if (!preferencesReady) {
    return (
      <section className="workspace-page labs-workspace">
        <p role="status">Loading Labs safeguards…</p>
      </section>
    );
  }

  if (preferences.permanentlyDisabled) {
    return (
      <LabsGate title="Parlay Lab is disabled">
        <p>
          This browser will keep the research surface disabled until you
          explicitly re-enable it. No scenario history was retained.
        </p>
        <Button
          onClick={() =>
            void updatePreferences({
              permanentlyDisabled: false,
              cooldownUntil: null,
            })
          }
        >
          Re-enable Labs on this browser
        </Button>
      </LabsGate>
    );
  }

  if (cooldownActive) {
    return (
      <LabsGate title="Research cooldown active">
        <p>
          Parlay Lab is unavailable until{" "}
          {new Date(preferences.cooldownUntil ?? 0).toLocaleString()}. The
          cooldown cannot be ended early from this screen.
        </p>
        <StatusBadge tone="info">24-hour pause</StatusBadge>
      </LabsGate>
    );
  }

  if (!acknowledged) {
    return (
      <LabsGate title="Responsible-use acknowledgement">
        <p>
          This is uncertain entertainment analysis. It never fetches from
          operators, places an action, chooses a monetary amount, or promises an
          outcome. You supply every market and price.
        </p>
        <div className="labs-responsible-warning" role="note">
          If this activity stops being recreational, take a break and use the
          cooldown or permanent-disable controls below.
        </div>
        <label>
          <input
            type="checkbox"
            checked={adultConfirmed}
            onChange={(event) => setAdultConfirmed(event.target.checked)}
          />
          I affirm that I am 21 years of age or older.
        </label>
        <label>
          <input
            type="checkbox"
            checked={jurisdictionConfirmed}
            onChange={(event) => setJurisdictionConfirmed(event.target.checked)}
          />
          I am responsible for checking and following the law where I am
          located.
        </label>
        <Button
          variant="danger"
          onClick={() => void updatePreferences({ permanentlyDisabled: true })}
        >
          Disable Parlay Lab permanently
        </Button>
      </LabsGate>
    );
  }

  return (
    <section className="workspace-page labs-workspace">
      <header className="workspace-heading">
        <div>
          <h1>Parlay Lab</h1>
          <p>Transparent research from current supplied inputs only.</p>
        </div>
        <StatusBadge tone="info">Labs sideload build</StatusBadge>
      </header>

      <article className="labs-warning">
        <strong>Responsible-use controls</strong>
        <p>
          No sensitive scenario history is stored. Preferences contain only the
          disable and cooldown flags.
        </p>
        <div className="labs-actions">
          <Button
            icon={<Clock3 />}
            onClick={() =>
              void updatePreferences({ cooldownUntil: Date.now() + DAY_MS })
            }
          >
            Start 24-hour cooldown
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              void updatePreferences({ permanentlyDisabled: true })
            }
          >
            Disable permanently
          </Button>
        </div>
      </article>

      <article className="labs-panel labs-context-panel">
        <header>
          <div>
            <ShieldCheck aria-hidden="true" />
            <strong>League, week, and legal player pool</strong>
          </div>
        </header>
        <div className="labs-context-grid">
          <label>
            Sleeper league
            <select
              value={activeContext?.leagueId ?? ""}
              disabled={catalog.length === 0}
              onChange={(event) => void selectLeague(event.target.value)}
            >
              <option value="">No connected league</option>
              {catalog.map((league) => (
                <option key={league.leagueId} value={league.leagueId}>
                  {league.name} · {league.season}
                </option>
              ))}
            </select>
          </label>
          <label>
            Week
            <input
              type="number"
              min="1"
              max="25"
              value={week}
              onChange={(event) => setWeekOverride(Number(event.target.value))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeBench}
              onChange={(event) => setIncludeBench(event.target.checked)}
            />
            Include bench players
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeOpponent}
              onChange={(event) => setIncludeOpponent(event.target.checked)}
            />
            Include opponent starters
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeWatched}
              onChange={(event) => setIncludeWatched(event.target.checked)}
            />
            Include watched players
          </label>
        </div>
        <p className="labs-pool-note">
          {playerPool.length > 0
            ? `${playerPool.length} players are in the selected current pool. Current legal starters are the default.`
            : "Select a Sleeper league to verify starters. Until then, entries remain a manual research watchlist."}
        </p>
      </article>

      <article className="labs-panel">
        <header>
          <div>
            <FlaskConical aria-hidden="true" />
            <strong>Current supplied markets</strong>
          </div>
          <Button
            icon={<Plus />}
            onClick={() => setLegs((current) => [...current, createBlankLeg()])}
          >
            Add supplied market
          </Button>
        </header>
        <datalist id="labs-player-pool">
          {playerPool.map((player) => (
            <option key={player.id} value={player.fullName}>
              {player.position} · {player.team ?? "FA"}
            </option>
          ))}
        </datalist>
        {legs.map((leg) => (
          <LegEditor
            key={leg.id}
            leg={leg}
            players={playerPool}
            onChange={(patch) =>
              setLegs((current) => updateLeg(current, leg.id, patch))
            }
            onRemove={() =>
              setLegs((current) => current.filter((item) => item.id !== leg.id))
            }
          />
        ))}
        <label className="labs-correlation">
          Conservative correlation penalty ·{" "}
          {Math.round(correlationPenalty * 100)}%
          <input
            type="range"
            min="0"
            max="40"
            value={correlationPenalty * 100}
            onChange={(event) =>
              setCorrelationPenalty(Number(event.target.value) / 100)
            }
          />
          <small>
            This user-controlled penalty avoids treating related legs as fully
            independent; no fitted correlation dataset is bundled.
          </small>
        </label>
      </article>

      <LabsResult result={result} />
    </section>
  );
}

function LabsGate({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="workspace-page labs-workspace">
      <header className="workspace-heading">
        <div>
          <h1>Parlay Lab</h1>
          <p>Optional research math for user-supplied scenarios.</p>
        </div>
        <StatusBadge tone="warning">Labs opt-in</StatusBadge>
      </header>
      <article className="labs-gate">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          {children}
        </div>
      </article>
    </section>
  );
}

function LegEditor({
  leg,
  players,
  onChange,
  onRemove,
}: {
  leg: ManualOddsLeg;
  players: Player[];
  onChange: (patch: Partial<ManualOddsLeg>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="labs-leg">
      <label>
        Player or leg label
        <input
          list="labs-player-pool"
          aria-label="Player or leg label"
          value={leg.label}
          onChange={(event) => {
            const player = players.find(
              (candidate) => candidate.fullName === event.target.value,
            );
            onChange({
              label: event.target.value,
              ...(player
                ? {
                    playerId: player.id,
                    availability: playerAvailability(player),
                  }
                : { playerId: undefined, availability: "unknown" }),
            });
          }}
        />
      </label>
      <label>
        Supplied market
        <select
          value={leg.market}
          onChange={(event) =>
            onChange({ market: event.target.value as PropMarket | "" })
          }
        >
          <option value="">Choose supplied market</option>
          {marketOptions.map((market) => (
            <option key={market.value} value={market.value}>
              {market.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Line
        <NullableNumberInput
          value={leg.line}
          onChange={(line) => onChange({ line })}
        />
      </label>
      <label>
        Current American price
        <NullableNumberInput
          value={leg.americanOdds}
          onChange={(americanOdds) => onChange({ americanOdds })}
        />
      </label>
      <label>
        Opposite-side price (optional de-vig)
        <NullableNumberInput
          value={leg.oppositeAmericanOdds}
          onChange={(oppositeAmericanOdds) =>
            onChange({ oppositeAmericanOdds })
          }
        />
      </label>
      <label>
        Your estimated probability (%)
        <NullableNumberInput
          min={1}
          max={99}
          value={
            leg.estimatedProbability === null
              ? null
              : Math.round(leg.estimatedProbability * 1000) / 10
          }
          onChange={(value) =>
            onChange({
              estimatedProbability: value === null ? null : value / 100,
            })
          }
        />
      </label>
      <label>
        Uncertainty (%)
        <input
          type="number"
          min="0"
          max="50"
          value={Math.round(leg.uncertainty * 100)}
          onChange={(event) =>
            onChange({ uncertainty: Number(event.target.value) / 100 })
          }
        />
      </label>
      <label>
        Input source
        <select
          value={leg.sourceType}
          onChange={(event) =>
            onChange({ sourceType: event.target.value as OddsSourceKind })
          }
        >
          <option value="manual">Manual entry</option>
          <option value="user_import">User import</option>
          <option value="licensed_provider">Licensed provider</option>
        </select>
      </label>
      <label>
        Source name
        <input
          value={leg.sourceName}
          placeholder="Required source"
          onChange={(event) => onChange({ sourceName: event.target.value })}
        />
      </label>
      <label>
        Book or consensus identifier
        <input
          value={leg.bookOrConsensus}
          placeholder="Required identifier"
          onChange={(event) =>
            onChange({ bookOrConsensus: event.target.value })
          }
        />
      </label>
      <label>
        Price timestamp
        <input
          type="datetime-local"
          value={leg.recordedAt}
          onChange={(event) => onChange({ recordedAt: event.target.value })}
        />
      </label>
      <label>
        Current availability
        <select
          value={leg.availability}
          onChange={(event) =>
            onChange({ availability: event.target.value as LegAvailability })
          }
        >
          <option value="active">Active</option>
          <option value="questionable">Questionable</option>
          <option value="out">Out</option>
          <option value="inactive">Inactive</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <Button
        variant="danger"
        icon={<Trash2 />}
        aria-label={`Remove ${leg.label || "incomplete leg"}`}
        onClick={onRemove}
      >
        Remove
      </Button>
    </div>
  );
}

function NullableNumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      {...(min === undefined ? {} : { min })}
      {...(max === undefined ? {} : { max })}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : Number(event.target.value))
      }
    />
  );
}

function LabsResult({
  result,
}: {
  result: ReturnType<typeof buildResponsibleParlayCandidates>;
}) {
  return (
    <article className="labs-warning" aria-live="polite">
      <strong>{result.message}</strong>
      {result.outcome === "watchlist" ? (
        <p>
          Current supplied prices are missing or stale. This remains a research
          watchlist and no candidate is constructed.
        </p>
      ) : null}
      {result.candidates.length > 0 ? (
        <div className="labs-candidates">
          {result.candidates.map((candidate) => (
            <CandidateCard key={candidate.profile} candidate={candidate} />
          ))}
        </div>
      ) : null}
      {[...result.watchlist, ...result.rejectedLegs].length > 0 ? (
        <ul>
          {[...result.watchlist, ...result.rejectedLegs].map((item) => (
            <li key={`${item.id}:${item.reason}`}>
              <strong>{item.label}:</strong> {item.reason}
            </li>
          ))}
        </ul>
      ) : null}
      <ul>
        {result.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </article>
  );
}

function CandidateCard({ candidate }: { candidate: ParlayCandidate }) {
  return (
    <section className="labs-candidate">
      <StatusBadge tone="info">{profileLabel(candidate.profile)}</StatusBadge>
      <strong>{candidate.legs.length} supplied legs</strong>
      <span>
        Joint probability {percent(candidate.correlationAdjustedProbability)}
      </span>
      <span>
        Edge range {signedPercent(candidate.estimatedEdgeLow)} to{" "}
        {signedPercent(candidate.estimatedEdgeHigh)}
      </span>
      <span>Uncertainty {percent(candidate.uncertainty)}</span>
      <span>Return index {candidate.expectedReturnIndex.toFixed(3)}</span>
      <ul>
        {candidate.legs.map((leg) => (
          <li key={leg.id}>
            {leg.label} · {marketLabel(leg.market)} {leg.line} ·{" "}
            {leg.americanOdds && leg.americanOdds > 0 ? "+" : ""}
            {leg.americanOdds}
          </li>
        ))}
      </ul>
    </section>
  );
}

function createBlankLeg(): ManualOddsLeg {
  return {
    id: crypto.randomUUID(),
    label: "",
    market: "",
    line: null,
    americanOdds: null,
    oppositeAmericanOdds: null,
    estimatedProbability: null,
    uncertainty: 0.05,
    sourceType: "manual",
    sourceName: "",
    bookOrConsensus: "",
    recordedAt: "",
    availability: "unknown",
  };
}

function updateLeg(
  legs: ManualOddsLeg[],
  id: string,
  patch: Partial<ManualOddsLeg>,
): ManualOddsLeg[] {
  return legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg));
}

function resolvePlayerPool(input: {
  rosterId: number | null;
  players: Player[];
  rosters: Array<{
    roster_id: number;
    players: string[] | null;
    starters: string[] | null;
  }>;
  matchups: Array<{
    roster_id: number;
    matchup_id?: number | null;
    starters: string[] | null;
  }>;
  includeBench: boolean;
  includeOpponent: boolean;
  includeWatched: boolean;
  watchedPlayerIds: string[];
}): Player[] {
  if (input.rosterId === null) return [];
  const roster = input.rosters.find(
    (candidate) => candidate.roster_id === input.rosterId,
  );
  if (!roster) return [];
  const ids = new Set(roster.starters ?? []);
  if (input.includeBench) {
    for (const playerId of roster.players ?? []) ids.add(playerId);
  }
  if (input.includeOpponent) {
    const userMatchup = input.matchups.find(
      (matchup) => matchup.roster_id === input.rosterId,
    );
    const opponent = input.matchups.find(
      (matchup) =>
        matchup.roster_id !== input.rosterId &&
        matchup.matchup_id !== null &&
        matchup.matchup_id === userMatchup?.matchup_id,
    );
    for (const playerId of opponent?.starters ?? []) ids.add(playerId);
  }
  if (input.includeWatched) {
    for (const playerId of input.watchedPlayerIds) ids.add(playerId);
  }
  const players = new Map(input.players.map((player) => [player.id, player]));
  return [...ids].flatMap((id) => {
    const player = players.get(id);
    return player ? [player] : [];
  });
}

function playerAvailability(player: Player): LegAvailability {
  if (player.status === "inactive") return "inactive";
  if (player.injuryStatus?.toLowerCase() === "out") return "out";
  if (player.status === "injured" || player.injuryStatus) return "questionable";
  if (player.status === "active") return "active";
  return "unknown";
}

async function loadPreferences(): Promise<LabsPreferences> {
  if (!hasStorage()) return defaultPreferences;
  const stored = await chrome.storage.local.get(PREFERENCES_KEY);
  const value = stored[PREFERENCES_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultPreferences;
  }
  const record = value as Partial<LabsPreferences>;
  return {
    permanentlyDisabled: record.permanentlyDisabled === true,
    cooldownUntil:
      typeof record.cooldownUntil === "number" &&
      Number.isFinite(record.cooldownUntil)
        ? record.cooldownUntil
        : null,
  };
}

async function savePreferences(preferences: LabsPreferences): Promise<void> {
  if (!hasStorage()) return;
  await chrome.storage.local.set({ [PREFERENCES_KEY]: preferences });
}

function hasStorage(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  const storage: unknown = Reflect.get(chromeValue, "storage");
  return Boolean(storage && typeof storage === "object");
}

function profileLabel(profile: ParlayCandidate["profile"]): string {
  if (profile === "conservative") return "Conservative";
  if (profile === "balanced") return "Balanced";
  return "Higher variance";
}

function marketLabel(market: ManualOddsLeg["market"]): string {
  return marketOptions.find((option) => option.value === market)?.label ?? "";
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}
