import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock3,
  EyeOff,
  Filter,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  TimerReset,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ScoreBreakdown } from "@/components/intelligence/score-breakdown";
import { PositionBadge, StatusBadge, TierBadge } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { translateDraftError } from "@/services/draft/draft-errors";
import { requestRuntime } from "@/services/messaging/runtime-client";
import {
  getActiveFixture,
  getLiveRecommendations,
  getRecommendations,
  getVisiblePicks,
  useAppStore,
} from "@/stores/app-store";
import type {
  DraftContext,
  DraftSessionKind,
  Recommendation,
  Strategy,
} from "@/types/domain";

import { DraftCopilotCard } from "./draft-copilot-card";
import "./draft-workspace.css";

const strategyLabels: Record<Strategy, string> = {
  contender: "Win now",
  balanced: "Balanced",
  productive_struggle: "Productive struggle",
  rebuild: "Rebuild",
};

const sessionLabels: Record<DraftSessionKind, string> = {
  league_draft: "League draft",
  league_mock: "League mock",
  standalone_mock: "Standalone mock",
  unknown: "Unknown session",
};

const boardPositions = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
  "IDP",
] as const;
type BoardPosition = (typeof boardPositions)[number];

export function DraftWorkspace() {
  const {
    fixtureId,
    demoEnabled,
    liveState,
    runtimeError,
    draftStep,
    demoPaused,
    demoSpeed,
    strategy,
    riskTolerance,
    watchlist,
    hiddenPlayers,
    simulation,
    setDemoPaused,
    setDemoSpeed,
    setStrategy,
    setRiskTolerance,
    nextDemoPick,
    resetDemo,
    refreshLiveDraft,
    toggleWatch,
    toggleHidden,
    addSimulation,
    undoSimulation,
    resetSimulation,
  } = useAppStore();
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [position, setPosition] = useState<BoardPosition>("ALL");
  const [boardLimit, setBoardLimit] = useState(12);
  const [sessionSaving, setSessionSaving] = useState(false);
  const fixture = getActiveFixture(fixtureId);
  const context =
    !demoEnabled && liveState ? liveState.context : fixture.context;
  const format = !demoEnabled && liveState ? liveState.format : fixture.format;

  useEffect(() => {
    if (!demoEnabled || demoPaused || fixture.context.status === "complete")
      return;
    const timer = window.setInterval(nextDemoPick, 2800 / demoSpeed);
    return () => window.clearInterval(timer);
  }, [
    demoEnabled,
    demoPaused,
    demoSpeed,
    fixture.context.status,
    nextDemoPick,
  ]);

  const recommendations = useMemo(() => {
    if (!demoEnabled && !liveState) return [];
    if (!demoEnabled && liveState) {
      return getLiveRecommendations(
        liveState,
        strategy,
        riskTolerance,
        hiddenPlayers,
      );
    }
    return getRecommendations(
      fixtureId,
      draftStep,
      strategy,
      riskTolerance,
      hiddenPlayers,
    );
  }, [
    demoEnabled,
    draftStep,
    fixtureId,
    hiddenPlayers,
    liveState,
    riskTolerance,
    strategy,
  ]);
  const picks =
    !demoEnabled && liveState
      ? liveState.picks
      : getVisiblePicks(fixtureId, draftStep);
  const draftComplete = context.status === "complete";
  const visibleRecommendations = recommendations.filter((entry) => {
    if (position === "ALL") return true;
    if (position === "IDP") {
      return [
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
        "IDP_FLEX",
      ].includes(entry.player.position);
    }
    return entry.player.position === position;
  });
  const safeError = runtimeError ? translateDraftError(runtimeError) : null;

  const saveSessionKind = async (sessionKind: DraftSessionKind) => {
    if (demoEnabled || !context.draftId) return;
    setSessionSaving(true);
    try {
      await requestRuntime({
        type: "SET_DRAFT_SESSION_OVERRIDE",
        payload: { draftId: context.draftId, sessionKind },
      });
      await refreshLiveDraft();
    } finally {
      setSessionSaving(false);
    }
  };

  return (
    <section className="draft-workspace">
      <DraftContextRail
        context={context}
        format={format}
        demoEnabled={demoEnabled}
        demoPaused={demoPaused}
        demoSpeed={demoSpeed}
        strategy={strategy}
        riskTolerance={riskTolerance}
        sessionSaving={sessionSaving}
        onSessionKindChange={(value) => void saveSessionKind(value)}
        onDemoPausedChange={setDemoPaused}
        onDemoSpeedChange={setDemoSpeed}
        onResetDemo={resetDemo}
        onStrategyChange={setStrategy}
        onRiskToleranceChange={setRiskTolerance}
      />

      {safeError ? (
        <aside className="draft-safe-banner" role="status">
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>{safeError.title}</strong>
            <small>
              {safeError.detail} {safeError.action}
            </small>
          </span>
          <Button
            size="small"
            variant="ghost"
            onClick={() => void refreshLiveDraft()}
          >
            Retry
          </Button>
        </aside>
      ) : null}

      {context.status === "pre_draft" ? (
        <WaitingState context={context} recommendations={recommendations} />
      ) : null}

      {!draftComplete && recommendations.length > 0 ? (
        <DraftCopilotCard
          context={context}
          format={format}
          recommendations={recommendations}
          strategy={strategy}
          riskTolerance={riskTolerance}
        />
      ) : draftComplete ? (
        <CompletedState context={context} picks={picks.length} />
      ) : (
        <UnavailableState
          demoEnabled={demoEnabled}
          hasError={Boolean(runtimeError)}
          onReset={resetDemo}
          onRefresh={() => void refreshLiveDraft()}
        />
      )}

      {!draftComplete ? (
        <section
          className="recommendation-board"
          aria-labelledby="recommendation-board-heading"
        >
          <header className="board-heading">
            <div>
              <span className="section-label">Recommendation board</span>
              <h2 id="recommendation-board-heading">
                Available, eligible, and context-ranked
              </h2>
            </div>
            <span className="read-only-chip">
              <ShieldCheck aria-hidden="true" /> Read-only
            </span>
          </header>
          <div className="board-toolbar">
            <div
              className="position-filters"
              aria-label="Filter recommendation board by position"
            >
              {boardPositions
                .filter((value) => value !== "IDP" || format.idp)
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={position === value ? "active" : ""}
                    aria-pressed={position === value}
                    onClick={() => setPosition(value)}
                  >
                    {value === "ALL" ? "All" : value}
                  </button>
                ))}
            </div>
            <span>
              <Filter aria-hidden="true" /> Score · tier · next-pick range
            </span>
          </div>
          <div className="player-table" aria-label="Draft recommendations">
            <div className="player-table-head">
              <span>#</span>
              <span>Player</span>
              <span>Score</span>
              <span>At next pick</span>
              <span className="sr-only">Actions</span>
            </div>
            {visibleRecommendations
              .slice(0, boardLimit)
              .map((recommendation) => (
                <RecommendationRow
                  key={recommendation.player.id}
                  recommendation={recommendation}
                  expanded={expandedPlayer === recommendation.player.id}
                  watched={watchlist.includes(recommendation.player.id)}
                  onExpand={() =>
                    setExpandedPlayer((current) =>
                      current === recommendation.player.id
                        ? null
                        : recommendation.player.id,
                    )
                  }
                  onWatch={() => toggleWatch(recommendation.player.id)}
                  onHide={() => toggleHidden(recommendation.player.id)}
                  onExplore={() =>
                    addSimulation({
                      type: "draft",
                      playerId: recommendation.player.id,
                      label: `Explore ${recommendation.player.fullName}`,
                    })
                  }
                />
              ))}
          </div>
          {visibleRecommendations.length > boardLimit ? (
            <button
              className="board-more"
              type="button"
              onClick={() => setBoardLimit((value) => value + 12)}
            >
              Show more ({visibleRecommendations.length - boardLimit} remaining)
              <ChevronDown aria-hidden="true" />
            </button>
          ) : null}
        </section>
      ) : null}

      <RecentPicks picks={picks} context={context} teams={format.teams} />

      {!draftComplete ? (
        <WhatIf
          recommendations={recommendations}
          simulation={simulation}
          onAdd={addSimulation}
          onUndo={undoSimulation}
          onReset={resetSimulation}
        />
      ) : null}
    </section>
  );
}

function DraftContextRail({
  context,
  format,
  demoEnabled,
  demoPaused,
  demoSpeed,
  strategy,
  riskTolerance,
  sessionSaving,
  onSessionKindChange,
  onDemoPausedChange,
  onDemoSpeedChange,
  onResetDemo,
  onStrategyChange,
  onRiskToleranceChange,
}: {
  context: DraftContext;
  format: ReturnType<typeof getActiveFixture>["format"];
  demoEnabled: boolean;
  demoPaused: boolean;
  demoSpeed: number;
  strategy: Strategy;
  riskTolerance: number;
  sessionSaving: boolean;
  onSessionKindChange: (value: DraftSessionKind) => void;
  onDemoPausedChange: (value: boolean) => void;
  onDemoSpeedChange: (value: number) => void;
  onResetDemo: () => void;
  onStrategyChange: (value: Strategy) => void;
  onRiskToleranceChange: (value: number) => void;
}) {
  const formatParts = [
    context.mode.replaceAll("_", " "),
    format.superflex ? "Superflex" : format.twoQuarterback ? "2QB" : "1QB",
    `${format.teams} teams`,
    context.draftStyle.replaceAll("_", " "),
    format.tightEndPremium ? "TE premium" : null,
    format.bestBall ? "Best ball" : null,
    format.idp ? "IDP" : null,
  ].filter(Boolean);
  return (
    <section className="draft-context-rail" aria-label="Draft context">
      <div className="draft-context-rail__summary">
        <span className={context.isUserOnClock ? "is-on-clock" : ""}>
          <Clock3 aria-hidden="true" />
          <strong>
            {context.status === "pre_draft"
              ? "Waiting for draft"
              : context.isUserOnClock
                ? "You are on the clock"
                : (context.currentDrafter ?? "Draft room")}
          </strong>
        </span>
        <span>
          {context.nextUserPick === undefined
            ? "Owned pick not linked"
            : context.isUserOnClock
              ? `Next owned pick ${formatPick(context.nextUserPick, format.teams)}`
              : `${context.picksUntilUser} pick${context.picksUntilUser === 1 ? "" : "s"} until you`}
        </span>
      </div>
      <div className="draft-context-rail__facts">
        {formatParts.map((part) => (
          <span key={part}>{part}</span>
        ))}
      </div>
      <details className="draft-context-rail__settings">
        <summary>
          <Settings2 aria-hidden="true" /> Draft controls
        </summary>
        <div>
          <label>
            <span>Session type</span>
            <select
              value={context.sessionKind}
              disabled={demoEnabled || sessionSaving || !context.draftId}
              onChange={(event) =>
                onSessionKindChange(event.target.value as DraftSessionKind)
              }
            >
              {Object.entries(sessionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small>
              {context.sessionKindOverride
                ? "Saved correction"
                : `${Math.round(context.sessionKindConfidence * 100)}% detected`}
            </small>
          </label>
          <label>
            <span>Strategy</span>
            <select
              value={strategy}
              onChange={(event) =>
                onStrategyChange(event.target.value as Strategy)
              }
            >
              {Object.entries(strategyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="context-risk-control">
            <span>
              Risk tolerance <b>{Math.round(riskTolerance * 100)}%</b>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={riskTolerance}
              onChange={(event) =>
                onRiskToleranceChange(Number(event.target.value))
              }
            />
          </label>
          {demoEnabled ? (
            <div className="context-demo-controls">
              <StatusBadge tone="info">QA demo</StatusBadge>
              <IconButton
                label={demoPaused ? "Play demo" : "Pause demo"}
                onClick={() => onDemoPausedChange(!demoPaused)}
              >
                {demoPaused ? <Play /> : <Pause />}
              </IconButton>
              <select
                aria-label="Demo speed"
                value={demoSpeed}
                onChange={(event) =>
                  onDemoSpeedChange(Number(event.target.value))
                }
              >
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="2">2×</option>
              </select>
              <IconButton label="Reset demo" onClick={onResetDemo}>
                <RotateCcw />
              </IconButton>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function RecommendationRow({
  recommendation,
  expanded,
  watched,
  onExpand,
  onWatch,
  onHide,
  onExplore,
}: {
  recommendation: Recommendation;
  expanded: boolean;
  watched: boolean;
  onExpand: () => void;
  onWatch: () => void;
  onHide: () => void;
  onExplore: () => void;
}) {
  const { player } = recommendation;
  return (
    <div className={`recommendation-row ${expanded ? "is-expanded" : ""}`}>
      <button
        className="recommendation-row__main"
        type="button"
        onClick={onExpand}
        aria-expanded={expanded}
      >
        <span className="rank-cell tabular">
          {recommendation.rank}
          <ChevronRight aria-hidden="true" />
        </span>
        <span className="player-cell">
          <PlayerAvatar player={player} size="small" />
          <span>
            <strong>{player.fullName}</strong>
            <small>
              {player.team ?? "FA"} · Tier {recommendation.tier} ·{" "}
              {recommendation.rosterFit} fit
            </small>
          </span>
          <PositionBadge position={player.position} />
        </span>
        <span className="score-cell tabular">
          <b>{Math.round(recommendation.contextualScore)}</b>
          <small>raw {recommendation.rawScore}</small>
        </span>
        <span className="availability-cell tabular">
          <b>
            {recommendation.nextPickAvailabilityRange[0]}–
            {recommendation.nextPickAvailabilityRange[1]}%
          </b>
          <small>
            {Math.round(recommendation.nextPickConfidence * 100)}% model
            confidence
          </small>
        </span>
        <ChevronDown className="row-chevron" aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="recommendation-row__details">
          <p>{recommendation.rationale}</p>
          <div className="recommendation-tags">
            <TierBadge tier={recommendation.tier} />
            <StatusBadge
              tone={recommendation.risk === "high" ? "warning" : "neutral"}
            >
              {recommendation.risk} risk
            </StatusBadge>
            <span>
              VOR {recommendation.valueOverReplacement > 0 ? "+" : ""}
              {recommendation.valueOverReplacement}
            </span>
          </div>
          <ScoreBreakdown
            localScore={recommendation.normalizedScore}
            factors={recommendation.components.map((component) => ({
              key: component.key,
              label: component.label,
              impact: component.value,
              note: component.reason,
            }))}
          />
          <div className="recommendation-actions">
            <Button
              size="small"
              variant={watched ? "secondary" : "ghost"}
              icon={<Star />}
              onClick={onWatch}
              aria-pressed={watched}
            >
              {watched ? "Watching" : "Watch"}
            </Button>
            <Button
              size="small"
              variant="ghost"
              icon={<EyeOff />}
              onClick={onHide}
            >
              Hide
            </Button>
            <Button
              size="small"
              variant="secondary"
              icon={<ArrowRight />}
              onClick={onExplore}
            >
              Explore what-if
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecentPicks({
  picks,
  context,
  teams,
}: {
  picks: ReturnType<typeof getVisiblePicks>;
  context: DraftContext;
  teams: number;
}) {
  return (
    <section className="recent-picks" aria-labelledby="recent-picks-heading">
      <header>
        <div>
          <span className="section-label">Recent picks</span>
          <h2 id="recent-picks-heading">Board movement</h2>
        </div>
        <span>{picks.length} recorded</span>
      </header>
      <div
        className="recent-picks-strip"
        role="region"
        aria-label="Scrollable recent draft picks"
        tabIndex={0}
      >
        {picks.slice(-7).map((pick) => (
          <article key={`${pick.pickNumber}-${pick.playerId}`}>
            <span className="tabular">
              {pick.round}.{String(pick.pickInRound).padStart(2, "0")}
            </span>
            <strong>{pick.playerName}</strong>
            <small>
              {pick.position} · {pick.pickedBy ?? "Unknown manager"}
            </small>
            {pick.isUserPick ? (
              <StatusBadge tone="info">You</StatusBadge>
            ) : null}
          </article>
        ))}
        {context.status !== "complete" ? (
          <article className="recent-picks-strip__clock">
            <span>{formatPick(context.currentPick, teams)}</span>
            <strong>
              {context.isUserOnClock
                ? "You're on the clock"
                : (context.currentDrafter ?? "Waiting")}
            </strong>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function WhatIf({
  recommendations,
  simulation,
  onAdd,
  onUndo,
  onReset,
}: {
  recommendations: Recommendation[];
  simulation: Array<{
    type: "draft" | "wait" | "remove";
    label: string;
    playerId?: string;
  }>;
  onAdd: (action: {
    type: "draft" | "wait" | "remove";
    label: string;
    playerId?: string;
  }) => void;
  onUndo: () => void;
  onReset: () => void;
}) {
  return (
    <details className="what-if" open={simulation.length > 0}>
      <summary>
        <span>
          <TimerReset aria-hidden="true" />
          <strong>What if I draft…</strong>
          <small>Explore roster and board impact locally</small>
        </span>
        <span>
          Never sends picks to Sleeper <ChevronDown aria-hidden="true" />
        </span>
      </summary>
      <div className="what-if__body">
        <div className="what-if__actions">
          <Button
            size="small"
            icon={<TimerReset />}
            onClick={() => onAdd({ type: "wait", label: "Wait one round" })}
          >
            Wait one round
          </Button>
          {recommendations.slice(0, 4).map((entry) => (
            <Button
              size="small"
              key={entry.player.id}
              onClick={() =>
                onAdd({
                  type: "draft",
                  playerId: entry.player.id,
                  label: `Explore ${entry.player.fullName}`,
                })
              }
            >
              {entry.player.fullName}
            </Button>
          ))}
          <Button
            size="small"
            variant="ghost"
            onClick={onUndo}
            disabled={simulation.length === 0}
          >
            Undo
          </Button>
          <Button
            size="small"
            variant="ghost"
            onClick={onReset}
            disabled={simulation.length === 0}
          >
            Reset
          </Button>
        </div>
        {simulation.length > 0 ? (
          <ol>
            {simulation.map((action, index) => (
              <li key={`${action.label}-${index}`}>
                <span>{index + 1}</span>
                <strong>{action.label}</strong>
                <small>
                  {action.type === "wait"
                    ? "Recalculate next-pick survival"
                    : "Recalculate roster fit and tier pressure"}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            Select a candidate to compare the local outcome without touching the
            live draft.
          </p>
        )}
      </div>
    </details>
  );
}

function WaitingState({
  context,
  recommendations,
}: {
  context: DraftContext;
  recommendations: Recommendation[];
}) {
  return (
    <aside className="draft-state-card draft-state-card--waiting">
      <Clock3 aria-hidden="true" />
      <div>
        <span className="section-label">Draft room ready</span>
        <h2>Waiting for Sleeper to start the draft</h2>
        <p>
          The player board and local scoring are ready. Live picks will follow
          this draft automatically.
        </p>
        <small>
          {sessionLabels[context.sessionKind]} · {recommendations.length}{" "}
          eligible players pre-ranked
        </small>
      </div>
    </aside>
  );
}

function CompletedState({
  context,
  picks,
}: {
  context: DraftContext;
  picks: number;
}) {
  return (
    <aside className="draft-state-card draft-state-card--complete">
      <Sparkles aria-hidden="true" />
      <div>
        <span className="section-label">Draft complete</span>
        <h2>{picks} picks safely synced</h2>
        <p>
          The final board remains available below. Not Sleeping never submitted
          or altered a Sleeper selection.
        </p>
        <small>
          {context.leagueName ?? context.draftName ?? "Sleeper draft"}
        </small>
      </div>
    </aside>
  );
}

function UnavailableState({
  demoEnabled,
  hasError,
  onReset,
  onRefresh,
}: {
  demoEnabled: boolean;
  hasError: boolean;
  onReset: () => void;
  onRefresh: () => void;
}) {
  return (
    <aside className="draft-state-card draft-state-card--warning">
      <AlertTriangle aria-hidden="true" />
      <div>
        <span className="section-label">Board unavailable</span>
        <h2>
          {hasError && !demoEnabled
            ? "Live draft unavailable"
            : hasError
              ? "Draft data needs a refresh"
              : "No eligible players remain"}
        </h2>
        <p>
          The app will not invent candidates or expose an unsafe provider error.
        </p>
      </div>
      <Button size="small" onClick={demoEnabled ? onReset : onRefresh}>
        {demoEnabled ? "Reset demo" : "Retry"}
      </Button>
    </aside>
  );
}

function formatPick(pick: number, teams: number): string {
  return `${Math.ceil(pick / teams)}.${String(((pick - 1) % teams) + 1).padStart(2, "0")}`;
}
