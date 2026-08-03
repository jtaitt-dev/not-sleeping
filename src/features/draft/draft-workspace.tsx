import {
  ArrowRight,
  Ban,
  ChevronRight,
  Clock3,
  Eye,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  TimerReset,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PositionBadge, StatusBadge, TierBadge } from "@/components/ui/badges";
import { RealtimeIntelligenceCard } from "@/components/intelligence/realtime-intelligence-card";
import { Button, IconButton } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import {
  getActiveFixture,
  getLiveRecommendations,
  getRecommendations,
  getVisiblePicks,
  useAppStore,
} from "@/stores/app-store";
import type { Recommendation, Strategy } from "@/types/domain";

import "./draft-workspace.css";

const strategyLabels: Record<Strategy, string> = {
  contender: "Win now",
  balanced: "Balanced",
  productive_struggle: "Productive struggle",
  rebuild: "Rebuild",
};

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
    toggleWatch,
    toggleHidden,
    addSimulation,
    undoSimulation,
    resetSimulation,
  } = useAppStore();
  const [activeTab, setActiveTab] = useState("recommendations");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
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
  const top = recommendations[0];
  const draftComplete = context.status === "complete";
  const visibleTab = draftComplete ? "recent" : activeTab;
  const picksUntil =
    (!demoEnabled && !liveState) || context.picksUntilUser === undefined
      ? undefined
      : Math.max(0, context.picksUntilUser - (demoEnabled ? draftStep : 0));

  return (
    <section className="draft-workspace">
      <div className="draft-control-strip" aria-label="Draft controls">
        <div className="on-clock">
          <span className="section-label">
            {draftComplete ? "Draft complete" : "On the clock"}
          </span>
          <strong className="tabular">
            {draftComplete
              ? `${picks.length} picks recorded`
              : !demoEnabled && !liveState
                ? "Sleeper refresh"
                : (context.currentDrafter ?? "Draft room")}
          </strong>
          <span>
            <Clock3 aria-hidden="true" />
            {draftComplete
              ? "Final board synced"
              : picksUntil === undefined
                ? context.status === "pre_draft"
                  ? "Waiting to start"
                  : "Manager slot not linked"
                : picksUntil === 0
                  ? "You are up"
                  : `${picksUntil} picks until you`}
          </span>
        </div>
        <label>
          <span>Strategy</span>
          <select
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as Strategy)}
          >
            {Object.entries(strategyLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="risk-control">
          <span>
            Risk tolerance <b>{Math.round(riskTolerance * 100)}%</b>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={riskTolerance}
            onChange={(event) => setRiskTolerance(Number(event.target.value))}
          />
        </label>
        {demoEnabled ? (
          <div className="demo-controls">
            <StatusBadge tone="info">Demo</StatusBadge>
            <IconButton
              label={demoPaused ? "Play demo draft" : "Pause demo draft"}
              onClick={() => setDemoPaused(!demoPaused)}
            >
              {demoPaused ? <Play /> : <Pause />}
            </IconButton>
            <select
              aria-label="Demo playback speed"
              value={demoSpeed}
              onChange={(event) => setDemoSpeed(Number(event.target.value))}
            >
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
            </select>
            <IconButton label="Reset demo" onClick={resetDemo}>
              <RotateCcw />
            </IconButton>
          </div>
        ) : (
          <StatusBadge
            tone={
              !liveState || liveState.playerIndexStale ? "warning" : "success"
            }
          >
            {!liveState
              ? "Retry needed"
              : liveState.playerIndexStale
                ? "Cached player index"
                : draftComplete
                  ? "Sleeper complete"
                  : "Sleeper live"}
          </StatusBadge>
        )}
      </div>

      {!draftComplete ? (
        <RealtimeIntelligenceCard
          feature={
            context.mode === "keeper"
              ? "keeper"
              : format.bestBall
                ? "best_ball"
                : "draft"
          }
          subject={context.draftId ?? "current-draft"}
          contextSummary={`${context.mode.replaceAll("_", " ")} draft. Pick ${context.currentPick}; ${format.teams} teams; ${format.superflex ? "superflex" : "single QB"}; ${format.tightEndPremium ? "TE premium" : "standard TE"}.`}
          candidates={recommendations.slice(0, 30).map((recommendation) => ({
            id: recommendation.player.id,
            label: recommendation.player.fullName,
            position: recommendation.player.position,
            ...(recommendation.player.team
              ? { team: recommendation.player.team }
              : {}),
            baseValue: recommendation.contextualScore,
            rosterFit:
              recommendation.rosterFit === "strong"
                ? 0.8
                : recommendation.rosterFit === "weak"
                  ? -0.5
                  : 0,
            scarcity: recommendation.scarcity,
            risk:
              recommendation.risk === "high"
                ? 0.85
                : recommendation.risk === "moderate"
                  ? 0.5
                  : 0.2,
            available: true,
            eligible: true,
            alreadySelected: picks.some(
              (pick) => pick.playerId === recommendation.player.id,
            ),
            reasons: recommendation.components
              .slice(0, 4)
              .map((component) => component.reason),
            metadata: {
              age: recommendation.player.age ?? null,
              yearsExperience: recommendation.player.yearsExperience ?? null,
            },
          }))}
          strategy={strategy}
          riskTolerance={riskTolerance}
          currentPick={context.currentPick}
          picksUntilNext={picksUntil}
        />
      ) : null}

      {!draftComplete && top ? (
        <TopRecommendation
          recommendation={top}
          isWatched={watchlist.includes(top.player.id)}
          onWatch={() => toggleWatch(top.player.id)}
          onDraft={() =>
            addSimulation({
              type: "draft",
              playerId: top.player.id,
              label: `Draft ${top.player.fullName}`,
            })
          }
        />
      ) : (
        <div className="surface draft-complete">
          <Sparkles aria-hidden="true" />
          <div>
            <h2>
              {context.status === "complete"
                ? "Draft complete"
                : !demoEnabled && !liveState
                  ? "Live draft unavailable"
                  : "Player board unavailable"}
            </h2>
            <p>
              {draftComplete
                ? `All ${picks.length} selections are synced. Review the final board under Recent picks.`
                : demoEnabled
                  ? "Every available player in this demo fixture has been selected."
                  : runtimeError
                    ? `${runtimeError.safeDetail} ${runtimeError.suggestedAction}`
                    : "Refresh the Sleeper player index to restore recommendations."}
            </p>
          </div>
          {demoEnabled ? (
            <Button size="small" onClick={resetDemo}>
              Reset draft
            </Button>
          ) : null}
        </div>
      )}

      <div className="draft-tabs-row">
        <CompactTabs
          label="Draft workspace"
          value={visibleTab}
          onValueChange={setActiveTab}
          items={
            draftComplete
              ? [{ value: "recent", label: `Recent picks (${picks.length})` }]
              : [
                  { value: "recommendations", label: "Recommendations" },
                  { value: "recent", label: `Recent picks (${picks.length})` },
                  { value: "simulator", label: "Simulator" },
                ]
          }
        />
      </div>

      {visibleTab === "recommendations" ? (
        <div className="recommendation-board">
          <div className="board-heading">
            <div>
              <span className="section-label">Available board</span>
              <h2>Best contextual fits</h2>
            </div>
            <span>Local score · live scarcity · next-pick odds</span>
          </div>
          <div className="player-table" aria-label="Draft recommendations">
            <div className="player-table-head">
              <span>Rank</span>
              <span>Player</span>
              <span>Score</span>
              <span>Next pick</span>
              <span className="sr-only">Actions</span>
            </div>
            {recommendations.slice(0, 12).map((recommendation) => (
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
                onDraft={() =>
                  addSimulation({
                    type: "draft",
                    playerId: recommendation.player.id,
                    label: `Draft ${recommendation.player.fullName}`,
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {visibleTab === "recent" ? (
        <div className="recent-picks-grid" aria-label="Recent draft picks">
          {picks
            .toReversed()
            .slice(0, 12)
            .map((pick) => (
              <article
                className="surface recent-pick"
                key={`${pick.pickNumber}-${pick.playerId}`}
              >
                <span className="tabular">
                  {pick.round}.{String(pick.pickInRound).padStart(2, "0")}
                </span>
                <PositionBadge position={pick.position} />
                <div>
                  <strong>{pick.playerName}</strong>
                  <small>{pick.pickedBy ?? "Unknown team"}</small>
                </div>
                {pick.isUserPick ? (
                  <StatusBadge tone="info">You</StatusBadge>
                ) : null}
              </article>
            ))}
        </div>
      ) : null}

      {visibleTab === "simulator" ? (
        <div className="surface simulator-panel">
          <header>
            <div>
              <span className="section-label">Decision simulator</span>
              <h2>Explore without changing the live board</h2>
            </div>
            <div>
              <Button
                size="small"
                variant="ghost"
                onClick={undoSimulation}
                disabled={simulation.length === 0}
              >
                Undo
              </Button>
              <Button
                size="small"
                variant="ghost"
                onClick={resetSimulation}
                disabled={simulation.length === 0}
              >
                Reset
              </Button>
            </div>
          </header>
          <div className="simulation-actions">
            <Button
              size="small"
              icon={<TimerReset />}
              onClick={() =>
                addSimulation({ type: "wait", label: "Wait one round" })
              }
            >
              Wait one round
            </Button>
            {recommendations.slice(0, 3).map((entry) => (
              <Button
                size="small"
                key={entry.player.id}
                onClick={() =>
                  addSimulation({
                    type: "draft",
                    playerId: entry.player.id,
                    label: `Draft ${entry.player.fullName}`,
                  })
                }
              >
                {entry.player.fullName}
              </Button>
            ))}
          </div>
          {simulation.length ? (
            <ol className="simulation-path">
              {simulation.map((action, index) => (
                <li key={`${action.label}-${index}`}>
                  <span>{index + 1}</span>
                  <strong>{action.label}</strong>
                  <ArrowRight aria-hidden="true" />
                  <small>
                    {action.type === "wait"
                      ? "Recalculate availability"
                      : "Recalculate roster fit"}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="simulator-empty">
              Select a player or wait a round to compare possible outcomes.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function TopRecommendation({
  recommendation,
  isWatched,
  onWatch,
  onDraft,
}: {
  recommendation: Recommendation;
  isWatched: boolean;
  onWatch: () => void;
  onDraft: () => void;
}) {
  const { player } = recommendation;
  return (
    <article className="top-recommendation">
      <div className="top-recommendation__eyebrow">
        <span>
          <Sparkles aria-hidden="true" />
          Best available for your build
        </span>
        <StatusBadge
          tone={recommendation.risk === "high" ? "warning" : "success"}
        >
          {Math.round(recommendation.confidence * 100)}% confidence
        </StatusBadge>
      </div>
      <div className="top-recommendation__body">
        <PlayerAvatar player={player} size="large" />
        <div className="top-recommendation__identity">
          <div>
            <h1>{player.fullName}</h1>
            <PositionBadge position={player.position} />
            <TierBadge tier={recommendation.tier} />
          </div>
          <p>{recommendation.rationale}</p>
          <div className="reason-chips">
            <span>
              <Target aria-hidden="true" />
              {recommendation.rosterFit} roster fit
            </span>
            <span>
              <Gauge aria-hidden="true" />
              {recommendation.scarcity > 4 ? "Scarce tier" : "Stable tier"}
            </span>
          </div>
        </div>
        <dl className="recommendation-metrics">
          <div>
            <dt>Score</dt>
            <dd>{recommendation.contextualScore}</dd>
          </div>
          <div>
            <dt>At next pick</dt>
            <dd>{recommendation.nextPickAvailability}%</dd>
          </div>
          <div>
            <dt>VOR</dt>
            <dd>
              {recommendation.valueOverReplacement > 0 ? "+" : ""}
              {recommendation.valueOverReplacement}
            </dd>
          </div>
        </dl>
      </div>
      <footer>
        <Button
          size="small"
          variant={isWatched ? "secondary" : "ghost"}
          icon={<Star />}
          onClick={onWatch}
          aria-pressed={isWatched}
        >
          {isWatched ? "Watching" : "Watch"}
        </Button>
        <Button
          size="small"
          variant="primary"
          icon={<ArrowRight />}
          onClick={onDraft}
        >
          Simulate pick
        </Button>
      </footer>
    </article>
  );
}

function RecommendationRow({
  recommendation,
  expanded,
  watched,
  onExpand,
  onWatch,
  onHide,
  onDraft,
}: {
  recommendation: Recommendation;
  expanded: boolean;
  watched: boolean;
  onExpand: () => void;
  onWatch: () => void;
  onHide: () => void;
  onDraft: () => void;
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
              {player.team ?? "FA"} · age {player.age?.toFixed(1) ?? "—"}
            </small>
          </span>
          <PositionBadge position={player.position} />
        </span>
        <span className="score-cell tabular">
          <b>{recommendation.contextualScore}</b>
          <small>Tier {recommendation.tier}</small>
        </span>
        <span className="availability-cell">
          <b className="tabular">{recommendation.nextPickAvailability}%</b>
          <span>
            <i style={{ width: `${recommendation.nextPickAvailability}%` }} />
          </span>
        </span>
      </button>
      <div className="row-actions">
        <IconButton
          label={watched ? "Remove from watchlist" : "Add to watchlist"}
          active={watched}
          onClick={onWatch}
        >
          <Star />
        </IconButton>
        <IconButton label={`Hide ${player.fullName}`} onClick={onHide}>
          <Ban />
        </IconButton>
      </div>
      {expanded ? (
        <div className="recommendation-detail">
          <div>
            <strong>Why this rank</strong>
            <ul>
              {recommendation.components.slice(1, 4).map((component) => (
                <li key={component.key}>
                  <span>{component.label}</span>
                  <b className={component.value >= 0 ? "positive" : "negative"}>
                    {component.value >= 0 ? "+" : ""}
                    {component.value}
                  </b>
                  <small>{component.reason}</small>
                </li>
              ))}
            </ul>
          </div>
          <div className="detail-actions">
            <Button size="small" icon={<Eye />}>
              Player view
            </Button>
            <Button size="small" variant="primary" onClick={onDraft}>
              Simulate
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
