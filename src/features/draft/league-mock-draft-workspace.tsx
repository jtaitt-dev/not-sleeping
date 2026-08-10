import {
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { RealtimeIntelligenceCard } from "@/components/intelligence/realtime-intelligence-card";
import { PositionBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState, InlineError } from "@/components/ui/states";
import {
  MockDraftSession,
  assertDraftInvariants,
  draftablePlayerPool,
  ownerForPick,
  pickCoordinates,
  type DraftEnginePlayer,
  type DraftEngineState,
  type DraftRecommendation,
} from "@/services/draft/draft-engine";
import { buildLeagueMockDraftPlan } from "@/services/draft/league-mock-config";
import {
  clearMockDraft,
  loadMockDraft,
  mockDraftPlanFingerprint,
  saveMockDraft,
} from "@/services/draft/mock-draft-storage";
import type { DecisionCandidate } from "@/services/intelligence/types";
import {
  requestRuntime,
  safeRuntimeError,
} from "@/services/messaging/runtime-client";
import { useLeagueStore } from "@/stores/league-store";
import type { Player, Position } from "@/types/domain";

import "./league-mock-draft-workspace.css";

export function LeagueMockDraftWorkspace() {
  const context = useLeagueStore((state) => state.activeContext);
  const snapshot = useLeagueStore((state) => state.snapshot);
  const leagueStatus = useLeagueStore((state) => state.status);
  const draft = useMemo(
    () =>
      snapshot?.drafts.find(
        (candidate) =>
          candidate.season === snapshot.league.season &&
          ["drafting", "paused", "pre_draft"].includes(candidate.status),
      ) ??
      snapshot?.drafts.find(
        (candidate) => candidate.season === snapshot.league.season,
      ) ??
      snapshot?.drafts[0] ??
      null,
    [snapshot],
  );
  const [localSlot, setLocalSlot] = useState(1);
  const plan = useMemo(
    () =>
      context && snapshot
        ? buildLeagueMockDraftPlan({
            league: snapshot.league,
            draft,
            rosters: snapshot.rosters,
            users: snapshot.users,
            tradedPicks: snapshot.tradedPicks,
            userId: context.userId,
            userSlotOverride: localSlot,
          })
        : null,
    [context, draft, localSlot, snapshot],
  );
  const [players, setPlayers] = useState<Player[]>([]);
  const [poolError, setPoolError] = useState("");
  const [loadingPool, setLoadingPool] = useState(false);
  const [session, setSession] = useState<MockDraftSession | null>(null);
  const [sessionState, setSessionState] = useState<DraftEngineState | null>(
    null,
  );
  const [manualEveryPick, setManualEveryPick] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const hydratedKey = useRef("");

  const requiredPoolSize = plan
    ? Math.min(
        1_000,
        Math.max(420, plan.config.teams * plan.config.rounds + 120),
      )
    : 420;

  useEffect(() => {
    if (!plan) return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return [];
        setLoadingPool(true);
        setPoolError("");
        return requestRuntime<Player[]>({
          type: "GET_PLAYER_POOL",
          payload: {
            limit: requiredPoolSize,
            rookiesOnly: plan.config.playerPool === "rookies_only",
            idpOnly: false,
          },
        });
      })
      .then((rows) => {
        if (active) setPlayers(rows);
      })
      .catch((cause: unknown) => {
        if (active) setPoolError(safeRuntimeError(cause).message);
      })
      .finally(() => {
        if (active) setLoadingPool(false);
      });
    return () => {
      active = false;
    };
  }, [plan, requiredPoolSize]);

  const draftPlayers = useMemo(
    () => players.map(toDraftEnginePlayer),
    [players],
  );
  const eligiblePlayerCount = useMemo(
    () => (plan ? draftablePlayerPool(draftPlayers, plan.config).length : 0),
    [draftPlayers, plan],
  );
  const fingerprint = plan ? mockDraftPlanFingerprint(plan.config) : "";
  const storageIdentity = useMemo(
    () =>
      plan && context
        ? {
            accountId: context.userId,
            leagueId: plan.leagueId,
            draftId: plan.draftId,
          }
        : null,
    [context, plan],
  );
  const workspaceKey = storageIdentity
    ? `${storageIdentity.accountId}:${storageIdentity.leagueId}:${storageIdentity.draftId ?? "local"}:${fingerprint}`
    : "";

  useEffect(() => {
    if (!plan || !storageIdentity || draftPlayers.length === 0) return;
    if (hydratedKey.current === workspaceKey) return;
    hydratedKey.current = workspaceKey;
    setSession(null);
    setSessionState(null);
    setNotice("");
    setError("");
    let active = true;
    void loadMockDraft({
      ...storageIdentity,
      planFingerprint: fingerprint,
    }).then((saved) => {
      if (!active || !saved) return;
      try {
        const restored = MockDraftSession.restore(
          { ...plan.config, manualAllTeams: true },
          draftPlayers,
          saved.state,
        );
        setSession(restored);
        setSessionState(restored.snapshot());
        setNotice(
          `Restored this league's local mock from ${new Date(saved.updatedAt).toLocaleString()}.`,
        );
      } catch {
        setError(
          "The saved mock no longer matches the verified league or player pool. Start a new local mock.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [draftPlayers, fingerprint, plan, storageIdentity, workspaceKey]);

  useEffect(() => {
    if (!sessionState || !storageIdentity || !fingerprint) return;
    void saveMockDraft({
      ...storageIdentity,
      planFingerprint: fingerprint,
      state: sessionState,
    }).catch(() => {
      setError(
        "This local mock could not be saved for browser-restart recovery.",
      );
    });
  }, [fingerprint, sessionState, storageIdentity]);

  if (leagueStatus === "loading" || leagueStatus === "switching") {
    return (
      <section className="workspace-page league-mock-workspace">
        <EmptyState
          title="Loading this league"
          detail="Fetching verified Sleeper settings before the local draft is created."
        />
      </section>
    );
  }
  if (!context || !snapshot || !plan) {
    return (
      <section className="workspace-page league-mock-workspace">
        <EmptyState
          title="Choose a Sleeper league"
          detail="A mock draft always belongs to one account, league, season, and draft."
        />
      </section>
    );
  }
  const activePlan = plan;

  const validation =
    sessionState && session
      ? assertDraftInvariants(session.config, sessionState, draftPlayers)
      : null;
  const recommendations = session?.recommendations(12) ?? [];
  const recommendationPlayers = recommendationRows(
    recommendations,
    draftPlayers,
  );
  const searchResults = search.trim()
    ? draftPlayers
        .filter((player) =>
          sessionState?.availablePlayerIds.includes(player.playerId),
        )
        .filter((player) => session?.isLegalPick(player.playerId))
        .filter((player) =>
          `${player.name} ${player.team ?? ""} ${player.positions.join(" ")}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .slice(0, 30)
        .map((player) => ({ player, recommendation: null }))
    : recommendationPlayers;
  const currentOwnerSlot = sessionState
    ? ownerForPick(plan.config, sessionState.currentPick)
    : plan.config.userSlot;
  const currentCoordinates = sessionState
    ? pickCoordinates(plan.config, sessionState.currentPick)
    : pickCoordinates(plan.config, 1);
  const nextUserPick = sessionState
    ? findNextOwnedPick(
        plan.config,
        sessionState.currentPick,
        plan.config.userSlot,
      )
    : null;
  const intelligenceCandidates: DecisionCandidate[] = recommendations.map(
    (recommendation) => {
      const player = draftPlayers.find(
        (candidate) => candidate.playerId === recommendation.playerId,
      );
      return {
        id: recommendation.playerId,
        label: player?.name ?? recommendation.playerId,
        position: player?.positions[0],
        team: player?.team,
        baseValue: recommendation.score,
        adp: player?.adp,
        rosterFit: recommendation.factors.some((factor) =>
          factor.includes("roster need"),
        )
          ? 1
          : 0.5,
        scarcity: 1 - recommendation.availabilityAtNextPick,
        available: true,
        eligible: true,
        alreadySelected: false,
        reasons: recommendation.factors,
      };
    },
  );

  function startMock() {
    setError("");
    try {
      const next = new MockDraftSession(
        { ...activePlan.config, manualAllTeams: manualEveryPick },
        draftPlayers,
      );
      const started = next.start();
      setSession(next);
      setSessionState(
        manualEveryPick ? started : next.simulateOpponentsToUserTurn(),
      );
      setNotice(
        manualEveryPick
          ? "Manual entry is on. Every selection requires a click."
          : "Opponent simulation stopped at your first selection.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The mock could not start.",
      );
    }
  }

  function makePick(playerId: string) {
    if (!session || !sessionState) return;
    setError("");
    try {
      const picked = manualEveryPick
        ? session.makePick(playerId)
        : session.makeUserPick(playerId);
      setSessionState(
        manualEveryPick || picked.status === "complete"
          ? picked
          : session.simulateOpponentsToUserTurn(),
      );
      setSearch("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That pick is not legal.",
      );
    }
  }

  function command(action: "pause" | "resume" | "undo" | "redo") {
    if (!session) return;
    if (action === "pause") setSessionState(session.pause());
    if (action === "resume") setSessionState(session.resume());
    if (action === "undo") setSessionState(session.undo());
    if (action === "redo") setSessionState(session.redo());
  }

  async function resetMock() {
    if (!storageIdentity) return;
    await clearMockDraft(storageIdentity);
    setSession(null);
    setSessionState(null);
    setConfirmReset(false);
    setSearch("");
    setNotice("Only this league's local mock was cleared.");
    setError("");
  }

  return (
    <section className="workspace-page league-mock-workspace">
      <header className="workspace-heading">
        <div>
          <h1>Mock Draft</h1>
          <p>
            {plan.leagueName} · {plan.season} · verified Sleeper settings
          </p>
        </div>
        <StatusBadge tone="success">Local only</StatusBadge>
      </header>

      <div className="surface mock-safety-banner" role="status">
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>MOCK — NO SLEEPER WRITES</strong>
          <small>
            Every pick stays in the isolated {plan.leagueId.slice(-6)} storage
            namespace. No draft, roster, waiver, trade, or transaction endpoint
            is available.
          </small>
        </span>
      </div>

      <section className="surface mock-league-facts" aria-label="Draft facts">
        <Fact label="Teams" value={String(plan.config.teams)} />
        <Fact label="Rounds" value={String(plan.config.rounds)} />
        <Fact label="Order" value={plan.config.style.replaceAll("_", " ")} />
        <Fact
          label="Pool"
          value={plan.config.playerPool.replaceAll("_", " ")}
        />
        <Fact label="Format" value={plan.config.leagueType} />
        <Fact label="IDP" value={plan.config.idp ? "Yes" : "No"} />
        <Fact label="Best Ball" value={plan.config.bestBall ? "Yes" : "No"} />
        <Fact label="Traded picks" value={String(plan.pickOwnership.length)} />
      </section>

      {plan.warnings.map((warning) => (
        <div className="surface mock-warning" key={warning}>
          <AlertTriangle aria-hidden="true" /> {warning}
        </div>
      ))}
      {poolError ? (
        <InlineError title="Player pool unavailable" detail={poolError} />
      ) : null}
      {error ? (
        <InlineError title="Mock draft needs attention" detail={error} />
      ) : null}
      {notice ? (
        <p className="mock-notice" role="status">
          {notice}
        </p>
      ) : null}

      {!sessionState ? (
        <section className="surface mock-setup">
          <div>
            <h2>Use this league</h2>
            <p>
              {draft
                ? `${draft.status.replaceAll("_", " ")} ${draft.type} draft ${draft.draft_id.slice(-6)}`
                : "Sleeper has no draft board for this league yet."}
            </p>
          </div>
          {!plan.draftOrderAssigned ? (
            <label>
              Your local draft slot
              <select
                value={plan.config.userSlot}
                onChange={(event) => setLocalSlot(Number(event.target.value))}
              >
                {Array.from(
                  { length: plan.config.teams },
                  (_, index) => index + 1,
                ).map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </select>
            </label>
          ) : (
            <Fact
              label="Your Sleeper slot"
              value={String(plan.config.userSlot)}
            />
          )}
          <label className="mock-toggle">
            <input
              type="checkbox"
              checked={manualEveryPick}
              onChange={(event) => setManualEveryPick(event.target.checked)}
            />
            <span>
              <strong>Enter every pick manually</strong>
              <small>
                No autopicks. Recommended for draft-entry validation.
              </small>
            </span>
          </label>
          <label className="mock-toggle">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(event) => setAiEnabled(event.target.checked)}
            />
            <span>
              <strong>Enable optional AI analysis</strong>
              <small>
                Deterministic legality remains authoritative; AI can be turned
                off.
              </small>
            </span>
          </label>
          <Button
            variant="primary"
            icon={<Play />}
            onClick={startMock}
            disabled={
              loadingPool ||
              eligiblePlayerCount < plan.config.teams * plan.config.rounds
            }
          >
            {loadingPool ? "Loading verified players…" : "Start local mock"}
          </Button>
          {!loadingPool &&
          eligiblePlayerCount < plan.config.teams * plan.config.rounds ? (
            <p className="mock-pool-warning">
              The verified {plan.config.playerPool.replaceAll("_", " ")} pool
              has {eligiblePlayerCount} eligible, available players but this
              draft needs {plan.config.teams * plan.config.rounds}.
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <section className="surface mock-on-clock">
            <span>
              <small>
                {sessionState.status === "complete"
                  ? "Complete"
                  : "On the clock"}
              </small>
              <strong>
                {sessionState.status === "complete"
                  ? `${sessionState.picks.length} picks recorded`
                  : `${teamLabel(plan.teamLabelsBySlot, currentOwnerSlot)} · ${currentCoordinates.round}.${String(currentCoordinates.pickInRound).padStart(2, "0")}`}
              </strong>
            </span>
            <StatusBadge
              tone={
                currentOwnerSlot === plan.config.userSlot ? "success" : "info"
              }
            >
              {currentOwnerSlot === plan.config.userSlot
                ? "Your team"
                : `Slot ${currentOwnerSlot}`}
            </StatusBadge>
          </section>

          <section className="mock-toolbar" aria-label="Mock draft controls">
            <Button
              size="small"
              icon={sessionState.status === "paused" ? <Play /> : <Pause />}
              onClick={() =>
                command(sessionState.status === "paused" ? "resume" : "pause")
              }
              disabled={sessionState.status === "complete"}
            >
              {sessionState.status === "paused" ? "Resume" : "Pause"}
            </Button>
            <Button
              size="small"
              icon={<RotateCcw />}
              onClick={() => command("undo")}
            >
              Undo
            </Button>
            <Button
              size="small"
              icon={<RotateCw />}
              onClick={() => command("redo")}
            >
              Redo
            </Button>
            {!manualEveryPick ? (
              <Button
                size="small"
                onClick={() =>
                  setSessionState(
                    session?.simulateOpponentsToUserTurn() ?? sessionState,
                  )
                }
                disabled={
                  sessionState.status !== "drafting" ||
                  currentOwnerSlot === plan.config.userSlot
                }
              >
                Run opponents
              </Button>
            ) : null}
            {confirmReset ? (
              <Button
                size="small"
                variant="danger"
                onClick={() => void resetMock()}
              >
                Confirm reset
              </Button>
            ) : (
              <Button
                size="small"
                icon={<Trash2 />}
                onClick={() => setConfirmReset(true)}
              >
                Reset
              </Button>
            )}
          </section>

          <div
            className={`surface mock-validation ${validation?.passed ? "valid" : "invalid"}`}
            role="status"
          >
            {validation?.passed ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <AlertTriangle aria-hidden="true" />
            )}
            {validation?.passed
              ? `${sessionState.picks.length} legal picks · exact order, ownership, eligibility, pool, limits, and duplicates checked`
              : validation?.errors.join(" ")}
          </div>

          {aiEnabled && sessionState.status !== "complete" ? (
            <RealtimeIntelligenceCard
              feature="draft"
              subject={`${plan.leagueId}:${plan.draftId ?? "local"}:mock:${sessionState.currentPick}`}
              contextSummary={`${plan.leagueName}; ${plan.config.leagueType}; ${plan.config.playerPool}; ${plan.config.style}; ${plan.config.teams} teams; ${plan.config.rounds} rounds; current pick ${sessionState.currentPick}; current owner slot ${currentOwnerSlot}. This is an isolated local mock.`}
              candidates={intelligenceCandidates}
              strategy={context.strategy}
              riskTolerance={0.5}
              currentPick={sessionState.currentPick}
              picksUntilNext={
                nextUserPick
                  ? nextUserPick - sessionState.currentPick
                  : undefined
              }
            />
          ) : (
            <div className="surface mock-ai-off">
              <strong>Non-AI mode</strong>
              <span>
                Deterministic rankings, scarcity, roster fit, eligibility, and
                ownership remain active.
              </span>
            </div>
          )}

          <section
            className={`mock-entry-grid ${sessionState.status === "complete" ? "is-complete" : ""}`}
          >
            {sessionState.status !== "complete" ? (
              <div className="surface mock-player-entry">
                <header>
                  <div>
                    <h2>Enter the pick</h2>
                    <p>
                      {manualEveryPick
                        ? "Every team is manual"
                        : "Your selections are manual"}
                    </p>
                  </div>
                  <span>
                    {sessionState.availablePlayerIds.length} available
                  </span>
                </header>
                <label>
                  <span className="sr-only">Search available players</span>
                  <input
                    type="search"
                    value={search}
                    placeholder="Search name, team, or position"
                    onChange={(event) => setSearch(event.target.value)}
                    disabled={sessionState.status !== "drafting"}
                  />
                </label>
                <div className="mock-player-list">
                  {searchResults.map(({ player, recommendation }, index) => (
                    <article key={player.playerId}>
                      <strong className="tabular">
                        {recommendation?.rank ?? index + 1}
                      </strong>
                      <PositionBadge
                        position={badgePosition(player.positions[0])}
                      />
                      <span>
                        <b>{player.name}</b>
                        <small>
                          {player.team ?? "FA"} · {player.positions.join("/")} ·
                          ADP {Math.round(player.adp)}
                        </small>
                        {recommendation ? (
                          <small>{recommendation.factors.join(" · ")}</small>
                        ) : null}
                      </span>
                      {recommendation ? (
                        <small className="tabular">
                          {Math.round(
                            recommendation.availabilityAtNextPick * 100,
                          )}
                          % next pick
                        </small>
                      ) : null}
                      <Button
                        size="small"
                        variant={
                          recommendation?.rank === 1 ? "primary" : "ghost"
                        }
                        onClick={() => makePick(player.playerId)}
                        disabled={
                          sessionState.status !== "drafting" ||
                          (!manualEveryPick &&
                            currentOwnerSlot !== plan.config.userSlot)
                        }
                      >
                        Record pick
                      </Button>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="surface mock-pick-history">
              <header>
                <div>
                  <h2>Recorded picks</h2>
                  <p>Original and current owner stay separate.</p>
                </div>
                <span>{sessionState.picks.length}</span>
              </header>
              {sessionState.picks.length === 0 ? (
                <EmptyState
                  title="No picks yet"
                  detail="Choose a verified available player to record pick 1.01."
                />
              ) : (
                <div>
                  {sessionState.picks.toReversed().map((pick) => {
                    const player = draftPlayers.find(
                      (candidate) => candidate.playerId === pick.playerId,
                    );
                    return (
                      <article key={pick.pickNumber}>
                        <strong className="tabular">
                          {pick.round}.
                          {String(pick.pickInRound).padStart(2, "0")}
                        </strong>
                        <PositionBadge
                          position={badgePosition(player?.positions[0])}
                        />
                        <span>
                          <b>{player?.name ?? pick.playerId}</b>
                          <small>
                            Current:{" "}
                            {teamLabel(plan.teamLabelsBySlot, pick.ownerSlot)} ·
                            Original:{" "}
                            {teamLabel(plan.teamLabelsBySlot, pick.draftSlot)}
                          </small>
                        </span>
                        {pick.ownerSlot !== pick.draftSlot ? (
                          <StatusBadge tone="warning">Traded</StatusBadge>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="mock-fact">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function toDraftEnginePlayer(player: Player, index: number): DraftEnginePlayer {
  const rank = player.searchRank ?? index + 1;
  const value = Math.max(1, Math.min(100, 101 - rank * 0.12));
  return {
    playerId: player.id,
    name: player.fullName,
    positions: player.fantasyPositions.length
      ? player.fantasyPositions
      : [player.position],
    team: player.team,
    adp: rank,
    tier: Math.floor(index / 12) + 1,
    redraftValue: value,
    dynastyValue: Math.max(
      1,
      Math.min(100, value + (player.age && player.age < 25 ? 7 : 0)),
    ),
    contenderValue: value,
    rookie: player.yearsExperience === 0,
    age: player.age,
    auctionValue: Math.max(1, Math.round((value - 45) * 1.2)),
  };
}

function recommendationRows(
  recommendations: DraftRecommendation[],
  players: DraftEnginePlayer[],
) {
  return recommendations.flatMap((recommendation) => {
    const player = players.find(
      (candidate) => candidate.playerId === recommendation.playerId,
    );
    return player ? [{ player, recommendation }] : [];
  });
}

function teamLabel(labels: Record<number, string>, slot: number): string {
  return labels[slot] ?? `Draft slot ${slot}`;
}

function findNextOwnedPick(
  config: MockDraftSession["config"],
  currentPick: number,
  ownerSlot: number,
): number | null {
  const maximum = config.teams * config.rounds;
  for (let pick = currentPick + 1; pick <= maximum; pick += 1) {
    if (ownerForPick(config, pick) === ownerSlot) return pick;
  }
  return null;
}

const BADGE_POSITIONS = new Set<Position>([
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DEF",
  "DL",
  "DE",
  "DT",
  "EDGE",
  "LB",
  "ILB",
  "OLB",
  "DB",
  "CB",
  "S",
  "FS",
  "SS",
]);

function badgePosition(position: string | undefined): Position {
  const normalized = position?.toUpperCase() as Position | undefined;
  return normalized && BADGE_POSITIONS.has(normalized) ? normalized : "FLEX";
}
