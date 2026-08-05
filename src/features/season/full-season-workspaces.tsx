import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CloudRain,
  ExternalLink,
  FileSearch,
  Gauge,
  GitCompareArrows,
  Lock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/badges";
import { RealtimeIntelligenceCard } from "@/components/intelligence/realtime-intelligence-card";
import { Button, IconButton } from "@/components/ui/button";
import { PositionBadge } from "@/components/ui/badges";
import { EmptyState, InlineError } from "@/components/ui/states";
import type { AiFeature, Player } from "@/types/domain";
import type { DecisionCandidate } from "@/services/intelligence/types";
import type { EvidenceItem, LeagueContext } from "@/types/league";
import {
  analyzeDispersalPool,
  analyzeOrphanRoster,
  calculateDynastyDirection,
  type DynastyScenarioAsset,
} from "@/services/dynasty/dynasty-service";
import {
  MockDraftSession,
  assertDraftInvariants,
  ownerForPick,
  type DraftEngineConfig,
  type DraftEnginePlayer,
  type DraftEngineState,
} from "@/services/draft/draft-engine";
import { runDynamicModel } from "@/services/models/dynamic-model";
import {
  projectMatchup,
  type MatchupTeamInput,
} from "@/services/matchups/matchup-model";
import { calculateFantasyScore } from "@/services/scoring/scoring-engine";
import { projectIdpPlayer } from "@/services/idp/idp-service";
import {
  buildRookieProfile,
  compareRookiePickScenarios,
} from "@/services/rookies/rookie-service";
import {
  analyzeChoppedLeague,
  type ChoppedTeamInput,
} from "@/services/chopped/chopped-service";
import {
  buildStartSitPlan,
  lateNewsAction,
  type StartSitPlayer,
} from "@/services/start-sit/start-sit-service";
import { recommendTaxi } from "@/services/taxi/taxi-service";
import {
  analyzeTrade,
  calibrateLeagueTradeMarket,
  findTradeTargets,
  type TradeAsset,
} from "@/services/trades/trade-service";
import {
  buildAuctionRoomPlan,
  recommendAuctionBid,
} from "@/services/auction/auction-service";
import {
  recommendWaiver,
  type DropCandidate,
  type WaiverPlayer,
} from "@/services/waivers/waiver-service";
import {
  requestRuntime,
  safeRuntimeError,
} from "@/services/messaging/runtime-client";
import { useLeagueStore, type LeagueSnapshot } from "@/stores/league-store";

import "./full-season-workspaces.css";

type DecisionTone = "success" | "warning" | "danger" | "info" | "neutral";

type DecisionView = {
  id: string;
  title: string;
  decision: string;
  confidence: number;
  deadline: string;
  freshness: string;
  factor: string;
  pending: string;
  sources: number;
  action: string;
  tone: DecisionTone;
};

export function TodayWorkspace() {
  const { context, snapshot, status } = useLeagueData();
  const [selected, setSelected] = useState<string | null>(null);
  if (!context) return <NoLeagueWorkspace title="Today" />;
  const decisions = todayDecisions(context, snapshot);
  const active = decisions.find((decision) => decision.id === selected) ?? null;
  return (
    <SeasonWorkspace
      title="Today"
      subtitle="Urgent decisions across this league, ordered by deadline."
      action={
        status === "switching" ? (
          <StatusBadge tone="warning">Switching · cached view</StatusBadge>
        ) : null
      }
    >
      <section className="today-summary" aria-label="Today summary">
        <div>
          <strong>{decisions.length}</strong>
          <span>open decisions</span>
        </div>
        <div>
          <strong>
            {
              decisions.filter(
                (decision) =>
                  decision.tone === "danger" || decision.tone === "warning",
              ).length
            }
          </strong>
          <span>need attention</span>
        </div>
        <div>
          <strong>Week {context.week}</strong>
          <span>{context.lineupType.replace("_", " ")}</span>
        </div>
      </section>
      <div className="decision-rail">
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            selected={selected === decision.id}
            onSelect={() =>
              setSelected(selected === decision.id ? null : decision.id)
            }
          />
        ))}
      </div>
      {active ? (
        <EvidenceDrawer
          context={context}
          decision={active}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </SeasonWorkspace>
  );
}

export function LeaguesWorkspace() {
  const catalog = useLeagueStore((state) => state.catalog);
  const active = useLeagueStore((state) => state.activeContext);
  const selectLeague = useLeagueStore((state) => state.selectLeague);
  const favoriteLeague = useLeagueStore((state) => state.favoriteLeague);
  return (
    <SeasonWorkspace
      title="Leagues"
      subtitle="All current Sleeper NFL leagues, grouped by season."
    >
      <div className="league-directory">
        {catalog.map((league) => (
          <article
            className="surface league-directory-row"
            data-active={league.leagueId === active?.leagueId}
            key={league.leagueId}
          >
            <button
              type="button"
              onClick={() => void selectLeague(league.leagueId)}
            >
              <span className="league-directory-avatar">
                {initials(league.name)}
              </span>
              <span>
                <strong>{league.name}</strong>
                <small>
                  {league.season} · {league.leagueType} ·{" "}
                  {league.lineupType.replace("_", " ")} · ID{" "}
                  {league.leagueId.slice(-6)}
                </small>
              </span>
              <ChevronRight />
            </button>
            <IconButton
              label={`${league.favorite ? "Unfavorite" : "Favorite"} ${league.name}`}
              onClick={() =>
                void favoriteLeague(league.leagueId, !league.favorite)
              }
            >
              <Star data-filled={league.favorite} />
            </IconButton>
          </article>
        ))}
      </div>
    </SeasonWorkspace>
  );
}

export function StartSitWorkspace() {
  const { context, snapshot } = useLeagueData();
  const [strategy, setStrategy] = useState<"floor" | "balanced" | "ceiling">(
    "balanced",
  );
  const [excluded, setExcluded] = useState<string[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  if (!context || !snapshot) return <NoLeagueWorkspace title="Start & Sit" />;
  const players = buildRosterDecisionPlayers(context, snapshot, locked);
  const plan = buildStartSitPlan({
    context,
    players,
    strategy,
    excludedPlayerIds: excluded,
  });
  return (
    <SeasonWorkspace
      title={
        context.lineupType === "best_ball"
          ? "Best Ball Optimizer"
          : "Start & Sit"
      }
      subtitle={plan.summary}
      action={
        <StatusBadge tone={plan.emptySlots.length > 0 ? "warning" : "success"}>
          {plan.emptySlots.length > 0
            ? `${plan.emptySlots.length} empty`
            : "Legal lineup"}
        </StatusBadge>
      }
    >
      <div
        className="strategy-control"
        role="group"
        aria-label="Lineup strategy"
      >
        {(["floor", "balanced", "ceiling"] as const).map((value) => (
          <button
            type="button"
            data-active={strategy === value}
            key={value}
            onClick={() => setStrategy(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <section className="surface lineup-board">
        <header>
          <span>Slot</span>
          <span>
            {context.lineupType === "best_ball"
              ? "Optimal scorer model"
              : "Starter"}
          </span>
          <span>Projection</span>
          <span>
            {context.lineupType === "best_ball" ? "Status" : "Actions"}
          </span>
        </header>
        {plan.assignments
          .filter((assignment) => assignment.playerId)
          .map((assignment) => {
            const player = players.find(
              (candidate) => candidate.playerId === assignment.playerId,
            );
            return (
              <div className="lineup-row" key={assignment.slotIndex}>
                <PositionBadge
                  position={assignment.slot as Player["position"]}
                />
                <span>
                  <strong>{player?.name ?? "Empty slot"}</strong>
                  <small>
                    {player
                      ? `${Math.round(player.model.confidence * 100)}% confidence · ${lateNewsAction(player)}`
                      : "No legal assignment"}
                  </small>
                </span>
                <strong className="tabular">
                  {player ? player.model.expectedPoints.toFixed(1) : "—"}
                </strong>
                <span className="row-actions">
                  {player && context.lineupType === "classic" ? (
                    <>
                      <IconButton
                        label={`${locked.includes(player.playerId) ? "Unlock" : "Lock"} ${player.name}`}
                        onClick={() =>
                          setLocked(toggleId(locked, player.playerId))
                        }
                      >
                        <Lock data-active={locked.includes(player.playerId)} />
                      </IconButton>
                      <IconButton
                        label={`Exclude ${player.name}`}
                        onClick={() =>
                          setExcluded(toggleId(excluded, player.playerId))
                        }
                      >
                        <X />
                      </IconButton>
                    </>
                  ) : context.lineupType === "best_ball" ? (
                    <small>No manual move</small>
                  ) : null}
                </span>
              </div>
            );
          })}
        {plan.emptySlots.length > 0 ? (
          // One collective state, not the same row repeated until it fills the
          // panel: the empty case was the default case and read as the screen.
          <div className="lineup-empty">
            <strong>
              {plan.emptySlots.length} of {plan.assignments.length} slots have
              no legal assignment
            </strong>
            <p>
              Add eligible players, or clear an exclusion, to fill these. Every
              slot below still needs a starter.
            </p>
            <ul aria-label="Slots with no legal assignment">
              {plan.assignments
                .filter((assignment) => !assignment.playerId)
                .map((assignment) => (
                  <li key={assignment.slotIndex}>
                    <PositionBadge
                      position={assignment.slot as Player["position"]}
                    />
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>
      {context.lineupType === "best_ball" ? (
        <section className="planning-grid">
          <PlanningPanel
            title="Roster construction"
            rows={[
              `${players.length} active scoring candidates across ${new Set(players.flatMap((player) => player.positions)).size} positions`,
              `${players.filter((player) => player.model.ceiling - player.model.floor >= 8).length} high-volatility ceiling options`,
              "Sleeper selects the highest-scoring legal lineup after games",
            ]}
          />
          <PlanningPanel
            title="Resilience"
            rows={[
              `${players.filter((player) => player.inactive === true || player.model.availabilityProbability < 0.8).length} availability risks`,
              `${plan.emptySlots.length} legal construction gap${plan.emptySlots.length === 1 ? "" : "s"}`,
              context.waiverType === "disabled"
                ? "Waivers are disabled"
                : `${context.waiverType.replaceAll("_", " ")} roster improvements available`,
            ]}
          />
          <PlanningPanel
            title="Ceiling & correlation"
            rows={[
              "Prefer complementary weekly ceilings over manual matchup chasing",
              "Review QB pass-catcher stacks and correlated bye exposure",
              "Recheck playoff-week construction as schedules become current",
            ]}
          />
        </section>
      ) : null}
      {context.lineupType === "classic" ? (
        <section className="recommendation-list">
          <h2>Decisions</h2>
          {plan.recommendations.slice(0, 6).map((recommendation) => {
            const starter = players.find(
              (player) => player.playerId === recommendation.startPlayerId,
            );
            return (
              <article
                className="surface recommendation-row"
                key={`${recommendation.slot}:${recommendation.startPlayerId}`}
              >
                <div>
                  <PositionBadge
                    position={recommendation.slot as Player["position"]}
                  />
                  <span>
                    <strong>
                      Start {starter?.name ?? recommendation.startPlayerId}
                    </strong>
                    <small>
                      {recommendation.status.replaceAll("_", " ")} · refreshed
                      now
                    </small>
                  </span>
                </div>
                <span className="recommendation-edge">
                  {recommendation.projectedAdvantage >= 0 ? "+" : ""}
                  {recommendation.projectedAdvantage.toFixed(1)}
                </span>
                <p>
                  {recommendation.keyFactors[0]?.explanation ??
                    "Projection and legal-slot fit favor this assignment."}
                </p>
                <footer>
                  <span>
                    {Math.round(recommendation.confidence * 100)}% confidence
                  </span>
                  <span>{recommendation.pendingNews.length} pending</span>
                  <span>{recommendation.citations.length} sources</span>
                  <span>Set manually in Sleeper</span>
                </footer>
              </article>
            );
          })}
        </section>
      ) : (
        <BestBallNotice context={context} />
      )}
    </SeasonWorkspace>
  );
}

export function MatchupCenterWorkspace() {
  const { context, snapshot } = useLeagueData();
  if (!context || !snapshot)
    return <NoLeagueWorkspace title="Matchup Center" />;
  const user = snapshot.matchups.find(
    (matchup) => matchup.roster_id === context.rosterId,
  );
  const opponent =
    user?.matchup_id === null || user?.matchup_id === undefined
      ? null
      : snapshot.matchups.find(
          (matchup) =>
            matchup.matchup_id === user.matchup_id &&
            matchup.roster_id !== user.roster_id,
        );
  const userName = teamName(snapshot, context.rosterId);
  const opponentName = teamName(snapshot, opponent?.roster_id ?? null);
  const model = projectMatchup({
    user: matchupTeamInput(snapshot, user, userName, context.rosterId ?? 0),
    opponent: opponent
      ? matchupTeamInput(snapshot, opponent, opponentName, opponent.roster_id)
      : null,
    leagueTeams: snapshot.matchups.map((matchup) =>
      matchupTeamInput(
        snapshot,
        matchup,
        teamName(snapshot, matchup.roster_id),
        matchup.roster_id,
      ),
    ),
  });
  return (
    <SeasonWorkspace
      title="Matchup Center"
      subtitle={`Week ${context.week} · live Sleeper scoring and lineup state.`}
    >
      <section className="surface matchup-scoreboard">
        <TeamScore name={userName} score={resolvedPoints(user)} label="You" />
        <div>
          <span>vs</span>
          <strong>
            {context.settings["league_average_match"]
              ? "H2H + median"
              : "Head-to-head"}
          </strong>
        </div>
        <TeamScore
          name={opponentName}
          score={resolvedPoints(opponent)}
          label={opponent ? "Opponent" : "No opponent"}
        />
      </section>
      <section className="matchup-columns">
        <MatchupRoster title="Your lineup" matchup={user} snapshot={snapshot} />
        <MatchupRoster
          title="Opponent"
          matchup={opponent}
          snapshot={snapshot}
        />
      </section>
      <section className="auction-values">
        <ValueTile
          label="Projected final"
          value={model.user.projectedFinal.toFixed(1)}
        />
        <ValueTile
          label="Floor–ceiling"
          value={`${model.user.floor.toFixed(1)}–${model.user.ceiling.toFixed(1)}`}
        />
        <ValueTile
          label="H2H win"
          value={probabilityLabel(model.headToHeadWinProbability)}
        />
        <ValueTile
          label="Beat median"
          value={probabilityLabel(model.leagueMedianWinProbability)}
        />
      </section>
      <section className="matchup-columns">
        <div className="surface matchup-factors">
          <h2>Position comparison</h2>
          {model.positionComparisons.map((comparison) => (
            <div key={comparison.position}>
              <PositionBadge
                position={comparison.position as Player["position"]}
              />
              <span>
                You {comparison.user.toFixed(1)} · opponent{" "}
                {comparison.opponent.toFixed(1)}
              </span>
              <strong>
                {comparison.edge >= 0 ? "+" : ""}
                {comparison.edge.toFixed(1)}
              </strong>
            </div>
          ))}
        </div>
        <div className="surface matchup-factors">
          <h2>Biggest swing players</h2>
          {model.biggestSwingPlayers.map((player) => (
            <div key={player.playerId}>
              <Gauge aria-hidden="true" />
              <span>{player.name}</span>
              <strong>±{player.swing.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </section>
      {model.fragileAssumptions.map((assumption) => (
        <div className="surface warning-strip" key={assumption}>
          <AlertTriangle />
          {assumption}
        </div>
      ))}
      <section className="surface context-strip">
        <Insight
          icon={<Gauge />}
          label="Median model"
          value={
            context.settings["league_average_match"] ? "Enabled" : "Disabled"
          }
        />
        <Insight
          icon={<CloudRain />}
          label="Weather"
          value="Stadium forecast pending kickoff resolution"
        />
        <Insight
          icon={<Users />}
          label="Remaining / locked"
          value={`${model.user.remainingPlayers} / ${model.user.lockedPlayers}`}
        />
        <Insight
          icon={<GitCompareArrows />}
          label="Correlation"
          value={`${model.user.correlationPairs} QB stack pairs`}
        />
        <Insight
          icon={<AlertTriangle />}
          label="Injury exposure"
          value={`${model.user.injuryExposure} flagged starters`}
        />
        <Insight
          icon={<RefreshCw />}
          label="Freshness"
          value={freshnessLabel(snapshot.fetchedAt)}
        />
      </section>
    </SeasonWorkspace>
  );
}

export function ChoppedSurvivalWorkspace() {
  const { context, snapshot } = useLeagueData();
  if (!context || !snapshot)
    return <NoLeagueWorkspace title="Chopped Survival" />;

  const startingBudget = numericSetting(context.settings, "waiver_budget", 100);
  const teams = choppedTeamInputs(snapshot, startingBudget);
  const eliminatedIds = new Set(
    snapshot.rosters
      .filter(isEliminatedRoster)
      .map((roster) => roster.roster_id),
  );
  const releasedIds = new Set(
    snapshot.transactions.flatMap((transaction) =>
      transaction.status === "complete" &&
      transaction.roster_ids.some((id) => eliminatedIds.has(id))
        ? Object.keys(transaction.drops ?? {})
        : [],
    ),
  );
  const analysis = analyzeChoppedLeague({
    teams,
    userRosterId: context.rosterId,
    tradesEnabled: numericSetting(context.settings, "disable_trades", 0) !== 1,
    bestBall: context.lineupType === "best_ball",
    tiebreaker: context.eliminationTiebreaker,
    releasedPlayers: snapshot.players
      .filter((player) => releasedIds.has(player.id))
      .map((player) => ({
        playerId: player.id,
        name: player.fullName,
        position: player.position,
        value: proxyPlayerValue(player),
      })),
  });
  const enabled = context.weeklyElimination;

  return (
    <SeasonWorkspace
      title="Chopped Survival"
      subtitle="Weekly chop-zone odds, every remaining roster, remaining-player ranges, and survival-aware FAAB planning."
      action={
        <StatusBadge tone={enabled ? "success" : "warning"}>
          {enabled ? "Weekly elimination active" : "Manual override required"}
        </StatusBadge>
      }
    >
      {!enabled ? (
        <div className="surface warning-strip">
          <AlertTriangle aria-hidden="true" />
          Sleeper does not expose a weekly-elimination flag for this league.
          Enable the per-league override in Settings only if the commissioner
          rules confirm it.
        </div>
      ) : null}
      <section className="auction-values">
        <ValueTile
          label="Survival probability"
          value={probabilityLabel(analysis.user?.survivalProbability ?? null)}
        />
        <ValueTile
          label="Probability of last"
          value={probabilityLabel(analysis.user?.probabilityLast ?? null)}
        />
        <ValueTile
          label="Distance from safety"
          value={`${analysis.user?.distanceFromSafety.toFixed(1) ?? "—"} pts`}
        />
        <ValueTile
          label="Current chop zone"
          value={analysis.chopZone?.name ?? "Not available"}
        />
      </section>
      <section className="surface survival-guidance">
        <header>
          <div>
            <h2>{analysis.lineupApproach.replaceAll("_", " ")}</h2>
            <p>{analysis.faabRecommendation}</p>
          </div>
          <StatusBadge
            tone={
              (analysis.user?.probabilityLast ?? 0) >= 0.3
                ? "danger"
                : "success"
            }
          >
            Future releases {analysis.expectedFutureReleaseQuality}
          </StatusBadge>
        </header>
        <p>{analysis.tradeMessage}</p>
        <p>{analysis.tiebreakerMessage}</p>
        {analysis.bestBallMessage ? <p>{analysis.bestBallMessage}</p> : null}
        {analysis.warnings.map((warning) => (
          <p className="warning-copy" key={warning}>
            {warning}
          </p>
        ))}
      </section>
      <section className="surface survival-table">
        <header>
          <span>Live rank</span>
          <span>Remaining team</span>
          <span>Projected range</span>
          <span>Last / survive</span>
          <span>Impact</span>
        </header>
        {analysis.teams.map((team) => (
          <div
            key={team.rosterId}
            data-chop-zone={team.rosterId === analysis.chopZone?.rosterId}
          >
            <strong>#{team.rank}</strong>
            <span>
              <strong>{team.name}</strong>
              <small>
                {team.lockedPoints.toFixed(1)} locked · {team.faabRemaining}{" "}
                FAAB
              </small>
            </span>
            <span>
              {team.floor.toFixed(1)}–{team.ceiling.toFixed(1)}
            </span>
            <span>
              {probabilityLabel(team.probabilityLast)} /{" "}
              {probabilityLabel(team.survivalProbability)}
            </span>
            <span>
              {team.projectedRemaining.toFixed(1)} remaining ·{" "}
              {team.injuryExposure} injury flags
            </span>
          </div>
        ))}
      </section>
      <section className="surface planning-panel">
        <h2>Eliminated-roster release watch</h2>
        {analysis.releasedPlayerTargets.length ? (
          <ul>
            {analysis.releasedPlayerTargets.map((player) => (
              <li key={player.playerId}>
                <ArrowRight aria-hidden="true" />
                {player.name} · {player.position} · modeled value{" "}
                {player.value.toFixed(0)}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No completed eliminated-roster drops are identifiable in the current
            Sleeper transaction snapshot.
          </p>
        )}
      </section>
    </SeasonWorkspace>
  );
}

export function WaiverWireWorkspace() {
  const { context, snapshot } = useLeagueData();
  const { rows, loading, error, reload } = useTrendingPlayers("add", 40);
  if (!context || !snapshot) return <NoLeagueWorkspace title="Waiver Wire" />;
  const rostered = new Set(
    snapshot.rosters.flatMap((roster) => roster.players ?? []),
  );
  const available = rows.filter((row) => !rostered.has(row.player.id));
  const roster = userRosterPlayers(context, snapshot).map(toDropCandidate);
  return (
    <SeasonWorkspace
      title="Waiver Wire"
      subtitle={`${context.waiverType.replaceAll("_", " ")} · recommendations adapt to league rules and live rosters.`}
      action={
        <Button
          size="small"
          icon={<RefreshCw />}
          onClick={reload}
          disabled={loading}
        >
          Refresh
        </Button>
      }
    >
      {error ? (
        <InlineError title="Trending data unavailable" detail={error} />
      ) : null}
      <section className="waiver-list">
        {available.slice(0, 16).map(({ player, count }, index) => {
          const candidate = toWaiverPlayer(player, index);
          const startingBudget = numericSetting(
            context.settings,
            "waiver_budget",
            100,
          );
          const recommendation = recommendWaiver({
            context,
            player: candidate,
            roster,
            budget: currentFaab(snapshot, context.rosterId, startingBudget),
            startingBudget,
            otherBudgets: snapshot.rosters
              .filter((entry) => entry.roster_id !== context.rosterId)
              .map((entry) =>
                currentFaab(snapshot, entry.roster_id, startingBudget),
              ),
            historicalWinningBids: snapshot.transactions.flatMap(
              (transaction) => {
                const bid = numericSetting(
                  transaction.settings,
                  "waiver_bid",
                  -1,
                );
                return transaction.status === "complete" && bid >= 0
                  ? [bid]
                  : [];
              },
            ),
            leagueSize: snapshot.rosters.length,
            positionNeed: 0.55,
            positionScarcity: scarcityFor(player.position),
            urgency: context.week <= 4 ? 0.7 : 0.5,
            zeroDollarAllowed:
              numericSetting(context.settings, "waiver_bid_min", 0) === 0,
          });
          return (
            <article className="surface waiver-row" key={player.id}>
              <span className="waiver-rank">{index + 1}</span>
              <div className="player-identity">
                <PositionBadge position={player.position} />
                <span>
                  <strong>{player.fullName}</strong>
                  <small>
                    {player.team ?? "FA"} · {count.toLocaleString()} trending
                    adds
                  </small>
                </span>
              </div>
              {recommendation.faab ? (
                <FaabBand faab={recommendation.faab} />
              ) : (
                <StatusBadge tone="info">
                  {recommendation.action.replace("_", " ")}
                </StatusBadge>
              )}
              <footer>
                <span>
                  Drop:{" "}
                  {roster.find(
                    (entry) =>
                      entry.playerId === recommendation.dropCandidateId,
                  )?.name ?? "No legal drop"}
                </span>
                <span>
                  Fits your roster {Math.round(recommendation.rosterFit * 100)}%
                  · priority {recommendation.addPriority.toFixed(0)} of 100
                </span>
                <span>Manual claim only</span>
              </footer>
            </article>
          );
        })}
        {loading ? (
          <p className="loading-copy">
            Loading league-available trending players…
          </p>
        ) : null}
      </section>
    </SeasonWorkspace>
  );
}

export function TradeCenterWorkspace() {
  const { context, snapshot } = useLeagueData();
  const [sendIds, setSendIds] = useState<string[]>([]);
  const [receiveIds, setReceiveIds] = useState<string[]>([]);
  const [partnerRosterId, setPartnerRosterId] = useState<number | null>(null);
  if (!context || !snapshot) return <NoLeagueWorkspace title="Trade Center" />;
  const rosterPlayers = userRosterPlayers(context, snapshot);
  const playerById = new Map(
    snapshot.players.map((player) => [player.id, player]),
  );
  const opponentRosters = snapshot.rosters.filter(
    (roster) => roster.roster_id !== context.rosterId,
  );
  const selectedPartner =
    opponentRosters.find((roster) => roster.roster_id === partnerRosterId) ??
    opponentRosters[0];
  const opponentPlayers = (selectedPartner?.players ?? []).flatMap(
    (playerId) => {
      const player = playerById.get(playerId);
      return player ? [player] : [];
    },
  );
  const send = rosterPlayers
    .filter((player) => sendIds.includes(player.id))
    .map(toTradeAsset);
  const receive = opponentPlayers
    .filter((player) => receiveIds.includes(player.id))
    .map(toTradeAsset);
  const analysis = analyzeTrade({
    context,
    parties: [
      {
        rosterId: context.rosterId ?? 0,
        teamName: "Your roster",
        sends: send,
        receives: receive,
        beforeStarterPoints: 100,
        afterStarterPoints:
          100 + assetProduction(receive) - assetProduction(send),
        beforeDepth: rosterPlayers.length,
        afterDepth: rosterPlayers.length - send.length + receive.length,
        rosterSpotsAfter: 1 + send.length - receive.length,
      },
      {
        rosterId: selectedPartner?.roster_id ?? -1,
        teamName: teamName(snapshot, selectedPartner?.roster_id ?? null),
        sends: receive,
        receives: send,
        beforeStarterPoints: 100,
        afterStarterPoints:
          100 + assetProduction(send) - assetProduction(receive),
        beforeDepth: opponentPlayers.length,
        afterDepth: opponentPlayers.length - receive.length + send.length,
        rosterSpotsAfter: 1 + receive.length - send.length,
      },
    ],
    positionalScarcity: {
      QB: context.rosterPositions.includes("SUPER_FLEX") ? 0.9 : 0.3,
      TE: 0.45,
    },
  });
  const tradeTargets = findTradeTargets({
    context,
    user: {
      rosterId: context.rosterId ?? 0,
      teamName: "Your roster",
      assets: rosterPlayers.map(toTradeAsset),
    },
    opponents: opponentRosters.map((roster) => ({
      rosterId: roster.roster_id,
      teamName: teamName(snapshot, roster.roster_id),
      assets: (roster.players ?? []).flatMap((playerId) => {
        const player = playerById.get(playerId);
        return player ? [toTradeAsset(player)] : [];
      }),
    })),
  });
  const market = calibrateLeagueTradeMarket(snapshot.transactions);
  return (
    <SeasonWorkspace
      title="Trade Center"
      subtitle="League-, roster-, strategy-, and roster-space-aware analysis. No offer is sent."
    >
      <section className="surface trade-market-strip">
        <label>
          Trade partner
          <select
            value={selectedPartner?.roster_id ?? ""}
            onChange={(event) => {
              setPartnerRosterId(Number(event.target.value));
              setReceiveIds([]);
            }}
          >
            {opponentRosters.map((roster) => (
              <option key={roster.roster_id} value={roster.roster_id}>
                {teamName(snapshot, roster.roster_id)}
              </option>
            ))}
          </select>
        </label>
        <span>
          <small>League market</small>
          <strong>{market.activity.replace("_", " ")}</strong>
        </span>
        <span>
          <small>Completed sample</small>
          <strong>{market.completedTrades}</strong>
        </span>
        <span>
          <small>Typical assets</small>
          <strong>{market.typicalAssetCount ?? "Insufficient"}</strong>
        </span>
      </section>
      <div className="trade-builder">
        <AssetPicker
          title="You send"
          players={rosterPlayers}
          selected={sendIds}
          onToggle={(id) => setSendIds(toggleId(sendIds, id))}
        />
        <AssetPicker
          title="You receive"
          players={opponentPlayers.slice(0, 40)}
          selected={receiveIds}
          onToggle={(id) => setReceiveIds(toggleId(receiveIds, id))}
        />
      </div>
      <section className="surface trade-verdict">
        <header>
          <span>
            <GitCompareArrows />
            <strong>{analysis.fairness}</strong>
          </span>
          <StatusBadge
            tone={
              analysis.fairness === "balanced"
                ? "success"
                : analysis.fairness === "negotiable"
                  ? "warning"
                  : "danger"
            }
          >
            {Math.round(analysis.fairnessGap * 100)}% gap
          </StatusBadge>
        </header>
        <div>
          {analysis.parties.map((party) => (
            <div key={party.rosterId}>
              <small>{party.teamName}</small>
              <strong>
                {party.netValue >= 0 ? "+" : ""}
                {party.netValue.toFixed(1)}
              </strong>
              <span>
                {party.weeklyPointsChange >= 0 ? "+" : ""}
                {party.weeklyPointsChange.toFixed(1)} weekly pts
              </span>
            </div>
          ))}
        </div>
        <ul>
          {analysis.conditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
        <footer>
          <ShieldCheck />
          {analysis.noWriteBoundary}
        </footer>
      </section>
      <section className="trade-finder">
        <header>
          <h2>Trade finder</h2>
          <span>Modeled suggestions only · never sent</span>
        </header>
        {tradeTargets.length ? (
          tradeTargets.map((target) => (
            <article className="surface" key={target.partnerRosterId}>
              <header>
                <strong>{target.partnerName}</strong>
                <StatusBadge tone="info">
                  {Math.round(target.fairnessGap * 100)}% gap
                </StatusBadge>
              </header>
              <p>
                Send <b>{target.send.map((asset) => asset.label).join(", ")}</b>
                {" · "}Receive{" "}
                <b>{target.receive.map((asset) => asset.label).join(", ")}</b>
              </p>
              <ul>
                {target.whyBothMayAccept.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <small>{target.alternative}</small>
            </article>
          ))
        ) : (
          <EmptyState
            title="No balanced surplus-for-need match"
            detail="Change strategy, import manual assets, or revisit after roster movement."
          />
        )}
      </section>
    </SeasonWorkspace>
  );
}

export function DynastyCenterWorkspace() {
  const { context, snapshot } = useLeagueData();
  const [scenarioRosterId, setScenarioRosterId] = useState<number | null>(null);
  if (!context || !snapshot)
    return <NoLeagueWorkspace title="Dynasty Center" />;
  const players = userRosterPlayers(context, snapshot);
  const ages = players.flatMap((player) => (player.age ? [player.age] : []));
  const averageAge = ages.length
    ? ages.reduce((sum, age) => sum + age, 0) / ages.length
    : 26;
  const picks = snapshot.tradedPicks.filter((pick) =>
    isOwnedPick(pick, context.rosterId),
  ).length;
  const direction = calculateDynastyDirection({
    starterStrength: proxyRosterStrength(players),
    depth: clamp(
      players.length / Math.max(1, context.rosterPositions.length),
      0,
      1,
    ),
    youth: clamp((29 - averageAge) / 8, 0, 1),
    ageRisk: clamp((averageAge - 25) / 8, 0, 1),
    injuryRisk:
      players.filter((player) => player.status === "injured").length /
      Math.max(1, players.length),
    pickCapital: clamp(picks / 8, 0, 1),
    futurePickDistribution: clamp(picks / 6, 0, 1),
    marketValue: proxyRosterStrength(players),
    expectedPoints: proxyRosterStrength(players),
    leagueStrength: 0.5,
    playoffOdds: 0.5,
    taxiAssets:
      snapshot.rosters.find((roster) => roster.roster_id === context.rosterId)
        ?.taxi?.length ?? 0,
    rookieAssets:
      players.filter((player) => player.yearsExperience === 0).length /
      Math.max(1, players.length),
    rosterFlexibility: clamp(
      1 - players.length / Math.max(1, context.rosterPositions.length + 12),
      0.2,
      1,
    ),
  });
  const selectedScenarioRoster =
    snapshot.rosters.find((roster) => roster.roster_id === scenarioRosterId) ??
    snapshot.rosters.find((roster) => roster.roster_id === context.rosterId) ??
    snapshot.rosters[0];
  const scenarioPlayerIds = new Set(selectedScenarioRoster?.players ?? []);
  const scenarioAssets: DynastyScenarioAsset[] = [
    ...snapshot.players
      .filter((player) => scenarioPlayerIds.has(player.id))
      .map((player) => ({
        id: player.id,
        label: player.fullName,
        type: "player" as const,
        position: player.position,
        marketValue: proxyPlayerValue(player),
        productionValue: proxyPlayerValue(player) * 0.86,
        age: player.age,
        injured: player.status === "injured",
        taxiEligible:
          player.yearsExperience !== undefined && player.yearsExperience <= 2,
      })),
    ...snapshot.tradedPicks
      .filter((pick) =>
        isOwnedPick(pick, selectedScenarioRoster?.roster_id ?? null),
      )
      .map((pick, index) => ({
        id: `pick-${index}`,
        label: futurePickLabel(pick, index),
        type: "pick" as const,
        marketValue: 55,
        productionValue: 34,
      })),
  ];
  const orphan = analyzeOrphanRoster({
    assets: scenarioAssets,
    requiredRosterSize: context.rosterPositions.length,
    futurePickYears: 3,
  });
  const dispersal = analyzeDispersalPool({
    assets: scenarioAssets,
    teamCount: Math.max(2, Math.min(4, snapshot.rosters.length)),
  });
  return (
    <SeasonWorkspace
      title="Dynasty Center"
      subtitle="Market, production, contender, rebuild, and roster-specific value remain distinct."
    >
      <section className="direction-meter">
        <DirectionScore
          label="Contender"
          value={direction.contender}
          active={direction.primary === "contender"}
        />
        <DirectionScore
          label="Balanced"
          value={direction.balanced}
          active={direction.primary === "balanced"}
        />
        <DirectionScore
          label="Productive struggle"
          value={direction.productiveStruggle}
          active={direction.primary === "productive_struggle"}
        />
        <DirectionScore
          label="Rebuild"
          value={direction.rebuild}
          active={direction.primary === "rebuild"}
        />
      </section>
      {direction.conflicts.map((conflict) => (
        <div className="surface warning-strip" key={conflict}>
          <AlertTriangle />
          {conflict}
        </div>
      ))}
      <div className="planning-grid">
        <PlanningPanel
          title="Current season"
          rows={[
            "Protect flexible starter depth",
            "Track aging assets before the deadline",
            "Keep productive taxi assets labeled separately",
          ]}
        />
        <PlanningPanel
          title="Next offseason"
          rows={[
            `${picks} future picks currently visible`,
            "Model roster expansion before cuts",
            "Compare market and projected production values",
          ]}
        />
        <PlanningPanel
          title="Two-year plan"
          rows={[
            "Do not assign exact future pick slots",
            "Re-evaluate class strength and liquidity",
            "Plan positional succession by age curve",
          ]}
        />
      </div>
      <section className="surface dynasty-scenario">
        <header>
          <div>
            <h2>Orphan & dispersal scenario</h2>
            <p>Manual analysis only; no Sleeper roster is changed.</p>
          </div>
          <label>
            Roster
            <select
              value={selectedScenarioRoster?.roster_id ?? ""}
              onChange={(event) =>
                setScenarioRosterId(Number(event.target.value))
              }
            >
              {snapshot.rosters.map((roster) => (
                <option key={roster.roster_id} value={roster.roster_id}>
                  {teamName(snapshot, roster.roster_id)}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className="auction-values">
          <ValueTile
            label="Takeover difficulty"
            value={orphan.takeoverDifficulty}
          />
          <ValueTile
            label="Immediate"
            value={orphan.immediateCompetitiveness.toFixed(0)}
          />
          <ValueTile
            label="Future flexibility"
            value={orphan.futureFlexibility.toFixed(0)}
          />
          <ValueTile
            label="Dispersal assets/team"
            value={dispersal.assetsPerTeam.toFixed(1)}
          />
        </div>
        <div className="planning-grid">
          <PlanningPanel
            title="Strengths"
            rows={
              orphan.strengths.length
                ? orphan.strengths
                : ["No strong signal yet"]
            }
          />
          <PlanningPanel
            title="Risks"
            rows={
              orphan.risks.length ? orphan.risks : ["No material risk detected"]
            }
          />
          <PlanningPanel title="Takeover priorities" rows={orphan.priorities} />
        </div>
        <footer>
          <ShieldCheck aria-hidden="true" />
          {orphan.noWriteBoundary}
        </footer>
      </section>
    </SeasonWorkspace>
  );
}

export function RookieCenterWorkspace() {
  const { context, snapshot } = useLeagueData();
  const pool = usePlayerPool({ rookiesOnly: true, limit: 180 });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [pickNumber, setPickNumber] = useState(3);
  if (!context) return <NoLeagueWorkspace title="Rookie Center" />;
  const selectedPlayer =
    pool.players.find((player) => player.id === selectedPlayerId) ??
    pool.players[0];
  const profile = selectedPlayer
    ? buildRookieProfile(selectedPlayer, context)
    : null;
  const userRoster = snapshot?.rosters.find(
    (roster) => roster.roster_id === context.rosterId,
  );
  const taxiSlots = numericSetting(context.settings, "taxi_slots", 0);
  const scenarios = profile
    ? compareRookiePickScenarios({
        pickNumber,
        profile,
        strategy: context.strategy,
        futurePickCount: snapshot?.tradedPicks.length ?? 0,
        taxiOpenSlots: Math.max(0, taxiSlots - (userRoster?.taxi?.length ?? 0)),
        rosterCutPressure: Math.max(
          0,
          (userRoster?.players?.length ?? 0) - context.rosterPositions.length,
        ),
      })
    : [];
  return (
    <SeasonWorkspace
      title="Rookie Center"
      subtitle="Rookie-only, supplemental, startup, Superflex, TE premium, IDP, and taxi-aware board."
    >
      <section className="rookie-center-layout">
        <div className="surface rookie-board">
          <header>
            <span>Rank</span>
            <span>Prospect</span>
            <span>Opportunity</span>
            <span>Strategy fit</span>
          </header>
          {pool.players.slice(0, 30).map((player, index) => (
            <button
              type="button"
              key={player.id}
              data-selected={player.id === selectedPlayer?.id}
              onClick={() => setSelectedPlayerId(player.id)}
            >
              <strong>{index + 1}</strong>
              <span>
                <PositionBadge position={player.position} />
                <span>
                  <strong>{player.fullName}</strong>
                  <small>
                    {player.team ?? "Unassigned"} ·{" "}
                    {player.college ?? "College not reported"}
                  </small>
                </span>
              </span>
              <span>
                {player.nflDraftRound
                  ? `NFL round ${player.nflDraftRound}`
                  : "Draft capital pending"}
              </span>
              <span>
                {context.strategy.replace("_", " ")} ·{" "}
                {taxiSlots > 0 ? "taxi check" : "active roster"}
              </span>
            </button>
          ))}
        </div>
        {profile && selectedPlayer ? (
          <aside className="surface rookie-profile">
            <header>
              <PositionBadge position={selectedPlayer.position} />
              <div>
                <h2>{selectedPlayer.fullName}</h2>
                <p>
                  Sleeper {profile.identity.sleeperId} ·{" "}
                  {profile.identity.team ?? "NFL team unavailable"}
                </p>
              </div>
            </header>
            <div className="auction-values">
              <ValueTile
                label="Immediate"
                value={profile.immediateProjection.toFixed(0)}
              />
              <ValueTile
                label="Long term"
                value={profile.longTermProjection.toFixed(0)}
              />
              <ValueTile
                label="Floor–ceiling"
                value={`${profile.floor.toFixed(0)}–${profile.ceiling.toFixed(0)}`}
              />
              <ValueTile
                label="Bust risk"
                value={`${profile.bustRisk.toFixed(0)}%`}
              />
              <ValueTile
                label="Contender fit"
                value={profile.contenderFit.toFixed(0)}
              />
              <ValueTile
                label="Rebuilder fit"
                value={profile.rebuilderFit.toFixed(0)}
              />
              <ValueTile label="Taxi fit" value={profile.taxiFit.toFixed(0)} />
            </div>
            <p>{profile.opportunity}</p>
            <dl>
              <div>
                <dt>Age</dt>
                <dd>{profile.identity.age ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>College</dt>
                <dd>{profile.identity.college ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>NFL draft</dt>
                <dd>
                  {profile.identity.nflRound
                    ? `Round ${profile.identity.nflRound}${profile.identity.nflOverallPick ? ` · pick ${profile.identity.nflOverallPick}` : ""}`
                    : "Unavailable"}
                </dd>
              </div>
            </dl>
            <p className="muted-copy">
              Missing—not invented: {profile.missingFields.join(", ") || "none"}
              .
            </p>
            <h3>Rookie-pick trade calculator</h3>
            <label>
              Pick number
              <input
                type="number"
                min="1"
                max="200"
                value={pickNumber}
                onChange={(event) =>
                  setPickNumber(Math.max(1, Number(event.target.value)))
                }
              />
            </label>
            <div className="rookie-scenarios">
              {scenarios.map((scenario, index) => (
                <article key={scenario.id} data-leading={index === 0}>
                  <span>
                    <strong>{scenario.label}</strong>
                    <small>
                      {scenario.strategyFit.replaceAll("_", " ")} fit ·
                      uncertainty ±{scenario.uncertainty}
                    </small>
                  </span>
                  <strong>{scenario.expectedValue.toFixed(0)}</strong>
                  <small>
                    {scenario.floor.toFixed(0)}–{scenario.ceiling.toFixed(0)}
                  </small>
                </article>
              ))}
            </div>
            <p className="muted-copy">
              Recalculates player-versus-pick alternatives, future-pick
              liquidity, taxi capacity, cuts, strategy, and format scarcity. No
              trade is submitted.
            </p>
          </aside>
        ) : null}
      </section>
    </SeasonWorkspace>
  );
}

export function TaxiSquadWorkspace() {
  const { context, snapshot } = useLeagueData();
  if (!context || !snapshot) return <NoLeagueWorkspace title="Taxi Squad" />;
  const roster = snapshot.rosters.find(
    (candidate) => candidate.roster_id === context.rosterId,
  );
  const taxiIds = new Set(roster?.taxi ?? []);
  const players = snapshot.players.filter((player) => taxiIds.has(player.id));
  const rules = {
    slots: numericSetting(context.settings, "taxi_slots", 0),
    experienceLimit: nullableNumericSetting(context.settings, "taxi_years"),
    allowNonRookies:
      numericSetting(context.settings, "taxi_allow_vets", 0) === 1,
    deadline: null,
    canReturnAfterPromotion: false,
  };
  return (
    <SeasonWorkspace
      title="Taxi Squad"
      subtitle={`${players.length}/${rules.slots} slots · eligibility and promotion consequences stay league-specific.`}
    >
      <section className="taxi-list">
        {players.map((player) => {
          const recommendation = recommendTaxi(
            {
              playerId: player.id,
              name: player.fullName,
              position: player.position,
              yearsExperience: player.yearsExperience ?? null,
              isRookie: player.yearsExperience === 0,
              onTaxi: true,
              currentProductionNeed: 45,
              developmentValue: proxyPlayerValue(player),
              rosterValue: proxyPlayerValue(player),
              idp: isIdpPosition(player.position),
            },
            rules,
          );
          return (
            <article className="surface taxi-row" key={player.id}>
              <PositionBadge position={player.position} />
              <span>
                <strong>{player.fullName}</strong>
                <small>
                  {recommendation.eligible ? "Eligible" : "Ineligible"} ·{" "}
                  {recommendation.eligibilityExpiresAfterSeason
                    ? "eligibility expires"
                    : "eligibility retained"}
                </small>
              </span>
              <StatusBadge
                tone={recommendation.eligible ? "success" : "danger"}
              >
                {recommendation.action.replaceAll("_", " ")}
              </StatusBadge>
              <p>{recommendation.rationale.join(" · ")}</p>
            </article>
          );
        })}
        {players.length === 0 ? (
          <EmptyState
            title="No taxi players"
            detail="Sleeper reports no players in this roster's taxi array."
          />
        ) : null}
      </section>
    </SeasonWorkspace>
  );
}

export function IdpWorkspace() {
  const { context, snapshot } = useLeagueData();
  const pool = usePlayerPool({ idpOnly: true, limit: 180 });
  if (!context || !snapshot) return <NoLeagueWorkspace title="IDP" />;
  return (
    <SeasonWorkspace
      title="IDP"
      subtitle="Exact eligibility, tackle floor, big-play ceiling, role stability, weekly value, and dynasty curves."
    >
      <section className="idp-summary">
        <Insight
          icon={<ShieldCheck />}
          label="IDP slots"
          value={String(context.rosterPositions.filter(isIdpPosition).length)}
        />
        <Insight
          icon={<Target />}
          label="Scoring keys"
          value={String(
            Object.keys(context.scoringSettings).filter((key) =>
              ["tkl", "sack", "int", "ff", "pass_def", "qb_hit"].some(
                (prefix) => key.includes(prefix),
              ),
            ).length,
          )}
        />
        <Insight
          icon={<Users />}
          label="Pool"
          value={`${pool.players.length} indexed`}
        />
      </section>
      <section className="surface idp-board">
        {pool.players.slice(0, 30).map((player) => {
          const projection = projectIdpPlayer({
            role: {
              position: player.position,
              age: player.age ?? null,
              snapShare: null,
              threeDownRole: null,
              tackleOpportunities: null,
              pressureOpportunities: null,
              boxSnapShare: null,
              blitzRate: null,
              injuryPenalty: player.status === "injured" ? 0.35 : 0,
              roleStability: null,
            },
            scoring: context.scoringSettings,
          });
          return (
            <div key={player.id}>
              <PositionBadge position={player.position} />
              <span>
                <strong>{player.fullName}</strong>
                <small>
                  {player.team ?? "FA"} · exact {player.position} eligibility ·{" "}
                  {Math.round(projection.confidence * 100)}% confidence
                </small>
              </span>
              <span className="idp-metrics">
                <strong>
                  Expected {projection.weeklyExpectedPoints.toFixed(1)}
                </strong>
                <small>
                  Floor {projection.tackleFloor.toFixed(1)} · ceiling{" "}
                  {projection.bigPlayCeiling.toFixed(1)} · role{" "}
                  {Math.round(projection.roleStability * 100)}% · dynasty{" "}
                  {projection.dynastyValue.toFixed(0)}
                </small>
                <small>{projection.assumptions[0]}</small>
              </span>
            </div>
          );
        })}
      </section>
    </SeasonWorkspace>
  );
}

export function AuctionWorkspace() {
  const { context, snapshot } = useLeagueData();
  const pool = usePlayerPool({ limit: 180 });
  const [auctionState, setAuctionState] = useState<{
    leagueId: string;
    remainingBudget: number;
    filledSpots: number;
    keeperCommitment: number;
    currentBid: number;
    strategy: Parameters<typeof buildAuctionRoomPlan>[0]["strategy"];
  } | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  if (!context || !snapshot) return <NoLeagueWorkspace title="Auction" />;
  const currentState =
    auctionState?.leagueId === context.leagueId
      ? auctionState
      : {
          leagueId: context.leagueId,
          remainingBudget: numericSetting(
            context.settings,
            "auction_budget",
            200,
          ),
          filledSpots: 0,
          keeperCommitment: 0,
          currentBid: 0,
          strategy: "balanced" as const,
        };
  const {
    remainingBudget,
    filledSpots,
    keeperCommitment,
    currentBid,
    strategy,
  } = currentState;
  const updateAuctionState = (
    update: Partial<Omit<typeof currentState, "leagueId">>,
  ) => setAuctionState({ ...currentState, ...update });
  const rosterSpots = Math.max(1, context.rosterPositions.length);
  const minimumBid =
    nullableNumericSetting(context.settings, "auction_min_bid") ?? 1;
  const selectedPlayer =
    pool.players.find((player) => player.id === selectedPlayerId) ??
    pool.players[0];
  const playerValue = selectedPlayer ? proxyPlayerValue(selectedPlayer) : 32;
  const recommendation = recommendAuctionBid({
    team: {
      rosterId: context.rosterId ?? 0,
      budget: numericSetting(context.settings, "auction_budget", 200),
      remainingBudget,
      rosterSpots,
      filledSpots,
      minimumBid,
    },
    player: {
      playerId: selectedPlayer?.id ?? "selected",
      baselineValue: playerValue * 0.32,
      leagueAdjustedValue: playerValue * 0.36,
      rosterSpecificValue:
        playerValue * (context.strategy === "contender" ? 0.43 : 0.39),
    },
    inflation: 1.08,
  });
  const roomPlan = buildAuctionRoomPlan({
    team: {
      rosterId: context.rosterId ?? 0,
      budget: numericSetting(context.settings, "auction_budget", 200),
      remainingBudget,
      rosterSpots,
      filledSpots,
      minimumBid,
    },
    keeperCommitment,
    currentBid,
    bidLeader: null,
    currentNomination: selectedPlayer
      ? {
          playerId: selectedPlayer.id,
          baselineValue: playerValue * 0.32,
          leagueAdjustedValue: playerValue * 0.36,
          rosterSpecificValue: playerValue * 0.39,
        }
      : null,
    positionSpend: {},
    strategy,
    nominationCandidates: pool.players.slice(0, 24).map((player) => ({
      name: player.fullName,
      position: player.position,
      leagueAdjustedValue: proxyPlayerValue(player) * 0.36,
      rosterSpecificValue:
        proxyPlayerValue(player) *
        (player.position === "RB" && strategy === "zero_rb" ? 0.25 : 0.39),
    })),
  });
  return (
    <SeasonWorkspace
      title="Auction Assistant"
      subtitle="Budget pace, inflation, legal maximums, nominations, and endgame reserve. Never auto-bids."
    >
      <section className="surface auction-controls">
        <label>
          Current nomination
          <select
            value={selectedPlayer?.id ?? ""}
            onChange={(event) => setSelectedPlayerId(event.target.value)}
          >
            {pool.players.slice(0, 80).map((player) => (
              <option key={player.id} value={player.id}>
                {player.fullName} · {player.position}
              </option>
            ))}
          </select>
        </label>
        <label>
          Strategy
          <select
            value={strategy}
            onChange={(event) =>
              updateAuctionState({
                strategy: event.target.value as Parameters<
                  typeof buildAuctionRoomPlan
                >[0]["strategy"],
              })
            }
          >
            {[
              "balanced",
              "stars_and_scrubs",
              "zero_rb",
              "hero_rb",
              "elite_qb",
              "late_qb",
              "punt_position",
              "productive_struggle",
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Remaining budget
          <input
            type="number"
            min="0"
            value={remainingBudget}
            onChange={(event) =>
              updateAuctionState({
                remainingBudget: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          Keeper commitments
          <input
            type="number"
            min="0"
            value={keeperCommitment}
            onChange={(event) =>
              updateAuctionState({
                keeperCommitment: Math.max(0, Number(event.target.value)),
              })
            }
          />
        </label>
        <label>
          Current bid
          <input
            type="number"
            min="0"
            value={currentBid}
            onChange={(event) =>
              updateAuctionState({
                currentBid: Math.max(0, Number(event.target.value)),
              })
            }
          />
        </label>
        <label>
          Filled spots
          <input
            type="number"
            min="0"
            max={rosterSpots}
            value={filledSpots}
            onChange={(event) =>
              updateAuctionState({ filledSpots: Number(event.target.value) })
            }
          />
        </label>
      </section>
      <section className="auction-values">
        <ValueTile
          label="Inflation-adjusted"
          value={`$${recommendation.inflationAdjustedValue.toFixed(0)}`}
        />
        <ValueTile
          label="Recommended max"
          value={`$${recommendation.maximumRecommendedBid}`}
        />
        <ValueTile
          label="Legal max"
          value={`$${recommendation.maximumLegalBid}`}
        />
        <ValueTile
          label="Endgame reserve"
          value={`$${recommendation.reserveRequired}`}
        />
        <ValueTile
          label="Budget pace"
          value={roomPlan.budgetPace.replaceAll("_", " ")}
        />
        <ValueTile
          label="Per open spot"
          value={`$${roomPlan.dollarsPerOpenSpot}`}
        />
        <ValueTile
          label="Keeper spend"
          value={`$${roomPlan.keeperCommitment}`}
        />
        <ValueTile
          label="Current bid"
          value={roomPlan.currentBidLegal ? "Legal" : "Illegal"}
        />
      </section>
      <div className="surface warning-strip">
        <CircleDollarSign />
        Bargain at ${recommendation.bargainThreshold} or less · overpay warning
        above ${recommendation.overpayThreshold}. Manual bidding only.
      </div>
      <section className="surface planning-panel">
        <h2>Nomination plan</h2>
        <p>{roomPlan.nominationRecommendation}</p>
        <p>
          {minimumBid === 0
            ? "This league allows a zero-dollar minimum; no $1 reserve is invented."
            : `$${minimumBid} is reserved for each roster spot that remains after a win.`}
        </p>
        {roomPlan.warnings.map((warning) => (
          <p className="warning-copy" key={warning}>
            {warning}
          </p>
        ))}
        <footer>
          <ShieldCheck aria-hidden="true" /> Manual values stay local. Not
          Sleeping never bids or nominates.
        </footer>
      </section>
    </SeasonWorkspace>
  );
}

export function MockDraftLabWorkspace() {
  const pool = usePlayerPool({ limit: 420 });
  const [teams, setTeams] = useState(10);
  const [rounds, setRounds] = useState(15);
  const [userSlot, setUserSlot] = useState(3);
  const [style, setStyle] = useState<DraftEngineConfig["style"]>("snake");
  const [sessionState, setSessionState] = useState<DraftEngineState | null>(
    null,
  );
  const [activeSession, setActiveSession] = useState<MockDraftSession | null>(
    null,
  );
  const draftPlayers = useMemo(
    () => pool.players.map(toDraftEnginePlayer),
    [pool.players],
  );
  const start = () => {
    const session = new MockDraftSession(
      mockConfig(teams, rounds, style, userSlot),
      draftPlayers,
    );
    setActiveSession(session);
    session.start();
    setSessionState(session.simulateOpponentsToUserTurn());
  };
  const command = (
    action: "pick" | "pause" | "resume" | "undo" | "redo" | "complete",
  ) => {
    const session = activeSession;
    if (!session) return;
    if (action === "pick")
      setSessionState(session.simulateOpponentsToUserTurn());
    if (action === "pause") setSessionState(session.pause());
    if (action === "resume") setSessionState(session.resume());
    if (action === "undo") setSessionState(session.undo());
    if (action === "redo") setSessionState(session.redo());
    if (action === "complete") setSessionState(session.autoComplete());
  };
  const makeManualPick = (playerId: string) => {
    const session = activeSession;
    if (!session) return;
    session.makeUserPick(playerId);
    setSessionState(session.simulateOpponentsToUserTurn());
  };
  const recommendations = activeSession?.recommendations(8) ?? [];
  const userOnClock = activeSession?.isUserOnClock() ?? false;
  const validation =
    activeSession && sessionState
      ? assertDraftInvariants(activeSession.config, sessionState, draftPlayers)
      : null;
  return (
    <SeasonWorkspace
      title="Mock Draft Lab"
      subtitle="The same deterministic recommendation core powers manual, opponent-agent, keeper, traded-pick, rookie, IDP, Best Ball, 3RR, and auction mocks."
    >
      <section className="surface mock-config">
        <label>
          Teams
          <select
            value={teams}
            onChange={(event) => {
              const nextTeams = Number(event.target.value);
              setTeams(nextTeams);
              setUserSlot((current) => Math.min(current, nextTeams));
            }}
          >
            {[8, 10, 12, 14, 16, 32].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Rounds
          <input
            type="number"
            min="1"
            max="40"
            value={rounds}
            onChange={(event) => setRounds(Number(event.target.value))}
          />
        </label>
        <label>
          Your slot
          <select
            value={Math.min(userSlot, teams)}
            onChange={(event) => setUserSlot(Number(event.target.value))}
          >
            {Array.from({ length: teams }, (_, index) => index + 1).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Style
          <select
            value={style}
            onChange={(event) =>
              setStyle(event.target.value as DraftEngineConfig["style"])
            }
          >
            <option value="snake">Snake</option>
            <option value="third_round_reversal">3RR</option>
            <option value="linear">Linear</option>
            <option value="auction">Auction</option>
          </select>
        </label>
        <Button
          variant="primary"
          size="small"
          icon={<Play />}
          onClick={start}
          disabled={draftPlayers.length < teams * rounds}
        >
          Start
        </Button>
      </section>
      {sessionState ? (
        <>
          <section className="mock-toolbar">
            <Button
              size="small"
              icon={sessionState.status === "paused" ? <Play /> : <Pause />}
              onClick={() =>
                command(sessionState.status === "paused" ? "resume" : "pause")
              }
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
            <Button
              size="small"
              icon={<Zap />}
              onClick={() => command("pick")}
              disabled={sessionState.status !== "drafting" || userOnClock}
            >
              Run opponents to my turn
            </Button>
            <Button
              size="small"
              onClick={() => command("complete")}
              disabled={sessionState.status === "complete"}
            >
              Complete local mock
            </Button>
          </section>
          <section className="surface mock-status">
            <div>
              <small>Status</small>
              <strong>{sessionState.status}</strong>
            </div>
            <div>
              <small>Next pick</small>
              <strong>{sessionState.currentPick}</strong>
            </div>
            <div>
              <small>Owner</small>
              <strong>
                Slot{" "}
                {sessionState.status === "complete"
                  ? "—"
                  : ownerForPick(
                      activeSession?.config ??
                        mockConfig(teams, rounds, style, userSlot),
                      sessionState.currentPick,
                    )}
              </strong>
            </div>
            <div>
              <small>Control</small>
              <strong>{userOnClock ? "Your manual pick" : "CPU turn"}</strong>
            </div>
            <div>
              <small>Latency</small>
              <strong>
                {sessionState.recommendationLatencyMs.toFixed(1)}ms
              </strong>
            </div>
          </section>
          <div
            className={`surface mock-validation ${validation?.passed ? "valid" : "invalid"}`}
            role="status"
          >
            <ShieldCheck aria-hidden="true" />
            {validation?.passed
              ? `${sessionState.picks.length} legal picks · no duplicates · player pool and order verified`
              : validation?.errors.join(" ")}
          </div>
          <section className="mock-layout">
            <div className="surface mock-board">
              <h2>Recent picks</h2>
              {sessionState.picks
                .slice(-20)
                .toReversed()
                .map((pick) => (
                  <div key={pick.pickNumber}>
                    <strong>
                      {pick.round}.{String(pick.pickInRound).padStart(2, "0")}
                    </strong>
                    <span>
                      {draftPlayers.find(
                        (player) => player.playerId === pick.playerId,
                      )?.name ?? pick.playerId}
                    </span>
                    <small>
                      Slot {pick.ownerSlot}
                      {pick.isKeeper ? " · Keeper" : ""}
                    </small>
                  </div>
                ))}
            </div>
            <div className="surface mock-recommendations">
              <h2>Available board</h2>
              {recommendations.map((recommendation) => (
                <div key={recommendation.playerId}>
                  <strong>{recommendation.rank}</strong>
                  <span>
                    <b>
                      {
                        draftPlayers.find(
                          (player) =>
                            player.playerId === recommendation.playerId,
                        )?.name
                      }
                    </b>
                    <small>{recommendation.factors.join(" · ")}</small>
                  </span>
                  <small>
                    {Math.round(recommendation.availabilityAtNextPick * 100)}%
                    next pick
                  </small>
                  <Button
                    size="small"
                    variant={recommendation.rank === 1 ? "primary" : "ghost"}
                    onClick={() => makeManualPick(recommendation.playerId)}
                    disabled={!userOnClock}
                  >
                    Draft
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          title="Configure a local mock"
          detail="No Sleeper room is created and no picks are submitted."
        />
      )}
    </SeasonWorkspace>
  );
}

export function ResearchWorkspace() {
  const { context } = useLeagueData();
  return (
    <SeasonWorkspace
      title="Research"
      subtitle="Current evidence is sourced, timestamped, classified, conflict-checked, and cost-aware."
    >
      <section className="surface source-policy-summary">
        <FileSearch />
        <div>
          <h2>Evidence policy</h2>
          <p>
            Official league and NFL sources lead. Reporter and public-social
            claims stay labeled, expire quickly, and need corroboration for
            material score changes.
          </p>
        </div>
        <StatusBadge tone="success">Prompt-injection filtered</StatusBadge>
      </section>
      <section className="research-actions">
        <PlanningPanel
          title="Automatic triggers"
          rows={[
            "New injury or practice designation",
            "Inactive window approaching",
            "Starter ruled out or role change",
            "Meaningful weather threshold",
            "Close decision with stale evidence",
          ]}
        />
        <PlanningPanel
          title="Cost controls"
          rows={[
            "Never call OpenAI every poll",
            "Batch related research",
            "Reuse fresh equivalent evidence",
            "Honor automatic-research and budget settings",
            "Show estimated usage before deep research",
          ]}
        />
      </section>
      {context ? (
        <div className="surface warning-strip">
          <Sparkles />
          Research is minimized to league {context.leagueId.slice(-6)} and week{" "}
          {context.week}; full league history is not sent.
        </div>
      ) : null}
    </SeasonWorkspace>
  );
}

export function DeadlineWorkspace() {
  const { context } = useLeagueData();
  return (
    <SeasonWorkspace
      title="Deadlines"
      subtitle="League-aware decision windows and optional local alerts while Chrome is running."
    >
      <section className="deadline-list">
        {[
          "Waiver processing",
          "Lineup locks",
          "Trade deadline",
          "Taxi deadline",
          "Rookie draft",
          "Official inactive report",
        ].map((label, index) => (
          <article className="surface" key={label}>
            <CalendarClock />
            <span>
              <strong>{label}</strong>
              <small>
                {index < 2
                  ? `Week ${context?.week ?? 1} · verify live league time`
                  : "Not represented by Sleeper · manual override available"}
              </small>
            </span>
            <StatusBadge tone={index < 2 ? "info" : "neutral"}>
              {index < 2 ? "Tracked" : "Manual"}
            </StatusBadge>
          </article>
        ))}
      </section>
      <div className="surface warning-strip">
        <AlertTriangle />
        Browser alerts are optional and not guaranteed when Chrome is closed.
        Private league details stay hidden unless explicitly enabled.
      </div>
    </SeasonWorkspace>
  );
}

function SeasonWorkspace({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const context = useLeagueStore((state) => state.activeContext);
  const snapshot = useLeagueStore((state) => state.snapshot);
  const intelligenceFeature = context
    ? workspaceIntelligenceFeature(title, context)
    : null;
  return (
    <section className="workspace-page season-workspace">
      <header className="workspace-heading">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </header>
      {context && snapshot && intelligenceFeature ? (
        <RealtimeIntelligenceCard
          feature={intelligenceFeature}
          subject={`${context.leagueId}:${intelligenceFeature}`}
          contextSummary={`${title}. Week ${context.week}. ${context.leagueType} ${context.lineupType}; ${Object.keys(context.scoringSettings).length} scoring settings; ${context.waiverType}.`}
          candidates={buildWorkspaceDecisionCandidates(
            intelligenceFeature,
            context,
            snapshot,
          )}
          strategy={context.strategy}
          riskTolerance={0.5}
        />
      ) : null}
      {children}
    </section>
  );
}

function workspaceIntelligenceFeature(
  title: string,
  context: LeagueContext,
): AiFeature | null {
  if (title === "Best Ball Optimizer") return "best_ball";
  if (title === "Start & Sit") return "start_sit";
  if (title === "Matchup Center") return "matchup";
  if (title === "Chopped Survival") return "chopped";
  if (title === "Waiver Wire") return "waiver";
  if (title === "Trade Center") return "trade";
  if (title === "Dynasty Center") {
    return context.leagueType === "keeper" ? "keeper" : "dynasty";
  }
  if (title === "Rookie Center") return "rookie";
  if (title === "Taxi Squad") return "taxi";
  if (title === "IDP") return "idp";
  if (title === "Auction Assistant") return "auction";
  if (title === "Mock Draft Lab") return "draft";
  if (title === "Research") return "research";
  return null;
}

function buildWorkspaceDecisionCandidates(
  feature: AiFeature,
  context: LeagueContext,
  snapshot: LeagueSnapshot,
): DecisionCandidate[] {
  const ownRoster = snapshot.rosters.find(
    (roster) => roster.roster_id === context.rosterId,
  );
  const ownIds = new Set([
    ...(ownRoster?.players ?? []),
    ...(ownRoster?.starters ?? []),
    ...(ownRoster?.taxi ?? []),
  ]);
  const rosteredIds = new Set(
    snapshot.rosters.flatMap((roster) => [
      ...(roster.players ?? []),
      ...(roster.reserve ?? []),
      ...(roster.taxi ?? []),
    ]),
  );
  const idpPositions = new Set([
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
  return snapshot.players
    .filter((player) => {
      if (feature === "waiver") return !rosteredIds.has(player.id);
      if (feature === "rookie") return player.yearsExperience === 0;
      if (feature === "idp") return idpPositions.has(player.position);
      if (["start_sit", "best_ball", "taxi"].includes(feature)) {
        return ownIds.has(player.id);
      }
      return true;
    })
    .map((player) => {
      const projection = snapshot.projections.find(
        (row) => row.player_id === player.id,
      );
      const projectedPoints =
        projection?.stats["pts_ppr"] ??
        projection?.stats["pts_half_ppr"] ??
        projection?.stats["pts_std"] ??
        undefined;
      const baseValue = Math.max(
        1,
        Math.min(
          100,
          projectedPoints ?? 100 - Math.min(99, (player.searchRank ?? 500) / 6),
        ),
      );
      return {
        id: player.id,
        label: player.fullName,
        position: player.position,
        ...(player.team ? { team: player.team } : {}),
        baseValue,
        ...(projectedPoints !== undefined ? { projectedPoints } : {}),
        rosterFit: ownIds.has(player.id) ? 0.45 : 0,
        scarcity: ["QB", "TE", "LB"].includes(player.position) ? 0.65 : 0.45,
        risk: player.status === "injured" || player.injuryStatus ? 0.85 : 0.35,
        available: true,
        eligible: feature !== "taxi" || (player.yearsExperience ?? 99) <= 2,
        reasons: [
          `${player.position}${player.team ? ` · ${player.team}` : ""}`,
          player.injuryStatus
            ? `Current Sleeper designation: ${player.injuryStatus}`
            : "No Sleeper injury designation in the current snapshot.",
        ],
        metadata: {
          age: player.age ?? null,
          yearsExperience: player.yearsExperience ?? null,
          newsUpdatedAt: player.newsUpdatedAt ?? null,
        },
      } satisfies DecisionCandidate;
    })
    .toSorted(
      (left, right) =>
        right.baseValue - left.baseValue ||
        left.label.localeCompare(right.label),
    )
    .slice(0, 40);
}

function NoLeagueWorkspace({ title }: { title: string }) {
  const open = useLeagueStore((state) => state.setSwitcherOpen);
  return (
    <SeasonWorkspace
      title={title}
      subtitle="Select a Sleeper league to build an isolated analysis context."
    >
      <EmptyState
        title="No league selected"
        detail="Open the Settings workspace in this panel, connect your Sleeper username, then pick a league here."
      />
      <Button variant="primary" onClick={() => open(true)}>
        Choose league
      </Button>
    </SeasonWorkspace>
  );
}

function DecisionCard({
  decision,
  selected,
  onSelect,
}: {
  decision: DecisionView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className="surface decision-card"
      data-tone={decision.tone}
      data-selected={selected}
      type="button"
      onClick={onSelect}
    >
      <span className="decision-icon">{decisionIcon(decision.id)}</span>
      <span className="decision-copy">
        <small>{decision.title}</small>
        <strong>{decision.decision}</strong>
        <span>{decision.factor}</span>
      </span>
      <span className="decision-meta">
        <strong>{Math.round(decision.confidence * 100)}%</strong>
        <small>{decision.deadline}</small>
        <small>{decision.freshness}</small>
      </span>
      <ChevronRight />
      <footer>
        <span>Pending: {decision.pending}</span>
        <span>{decision.sources} sources</span>
        <span>{decision.action}</span>
      </footer>
    </button>
  );
}

function EvidenceDrawer({
  context,
  decision,
  onClose,
}: {
  context: LeagueContext;
  decision: DecisionView;
  onClose: () => void;
}) {
  const evidence = leagueEvidence(context, decision);
  const established = evidence.filter((item) => isSourcedFact(item.nature));
  const estimated = evidence.filter((item) => !isSourcedFact(item.nature));
  return (
    <div className="evidence-sheet-layer">
      <button
        type="button"
        className="evidence-scrim"
        aria-label="Close evidence"
        onClick={onClose}
      />
      <aside
        className="surface evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Evidence drawer"
      >
        <span className="sheet-grabber" aria-hidden="true" />
        <header>
          <div>
            <small>Why we think this</small>
            <h2>{decision.decision}</h2>
          </div>
          <IconButton label="Close evidence" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        <EvidenceGroup
          title="What we know"
          caption="Reported by a source we can link to."
          tone="fact"
          items={established}
          emptyCopy="Nothing here is confirmed by a source yet."
        />
        <EvidenceGroup
          title="What we worked out"
          caption="Our own estimate, not a reported fact."
          tone="inference"
          items={estimated}
          emptyCopy="No estimate was needed for this call."
        >
          <article className="evidence-inference">
            <span>
              <StatusBadge tone="warning">model</StatusBadge>
              <small>inference</small>
            </span>
            <strong>{decision.factor}</strong>
            <p>
              Worth about ±
              {Math.max(0.5, Math.round(decision.confidence * 4 * 10) / 10)}{" "}
              points either way.
            </p>
          </article>
        </EvidenceGroup>
        <footer>
          <span>Conflicts: none detected in current evidence</span>
          <span>Retrieved {decision.freshness}</span>
        </footer>
      </aside>
    </div>
  );
}

/**
 * `fact` and `report` trace back to something published; the rest is estimated.
 * The drawer used to interleave them and print the nature as a lowercase aside,
 * so a projection read exactly like a confirmed report.
 */
export function isSourcedFact(nature: EvidenceItem["nature"]): boolean {
  return nature === "fact" || nature === "report";
}

function EvidenceGroup({
  title,
  caption,
  tone,
  items,
  emptyCopy,
  children,
}: {
  title: string;
  caption: string;
  tone: "fact" | "inference";
  items: EvidenceItem[];
  emptyCopy: string;
  children?: ReactNode;
}) {
  return (
    <section className="evidence-group" data-tone={tone}>
      <header>
        <h3>{title}</h3>
        <small>{caption}</small>
      </header>
      {children}
      {items.map((item) => (
        <article key={item.id}>
          <span>
            <StatusBadge
              tone={
                item.sourceClass.startsWith("official") ? "success" : "info"
              }
            >
              {item.sourceClass.replaceAll("_", " ")}
            </StatusBadge>
            <small>{item.nature}</small>
          </span>
          <strong>{item.claim}</strong>
          <p>
            {item.publisher} · {new Date(item.retrievedAt).toLocaleString()}
          </p>
          <a href={item.url} target="_blank" rel="noreferrer">
            Source <ExternalLink />
          </a>
        </article>
      ))}
      {items.length === 0 && !children ? (
        <p className="evidence-empty">{emptyCopy}</p>
      ) : null}
    </section>
  );
}

function BestBallNotice({ context }: { context: LeagueContext }) {
  return (
    <section className="surface best-ball-notice">
      <Trophy />
      <div>
        <h2>No manual lineup action</h2>
        <p>
          Sleeper selects the highest-scoring legal lineup after games. Optimize
          depth, weekly ceiling, correlation, volatility, waivers{" "}
          {context.waiverType === "disabled" ? "(disabled)" : "(enabled)"}, and
          playoff exposure.
        </p>
      </div>
    </section>
  );
}

function TeamScore({
  name,
  score,
  label,
}: {
  name: string;
  score: number | null;
  label: string;
}) {
  return (
    <div>
      <small>{label}</small>
      <strong>{name}</strong>
      <span className="tabular">{score === null ? "—" : score.toFixed(2)}</span>
    </div>
  );
}

function MatchupRoster({
  title,
  matchup,
  snapshot,
}: {
  title: string;
  matchup: LeagueSnapshot["matchups"][number] | null | undefined;
  snapshot: LeagueSnapshot;
}) {
  const ids = matchup?.starters ?? [];
  return (
    <section className="surface matchup-roster">
      <h2>{title}</h2>
      {ids.map((id, index) => {
        const player = snapshot.players.find(
          (candidate) => candidate.id === id,
        );
        return (
          <div key={`${id}:${index}`}>
            <span>{index + 1}</span>
            <span>
              <strong>{player?.fullName ?? id}</strong>
              <small>
                {player?.position ?? "Unknown"} · {player?.team ?? "FA"}
              </small>
            </span>
            <strong>
              {matchup?.starters_points?.[index]?.toFixed(1) ??
                matchup?.players_points[id]?.toFixed(1) ??
                "—"}
            </strong>
          </div>
        );
      })}
      {ids.length === 0 ? (
        <p>No starters reported for this matchup state.</p>
      ) : null}
    </section>
  );
}

function matchupTeamInput(
  snapshot: LeagueSnapshot,
  matchup: LeagueSnapshot["matchups"][number] | null | undefined,
  name: string,
  rosterId: number,
): MatchupTeamInput {
  const playerById = new Map(
    snapshot.players.map((player) => [player.id, player]),
  );
  const projectionById = new Map(
    snapshot.projections.map((projection) => [
      projection.player_id,
      projectionPoints(projection.stats),
    ]),
  );
  return {
    rosterId,
    name,
    currentPoints: resolvedPoints(matchup) ?? 0,
    starters: (matchup?.starters ?? []).map((playerId) => {
      const player = playerById.get(playerId);
      return {
        playerId,
        name: player?.fullName ?? playerId,
        position: player?.position ?? "FLEX",
        team: player?.team,
        projectedPoints: projectionById.get(playerId) ?? null,
        currentPoints: matchup?.players_points[playerId] ?? 0,
        status: player?.injuryStatus ?? player?.status,
      };
    }),
  };
}

function Insight({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      {icon}
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

/**
 * A waiver row used to print four bids side by side at equal weight, which
 * left the reader to work out which one to actually enter. The bid to enter is
 * the only number that carries weight now; the rest becomes the track it sits
 * on, so the spread stays visible without competing to be read as the answer.
 */
export function FaabBand({
  faab,
}: {
  faab: NonNullable<ReturnType<typeof recommendWaiver>["faab"]>;
}) {
  const floor = faab.conservativeBid;
  const ceiling = Math.max(faab.maximumRationalBid, floor + 1);
  const span = ceiling - floor;
  const offset = (bid: number) =>
    `${Math.min(100, Math.max(0, ((bid - floor) / span) * 100))}%`;
  return (
    <div className="faab-band">
      <p className="faab-bid">
        <small>Bid</small>
        <strong>${faab.expectedWinningBid}</strong>
      </p>
      <div
        className="faab-range"
        role="img"
        aria-label={`Reasonable between $${floor} and $${faab.aggressiveBid}; $${faab.maximumRationalBid} is the most this player is worth.`}
      >
        <span className="faab-track">
          <span
            className="faab-reasonable"
            style={{
              left: offset(floor),
              right: `calc(100% - ${offset(faab.aggressiveBid)})`,
            }}
          />
          <span
            className="faab-tick"
            style={{ left: offset(faab.expectedWinningBid) }}
          />
        </span>
        <span className="faab-scale" aria-hidden="true">
          <small>${floor}</small>
          <small>${faab.maximumRationalBid} max</small>
        </span>
      </div>
    </div>
  );
}

function AssetPicker({
  title,
  players,
  selected,
  onToggle,
}: {
  title: string;
  players: Player[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <section className="surface asset-picker">
      <header>
        <h2>{title}</h2>
        <StatusBadge tone="neutral">{selected.length} assets</StatusBadge>
      </header>
      <div>
        {players.slice(0, 24).map((player) => (
          <button
            type="button"
            data-selected={selected.includes(player.id)}
            key={player.id}
            onClick={() => onToggle(player.id)}
          >
            <PositionBadge position={player.position} />
            <span>
              <strong>{player.fullName}</strong>
              <small>
                {player.team ?? "FA"} · local value proxy{" "}
                {proxyPlayerValue(player).toFixed(0)}
              </small>
            </span>
            {selected.includes(player.id) ? <CheckCircle2 /> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function DirectionScore({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active: boolean;
}) {
  return (
    <article className="surface" data-active={active}>
      <small>{label}</small>
      <strong>{value.toFixed(0)}</strong>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
    </article>
  );
}

function PlanningPanel({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="surface planning-panel">
      <h2>{title}</h2>
      <ul>
        {rows.map((row) => (
          <li key={row}>
            <ArrowRight />
            {row}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ValueTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="surface value-tile">
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function useLeagueData() {
  return {
    context: useLeagueStore((state) => state.activeContext),
    snapshot: useLeagueStore((state) => state.snapshot),
    status: useLeagueStore((state) => state.status),
  };
}

function useTrendingPlayers(kind: "add" | "drop", limit: number) {
  const [rows, setRows] = useState<{ player: Player; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reloadKey = useLeagueStore((state) => state.activeContext?.leagueId);
  const load = useCallback(async () => {
    if (!hasRuntime()) return;
    setLoading(true);
    setError(null);
    try {
      setRows(
        await requestRuntime({
          type: "GET_TRENDING_PLAYERS",
          payload: { kind, limit },
        }),
      );
    } catch (cause) {
      setError(safeRuntimeError(cause).message);
    } finally {
      setLoading(false);
    }
  }, [kind, limit]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [reloadKey, load]);
  return { rows, loading, error, reload: () => void load() };
}

function usePlayerPool(options: {
  limit: number;
  rookiesOnly?: boolean;
  idpOnly?: boolean;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!hasRuntime()) return;
    let active = true;
    void requestRuntime<Player[]>({
      type: "GET_PLAYER_POOL",
      payload: {
        limit: options.limit,
        rookiesOnly: options.rookiesOnly ?? false,
        idpOnly: options.idpOnly ?? false,
      },
    })
      .then((rows) => {
        if (active) setPlayers(rows);
      })
      .catch((cause: unknown) => {
        if (active) setError(safeRuntimeError(cause).message);
      });
    return () => {
      active = false;
    };
  }, [options.limit, options.rookiesOnly, options.idpOnly]);
  return { players, error };
}

function todayDecisions(
  context: LeagueContext,
  snapshot: LeagueSnapshot | null,
): DecisionView[] {
  const roster = snapshot?.rosters.find(
    (candidate) => candidate.roster_id === context.rosterId,
  );
  const injuries =
    snapshot?.players.filter(
      (player) =>
        roster?.players?.includes(player.id) && player.status === "injured",
    ).length ?? 0;
  const draft = snapshot?.drafts.find((candidate) =>
    ["pre_draft", "drafting", "paused"].includes(candidate.status),
  );
  return [
    {
      id: "lineup",
      title:
        context.lineupType === "best_ball"
          ? "Best Ball roster"
          : "Lineup decision",
      decision:
        context.lineupType === "best_ball"
          ? "Review ceiling and depth"
          : "Optimize legal starters",
      confidence: snapshot ? 0.78 : 0.4,
      deadline: `Week ${context.week}`,
      freshness: snapshot
        ? freshnessLabel(snapshot.fetchedAt)
        : "No live snapshot",
      factor: context.rosterPositions.includes("SUPER_FLEX")
        ? "Superflex eligibility changes replacement value"
        : "Ordered roster slots drive exact assignment",
      pending: injuries
        ? `${injuries} injury designation${injuries === 1 ? "" : "s"}`
        : "No roster injury flags",
      sources: snapshot ? 2 : 0,
      action:
        context.lineupType === "best_ball"
          ? "Review roster manually"
          : "Set lineup in Sleeper",
      tone: injuries ? "warning" : "success",
    },
    {
      id: "news",
      title: "Breaking news",
      decision: injuries
        ? `${injuries} roster injury alert${injuries === 1 ? "" : "s"}`
        : "No current roster injury alert",
      confidence: snapshot ? 0.82 : 0.3,
      deadline: "Before kickoff",
      freshness: snapshot ? freshnessLabel(snapshot.fetchedAt) : "Unknown",
      factor: "Official Sleeper designation is the current baseline",
      pending: "Practice and inactive reports",
      sources: snapshot ? 1 : 0,
      action: "Review evidence before acting",
      tone: injuries ? "danger" : "neutral",
    },
    {
      id: "waiver",
      title: "Waiver deadline",
      decision:
        context.waiverType === "disabled"
          ? "Waivers disabled"
          : `Prepare ${context.waiverType.replaceAll("_", " ")} claims`,
      confidence: 0.92,
      deadline: waiverDeadline(context),
      freshness: snapshot ? freshnessLabel(snapshot.fetchedAt) : "Unknown",
      factor: "Actual budget, priority, roster fit, and transaction history",
      pending: "Next processing timestamp",
      sources: snapshot ? 2 : 0,
      action: "Submit claims manually in Sleeper",
      tone: context.waiverType === "disabled" ? "neutral" : "info",
    },
    {
      id: "draft",
      title: "Draft status",
      decision: draft
        ? `${draft.status.replace("_", " ")} · ${draft.type}`
        : "No active draft",
      confidence: 0.98,
      deadline: draft?.start_time
        ? new Date(draft.start_time).toLocaleString()
        : "No deadline",
      freshness: snapshot ? freshnessLabel(snapshot.fetchedAt) : "Unknown",
      factor: "Sleeper draft state and player pool",
      pending: draft ? "Live picks and timer" : "No pending draft",
      sources: snapshot ? 1 : 0,
      action: draft ? "Make picks in Sleeper" : "No action",
      tone: draft ? "warning" : "neutral",
    },
    {
      id: "taxi",
      title: "Taxi deadline",
      decision:
        numericSetting(context.settings, "taxi_slots", 0) > 0
          ? `${roster?.taxi?.length ?? 0}/${numericSetting(context.settings, "taxi_slots", 0)} taxi slots used`
          : "No taxi squad",
      confidence: 0.9,
      deadline: "Manual league rule if not represented",
      freshness: snapshot ? freshnessLabel(snapshot.fetchedAt) : "Unknown",
      factor: "Experience eligibility and irreversible promotion rules",
      pending: "Commissioner-specific deadline",
      sources: snapshot ? 1 : 0,
      action: "Move players manually in Sleeper",
      tone: "neutral",
    },
    {
      id: "weather",
      title: "Weather risk",
      decision: "Stadium forecasts load by kickoff",
      confidence: 0.7,
      deadline: "Refresh near kickoff",
      freshness: "30m default · 10m near kickoff",
      factor: "Dome status, wind, precipitation, temperature, and uncertainty",
      pending: "Official schedule and roof status",
      sources: 1,
      action: "Review close calls",
      tone: "info",
    },
    {
      id: "research",
      title: "Research freshness",
      decision: "Refresh only decision-relevant evidence",
      confidence: 0.86,
      deadline: "Cost-aware",
      freshness: "2h news · 15m breaking",
      factor: "Official sources outrank reports and social posts",
      pending: "Conflicts reduce confidence",
      sources: 1,
      action: "Approve deep research manually",
      tone: "neutral",
    },
  ];
}

function buildRosterDecisionPlayers(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
  locked: string[],
): StartSitPlayer[] {
  const roster = snapshot.rosters.find(
    (candidate) => candidate.roster_id === context.rosterId,
  );
  if (!roster) return [];
  const projectionMap = new Map(
    snapshot.projections.map((projection) => [
      projection.player_id,
      projection,
    ]),
  );
  return (roster.players ?? []).flatMap((playerId) => {
    const player = snapshot.players.find(
      (candidate) => candidate.id === playerId,
    );
    if (!player) return [];
    const projection = projectionMap.get(playerId);
    const imported = projection ? projectionPoints(projection.stats) : null;
    const scoring = calculateFantasyScore({
      scoringSettings: context.scoringSettings,
      rawStats: projection?.stats ?? {},
      importedProjection: imported,
    });
    const weekly =
      scoring.points === null
        ? proxyPlayerValue(player) / 7
        : scoring.points / 17;
    const injured = player.status === "injured" || Boolean(player.injuryStatus);
    const model = runDynamicModel({
      baseline: weekly,
      availabilityProbability:
        player.status === "inactive" ? 0 : injured ? 0.72 : 0.98,
      volatility: positionVolatility(player.position),
      components: [
        {
          name: "league_scoring",
          adjustment: 0,
          confidence: scoring.points === null ? 0.35 : 0.75,
          evidence: [],
          explanation:
            scoring.points === null
              ? "Raw-stat coverage is incomplete; a labeled projection proxy is used."
              : "Projection translated through the league scoring map.",
          manualOverride: true,
        },
        {
          name: "injury",
          adjustment: injured ? -1.5 : 0,
          confidence: injured ? 0.7 : 0.9,
          evidence: [],
          explanation: injured
            ? `Sleeper status: ${player.injuryStatus ?? player.status}`
            : "No current Sleeper injury flag.",
          manualOverride: true,
        },
      ],
    });
    const currentSlotIndex = (roster.starters ?? []).indexOf(playerId);
    return [
      {
        playerId,
        name: player.fullName,
        positions:
          player.fantasyPositions.length > 0
            ? player.fantasyPositions
            : [player.position],
        model,
        currentSlotIndex: currentSlotIndex >= 0 ? currentSlotIndex : undefined,
        userLocked: locked.includes(playerId),
        inactive: player.status === "inactive",
        onIr: roster.reserve?.includes(playerId),
        onTaxi: roster.taxi?.includes(playerId),
        pendingNews: injured
          ? [
              {
                id: `${playerId}:injury`,
                label: player.injuryStatus ?? "Injury status",
                expectedAt: null,
                impact: "Availability can change this recommendation.",
              },
            ]
          : [],
        evidence: [],
      },
    ];
  });
}

function leagueEvidence(
  context: LeagueContext,
  decision: DecisionView,
): EvidenceItem[] {
  const now = Date.now();
  return [
    {
      id: `league:${context.leagueId}:${decision.id}`,
      sourceClass: "official_league",
      url: "https://api.sleeper.app/",
      publisher: "Sleeper public API",
      publishedAt: null,
      retrievedAt: new Date(now).toISOString(),
      playerIds: [],
      teamIds: [],
      claimType: decision.id,
      claim: decision.factor,
      confidence: decision.confidence,
      freshness: "fresh",
      corroborationCount: 0,
      contradictions: [],
      citation: `${context.leagueName} settings and current state`,
      expiresAt: new Date(now + 15 * 60_000).toISOString(),
      rawSourceHash: `${context.leagueId}:${decision.id}`,
      nature: "fact",
    },
  ];
}

function userRosterPlayers(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
): Player[] {
  const ids = new Set(
    snapshot.rosters.find((roster) => roster.roster_id === context.rosterId)
      ?.players ?? [],
  );
  return snapshot.players.filter((player) => ids.has(player.id));
}

function toWaiverPlayer(player: Player, index: number): WaiverPlayer {
  const value = clamp(proxyPlayerValue(player) - index * 0.35, 1, 100);
  return {
    playerId: player.id,
    name: player.fullName,
    positions: player.fantasyPositions.length
      ? player.fantasyPositions
      : [player.position],
    team: player.team,
    shortTermValue: value,
    restOfSeasonValue: value,
    dynastyValue: clamp(value + (player.yearsExperience === 0 ? 8 : 0), 0, 100),
    contenderValue: value,
    rebuildValue: clamp(
      value + (player.age && player.age < 25 ? 7 : -2),
      0,
      100,
    ),
    breakoutProbability: clamp((100 - value) / 160 + 0.15, 0.08, 0.65),
    stashValue: clamp(value * 0.82, 0, 100),
    risk: player.status === "injured" ? 0.65 : 0.28,
    taxiEligible: player.yearsExperience === 0,
    irEligible: player.status === "injured",
  };
}

function toDropCandidate(player: Player): DropCandidate {
  return {
    ...toWaiverPlayer(player, 0),
    neverDrop: proxyPlayerValue(player) >= 88,
    temporaryHold: player.status === "injured",
    handcuffValue: player.position === "RB" ? 20 : 0,
    irreplaceableStarter: proxyPlayerValue(player) >= 94,
  };
}

function toTradeAsset(player: Player): TradeAsset {
  const value = proxyPlayerValue(player);
  return {
    id: player.id,
    type: "player",
    label: player.fullName,
    position: player.position,
    marketValue: value,
    productionValue: value * 0.86,
    dynastyValue: clamp(
      value +
        (player.age && player.age < 25
          ? 8
          : player.age && player.age > 29
            ? -8
            : 0),
      0,
      100,
    ),
    age: player.age,
    injuryRisk: player.status === "injured" ? 0.55 : 0.15,
    rosterSpaceCost: 1,
    liquidity: value / 100,
  };
}

function toDraftEnginePlayer(player: Player, index: number): DraftEnginePlayer {
  const value = proxyPlayerValue(player);
  return {
    playerId: player.id,
    name: player.fullName,
    positions: player.fantasyPositions.length
      ? player.fantasyPositions
      : [player.position],
    team: player.team,
    adp: player.searchRank ?? index + 1,
    tier: Math.floor(index / 12) + 1,
    redraftValue: value,
    dynastyValue: clamp(
      value + (player.age && player.age < 25 ? 7 : 0),
      0,
      100,
    ),
    contenderValue: value,
    rookie: player.yearsExperience === 0,
    age: player.age,
    auctionValue: Math.max(1, Math.round((value - 45) * 1.2)),
  };
}

function mockConfig(
  teams: number,
  rounds: number,
  style: DraftEngineConfig["style"],
  userSlot: number,
): DraftEngineConfig {
  const starterSlots = [
    "QB",
    "RB",
    "RB",
    "WR",
    "WR",
    "WR",
    "TE",
    "FLEX",
    "SUPER_FLEX",
  ];
  return {
    seed: 20260802,
    leagueType: "redraft",
    teams,
    rounds,
    style,
    playerPool: "all_available",
    rosterSlots: [
      ...starterSlots,
      ...Array.from(
        { length: Math.max(0, rounds - starterSlots.length) },
        () => "BN",
      ),
    ].slice(0, rounds),
    userSlot,
    opponentArchetypes: [
      "adp_follower",
      "best_player_available",
      "positional_need",
      "zero_rb",
      "hero_rb",
      "early_qb",
      "late_qb",
      "te_premium",
      "superflex_qb_hoarder",
      "random_within_tier",
    ],
    superflex: true,
    auctionBudget: 200,
    minimumAuctionBid: 1,
  };
}

function teamName(snapshot: LeagueSnapshot, rosterId: number | null): string {
  if (rosterId === null) return "No opponent";
  const roster = snapshot.rosters.find(
    (candidate) => candidate.roster_id === rosterId,
  );
  const user = snapshot.users.find(
    (candidate) => candidate.user_id === roster?.owner_id,
  );
  const metadata = user?.metadata ?? {};
  return typeof metadata["team_name"] === "string"
    ? metadata["team_name"]
    : (user?.display_name ?? user?.username ?? `Roster ${rosterId}`);
}

function resolvedPoints(
  matchup: LeagueSnapshot["matchups"][number] | null | undefined,
): number | null {
  if (!matchup) return null;
  return matchup.custom_points ?? matchup.points ?? null;
}

function currentFaab(
  snapshot: LeagueSnapshot,
  rosterId: number | null,
  startingBudget: number,
): number {
  const roster = snapshot.rosters.find(
    (candidate) => candidate.roster_id === rosterId,
  );
  const used = numericSetting(roster?.settings ?? {}, "waiver_budget_used", 0);
  return Math.max(0, startingBudget - used);
}

function choppedTeamInputs(
  snapshot: LeagueSnapshot,
  startingBudget: number,
): ChoppedTeamInput[] {
  const matchupByRoster = new Map(
    snapshot.matchups.map((matchup) => [matchup.roster_id, matchup]),
  );
  const projectionById = new Map(
    snapshot.projections.map((projection) => [
      projection.player_id,
      projectionPoints(projection.stats) ?? 0,
    ]),
  );
  const playerById = new Map(
    snapshot.players.map((player) => [player.id, player]),
  );
  return snapshot.rosters.map((roster) => {
    const matchup = matchupByRoster.get(roster.roster_id);
    const starters = matchup?.starters ?? roster.starters ?? [];
    const remaining = starters.map((playerId) => {
      const current = matchup?.players_points[playerId] ?? 0;
      const projected = projectionById.get(playerId) ?? 0;
      return Math.max(0, projected - current);
    });
    return {
      rosterId: roster.roster_id,
      name: teamName(snapshot, roster.roster_id),
      currentPoints: resolvedPoints(matchup) ?? 0,
      projectedRemaining: remaining.reduce((sum, value) => sum + value, 0),
      floorRemaining: remaining.reduce((sum, value) => sum + value * 0.68, 0),
      ceilingRemaining: remaining.reduce((sum, value) => sum + value * 1.38, 0),
      lockedPoints: starters.reduce(
        (sum, playerId) => sum + (matchup?.players_points[playerId] ?? 0),
        0,
      ),
      injuryExposure: starters.filter((playerId) => {
        const player = playerById.get(playerId);
        return Boolean(player?.injuryStatus ?? player?.status === "injured");
      }).length,
      faabRemaining: currentFaab(snapshot, roster.roster_id, startingBudget),
      eliminated: isEliminatedRoster(roster),
    };
  });
}

function isEliminatedRoster(
  roster: LeagueSnapshot["rosters"][number],
): boolean {
  const sources = [roster.settings, roster.metadata ?? {}];
  return sources.some((record) =>
    ["eliminated", "is_eliminated", "chopped"].some((key) => {
      const value = record[key];
      return value === true || value === 1 || value === "1";
    }),
  );
}

function waiverDeadline(context: LeagueContext): string {
  const day = numericSetting(context.settings, "waiver_day_of_week", -1);
  const hour = numericSetting(context.settings, "daily_waivers_hour", 0);
  return day >= 0
    ? `Sleeper day ${day} · ${String(hour).padStart(2, "0")}:00 league time`
    : "Verify next processing time";
}

function projectionPoints(stats: Record<string, number | null>): number | null {
  for (const key of ["pts_ppr", "pts_half_ppr", "pts_std", "pts"] as const) {
    const value = stats[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function probabilityLabel(value: number | null): string {
  return value === null ? "Not available" : `${Math.round(value * 100)}%`;
}

function proxyPlayerValue(player: Player): number {
  const rank = player.searchRank ?? 500;
  return clamp(102 - Math.log2(Math.max(2, rank)) * 8, 8, 98);
}

function proxyRosterStrength(players: Player[]): number {
  if (!players.length) return 0.5;
  return clamp(
    players
      .toSorted(
        (left, right) => proxyPlayerValue(right) - proxyPlayerValue(left),
      )
      .slice(0, 10)
      .reduce((sum, player) => sum + proxyPlayerValue(player), 0) / 850,
    0,
    1,
  );
}

function positionVolatility(position: string): number {
  return position === "WR"
    ? 0.36
    : position === "TE"
      ? 0.34
      : position === "QB"
        ? 0.22
        : isIdpPosition(position)
          ? 0.4
          : 0.28;
}

function scarcityFor(position: string): number {
  return position === "QB" || position === "TE"
    ? 0.72
    : isIdpPosition(position)
      ? 0.64
      : 0.48;
}

function isIdpPosition(position: string): boolean {
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
  ].includes(position.toUpperCase());
}

function isOwnedPick(pick: unknown, rosterId: number | null): boolean {
  if (!pick || typeof pick !== "object" || rosterId === null) return false;
  return (pick as Record<string, unknown>)["owner_id"] === rosterId;
}

function futurePickLabel(pick: unknown, index: number): string {
  if (!pick || typeof pick !== "object") return `Future pick ${index + 1}`;
  const record = pick as Record<string, unknown>;
  const season =
    typeof record["season"] === "string" ? record["season"] : "Future";
  const round = numericSetting(record, "round", index + 1);
  return `${season} round ${round}`;
}

function numericSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = settings[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableNumericSetting(
  settings: Record<string, unknown>,
  key: string,
): number | null {
  const value = settings[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function assetProduction(assets: TradeAsset[]): number {
  return assets.reduce((sum, asset) => sum + asset.productionValue, 0) / 20;
}

function freshnessLabel(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return seconds < 5
    ? "Updated now"
    : seconds < 60
      ? `${seconds}s old`
      : `${Math.round(seconds / 60)}m old`;
}

function decisionIcon(id: string) {
  if (id === "lineup") return <Target />;
  if (id === "news") return <AlertTriangle />;
  if (id === "waiver") return <WalletCards />;
  if (id === "draft") return <Trophy />;
  if (id === "taxi") return <Users />;
  if (id === "weather") return <CloudRain />;
  return <FileSearch />;
}

function toggleId(values: string[], id: string): string[] {
  return values.includes(id)
    ? values.filter((value) => value !== id)
    : [...values, id];
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function hasRuntime(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime.id);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
