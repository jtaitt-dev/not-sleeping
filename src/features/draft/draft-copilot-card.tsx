import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Bot,
  CheckCircle2,
  Crosshair,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ScoreBreakdown } from "@/components/intelligence/score-breakdown";
import { PositionBadge, TierBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { SleeperSelect } from "@/components/ui/form-controls";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { SafeExternalLink } from "@/components/ui/safe-external-link";
import { translateDraftError } from "@/services/draft/draft-errors";
import {
  optimizeTurnPair,
  type TurnPairPlan,
} from "@/services/draft/turn-pair";
import {
  maximumLegalBid,
  recommendAuctionBid,
} from "@/services/auction/auction-service";
import {
  normalizeRiskForDecision,
  normalizeScarcityForDecision,
} from "@/services/draft/recommendation-contract";
import { draftCopilotPerformanceTracker } from "@/services/draft/copilot-performance";
import { resolveFeatureConfig } from "@/services/intelligence/feature-config";
import { requestProviderHostPermission } from "@/services/intelligence/provider-permissions";
import { evaluateDeterministicDecision } from "@/services/intelligence/deterministic-engine";
import type { RealtimeDecision } from "@/services/intelligence/types";
import {
  requestRuntime,
  safeRuntimeError,
  type SafeRuntimeError,
} from "@/services/messaging/runtime-client";
import { getSettings, saveSettings } from "@/services/storage/settings";
import type {
  AiFeature,
  AiFeatureConfig,
  AppSettings,
  DraftContext,
  LeagueFormat,
  Recommendation,
  Strategy,
} from "@/types/domain";

import "./draft-copilot-card.css";

type DraftCopilotCardProps = {
  context: DraftContext;
  format: LeagueFormat;
  recommendations: Recommendation[];
  strategy: Strategy;
  riskTolerance: number;
};

export type DraftAiPreparationStage =
  | "local_ready"
  | "checking_context"
  | "starting_ai"
  | "synthesizing"
  | "ready"
  | "fallback";

export function DraftCopilotCard({
  context,
  format,
  recommendations,
  strategy,
  riskTolerance,
}: DraftCopilotCardProps) {
  const feature: AiFeature =
    context.mode === "keeper"
      ? "keeper"
      : format.bestBall
        ? "best_ball"
        : "draft";
  const candidates = useMemo(
    () =>
      recommendations.slice(0, 40).map((recommendation) => ({
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
        scarcity: normalizeScarcityForDecision(recommendation.scarcity),
        risk: normalizeRiskForDecision(recommendation.risk),
        adp: recommendation.marketAdp ?? recommendation.player.searchRank,
        available: true,
        eligible: true,
        alreadySelected: false,
        reasons: recommendation.components
          .slice(0, 5)
          .map((component) => component.reason),
        metadata: {
          age: recommendation.player.age ?? null,
          yearsExperience: recommendation.player.yearsExperience ?? null,
          rawScore: recommendation.rawScore,
          normalizedScore: recommendation.normalizedScore,
        },
      })),
    [recommendations],
  );
  const input = useMemo(
    () => ({
      feature,
      subject: context.draftId ?? "current-draft",
      contextSummary: `${sessionLabel(context.sessionKind)}. ${context.mode.replaceAll("_", " ")} at pick ${context.currentPick}; ${format.teams} teams; ${context.draftStyle}; ${format.superflex ? "superflex" : "single quarterback"}; ${format.tightEndPremium ? "tight end premium" : "standard tight end scoring"}.`,
      candidates,
      strategy,
      riskTolerance,
      currentPick: context.currentPick,
      ...(context.nextUserPick === undefined
        ? {}
        : {
            picksUntilNext: Math.max(
              0,
              context.nextUserPick - context.currentPick,
            ),
          }),
      facts: {
        sessionKind: context.sessionKind,
        draftStyle: context.draftStyle,
        isUserOnClock: context.isUserOnClock,
        ownedPickNumbers: context.ownedPickNumbers,
      },
    }),
    [candidates, context, feature, format, riskTolerance, strategy],
  );
  const baseline = useMemo(() => evaluateDeterministicDecision(input), [input]);
  const [decision, setDecision] = useState<RealtimeDecision | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<{
    stateHash: string;
    detail: SafeRuntimeError;
  } | null>(null);
  const [preparationStage, setPreparationStage] =
    useState<DraftAiPreparationStage>("local_ready");
  const [preparationStateHash, setPreparationStateHash] = useState("");
  const [playerContextStatus, setPlayerContextStatus] = useState<
    "pending" | "available" | "unavailable"
  >("pending");
  const lastAutomaticHash = useRef("");
  const preparationRun = useRef(0);

  const config = settings ? resolveFeatureConfig(settings, feature) : null;
  const aiEnabled = Boolean(
    settings?.automaticAnalysis && config?.routingMode !== "off",
  );

  const run = useCallback(async () => {
    const runId = preparationRun.current + 1;
    preparationRun.current = runId;
    setPreparationStateHash(baseline.stateHash);
    setError(null);
    setPlayerContextStatus("pending");
    setPreparationStage("checking_context");
    draftCopilotPerformanceTracker.mark(
      baseline.stateHash,
      "researchStartedAt",
      Date.now(),
    );
    try {
      const contextResults = await settleWithin(
        candidates.slice(0, 3).map(async (candidate) => {
          const contextResult = await requestRuntime<{
            playerName?: string;
            status?: string;
            injuryStatus?: string | null;
          } | null>({
            type: "GET_SLEEPER_PLAYER_CONTEXT",
            payload: { playerId: candidate.id, force: false },
          });
          if (!contextResult) return null;
          return [
            contextResult.playerName ?? candidate.label,
            contextResult.status ?? "unknown",
            contextResult.injuryStatus ?? "no injury designation",
          ].join(" · ");
        }),
        1_500,
      );
      if (preparationRun.current !== runId) return;
      const verifiedPlayerContext = contextResults.flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : [],
      );
      setPlayerContextStatus(
        verifiedPlayerContext.length > 0 ? "available" : "unavailable",
      );
      setPreparationStage("starting_ai");
      draftCopilotPerformanceTracker.mark(
        baseline.stateHash,
        "aiJobStartedAt",
        Date.now(),
      );
      const started = await requestRuntime<RealtimeDecision>({
        type: "START_REALTIME_DECISION",
        // The verified context refresh gates freshness, while the current
        // player status/injury values already live in the ranked candidates.
        // Keep the exact hashed input so stale-result protection compares the
        // background decision with the local board currently on screen.
        payload: input,
      });
      if (preparationRun.current !== runId) return;
      setDecision(started);
      setPreparationStage(
        started.aiStatus === "ready" ? "ready" : "synthesizing",
      );
      if (started.aiStatus === "ready") {
        draftCopilotPerformanceTracker.mark(
          baseline.stateHash,
          "aiReadyAt",
          Date.now(),
        );
      }
    } catch (caught) {
      if (preparationRun.current !== runId) return;
      setPreparationStage("fallback");
      setError({
        stateHash: baseline.stateHash,
        detail: safeRuntimeError(caught),
      });
    }
  }, [baseline.stateHash, candidates, input]);

  useEffect(() => {
    let active = true;
    void getSettings().then((next) => {
      if (active) setSettings(next);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    preparationRun.current += 1;
    const localBoardReadyAt = Date.now();
    const precedingPickAt = Math.min(context.lastUpdatedAt, localBoardReadyAt);
    draftCopilotPerformanceTracker.begin({
      stateHash: baseline.stateHash,
      precedingPickAt,
      localBoardStartedAt: precedingPickAt,
      localBoardReadyAt,
      shortlistReadyAt: localBoardReadyAt,
    });
    if (context.isUserOnClock) {
      draftCopilotPerformanceTracker.mark(
        baseline.stateHash,
        "userClockStartedAt",
        context.lastUpdatedAt,
      );
    }
  }, [baseline.stateHash, context.isUserOnClock, context.lastUpdatedAt]);

  useEffect(() => {
    const preTurn =
      context.draftStyle === "auction" ||
      context.isUserOnClock ||
      context.picksUntilUser === undefined ||
      context.picksUntilUser <= 3;
    if (
      aiEnabled &&
      preTurn &&
      candidates.length > 0 &&
      lastAutomaticHash.current !== baseline.stateHash
    ) {
      lastAutomaticHash.current = baseline.stateHash;
      void run();
    }
  }, [
    aiEnabled,
    baseline.stateHash,
    candidates.length,
    context.draftStyle,
    context.isUserOnClock,
    context.picksUntilUser,
    run,
  ]);

  const activeDecision =
    decision?.baseline.stateHash === baseline.stateHash ? decision : null;
  const visiblePreparationStage =
    preparationStateHash === baseline.stateHash
      ? preparationStage
      : "local_ready";
  const visiblePlayerContextStatus =
    preparationStateHash === baseline.stateHash
      ? playerContextStatus
      : "pending";

  useEffect(() => {
    if (activeDecision?.aiStatus !== "queued") return;
    let active = true;
    const timer = window.setInterval(() => {
      void requestRuntime<RealtimeDecision | null>({
        type: "GET_REALTIME_DECISION",
        payload: { jobId: activeDecision.jobId },
      })
        .then((next) => {
          if (!active || !next) return;
          setDecision(next);
          if (next.aiStatus !== "queued") {
            setPreparationStage(
              next.aiStatus === "ready" ? "ready" : "fallback",
            );
            if (next.aiStatus === "ready") {
              draftCopilotPerformanceTracker.mark(
                baseline.stateHash,
                "aiReadyAt",
                Date.now(),
              );
            }
            window.clearInterval(timer);
          }
        })
        .catch((caught: unknown) => {
          if (!active) return;
          setPreparationStage("fallback");
          setError({
            stateHash: baseline.stateHash,
            detail: safeRuntimeError(caught),
          });
          window.clearInterval(timer);
        });
    }, 450);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeDecision, baseline.stateHash]);

  const updateSettings = useCallback(
    async (
      mutate: (
        current: AppSettings,
        currentConfig: AiFeatureConfig,
      ) => AppSettings,
    ) => {
      const current = settings ?? (await getSettings());
      const currentConfig = resolveFeatureConfig(current, feature);
      const next = mutate(current, currentConfig);
      setSettings(await saveSettings(next));
    },
    [feature, settings],
  );

  const toggleAi = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        if (!settings) return;
        const provider = resolveFeatureConfig(settings, feature).provider;
        try {
          const granted = await requestProviderHostPermission(provider);
          if (!granted) {
            setError({
              stateHash: baseline.stateHash,
              detail: {
                code: "PERMISSION_FAILURE",
                message: "AI access was not enabled.",
                safeDetail: `${provider === "anthropic" ? "Anthropic" : "OpenAI"} host access was not granted.`,
                suggestedAction:
                  "Turn AI on again and approve the provider access prompt.",
                retryable: true,
                diagnosticCode: "NS-PERMISSION",
              },
            });
            return;
          }
        } catch (caught) {
          setError({
            stateHash: baseline.stateHash,
            detail: safeRuntimeError(caught),
          });
          return;
        }
      }
      await updateSettings((current, currentConfig) => ({
        ...current,
        automaticAnalysis: enabled,
        aiFeatureOverrides: {
          ...current.aiFeatureOverrides,
          [feature]: {
            ...currentConfig,
            routingMode:
              enabled && currentConfig.routingMode === "off"
                ? "balanced"
                : currentConfig.routingMode,
          },
        },
      }));
      if (!enabled) {
        preparationRun.current += 1;
        setDecision(null);
        setPlayerContextStatus("pending");
        setPreparationStage("local_ready");
      }
    },
    [baseline.stateHash, feature, settings, updateSettings],
  );

  const updateConfig = useCallback(
    async (changes: Partial<AiFeatureConfig>) => {
      await updateSettings((current, currentConfig) => ({
        ...current,
        aiPreset: "custom",
        aiFeatureOverrides: {
          ...current.aiFeatureOverrides,
          [feature]: { ...currentConfig, ...changes },
        },
      }));
      setDecision(null);
      lastAutomaticHash.current = "";
    },
    [feature, updateSettings],
  );

  const boardTop = recommendations[0];
  if (!boardTop) return null;
  const top =
    context.draftStyle === "auction" &&
    context.auction?.currentNominationPlayerId
      ? (recommendations.find(
          (entry) =>
            entry.player.id === context.auction?.currentNominationPlayerId,
        ) ?? boardTop)
      : boardTop;
  const turnPair = optimizeTurnPair(recommendations, context);
  const auction =
    context.draftStyle === "auction"
      ? auctionRecommendation(context, format, top, riskTolerance)
      : null;
  const safeAlternative =
    recommendations.slice(1).find((entry) => entry.risk === "low") ??
    recommendations[1];
  const upsideAlternative =
    recommendations
      .slice(1, 8)
      .filter((entry) => entry.player.id !== safeAlternative?.player.id)
      .toSorted(
        (left, right) =>
          right.rawScore +
          right.valueOverReplacement -
          (left.rawScore + left.valueOverReplacement),
      )[0] ?? recommendations[2];
  const overlay = activeDecision?.overlay;
  const displayScore = Math.round(
    Math.max(
      0,
      Math.min(100, top.contextualScore + (overlay?.adjustment ?? 0)),
    ),
  );
  const visibleError =
    activeDecision?.aiStatus === "error"
      ? translateDraftError({
          code: "UNKNOWN",
          message: "AI analysis could not finish.",
          safeDetail: "The provider response was not applied.",
          suggestedAction: "Retry AI analysis.",
          retryable: true,
          diagnosticCode: "NS-UNKNOWN",
        })
      : error?.stateHash === baseline.stateHash
        ? translateDraftError(error.detail)
        : null;
  const aiWorking =
    aiEnabled &&
    (activeDecision?.aiStatus === "queued" ||
      visiblePreparationStage === "checking_context" ||
      visiblePreparationStage === "starting_ai" ||
      visiblePreparationStage === "synthesizing");
  const aiPresentationStatus = !aiEnabled
    ? "off"
    : (activeDecision?.aiStatus ?? (aiWorking ? "queued" : "local"));
  const playerContextStepState =
    !settings || !aiEnabled
      ? "off"
      : visiblePreparationStage === "local_ready"
        ? "pending"
        : visiblePreparationStage === "checking_context"
          ? "active"
          : "complete";
  const synthesisStepState =
    !settings || !aiEnabled
      ? "off"
      : activeDecision?.aiStatus === "ready"
        ? "complete"
        : aiWorking
          ? "active"
          : visibleError
            ? "error"
            : "pending";

  return (
    <article
      className="draft-copilot"
      data-draft-style={context.draftStyle}
      data-ai-status={aiPresentationStatus}
      data-ai-job-id={activeDecision?.jobId}
    >
      <header className="draft-copilot__header">
        <div>
          <Sparkles aria-hidden="true" />
          <span>
            <h2>{auction ? "Auction Copilot" : "Draft Copilot"}</h2>
            <small>
              {context.isUserOnClock
                ? "Your pick · Local answer stays available"
                : "Local answer now · AI context is bounded and optional"}
            </small>
          </span>
        </div>
        {!context.isUserOnClock ? (
          <label className="ai-switch">
            <span>AI analysis</span>
            <input
              id="draft-ai-analysis-toggle"
              type="checkbox"
              aria-label="Enable AI analysis"
              checked={aiEnabled}
              disabled={!settings}
              onChange={(event) => void toggleAi(event.target.checked)}
            />
            <i aria-hidden="true" />
          </label>
        ) : null}
      </header>

      {context.isUserOnClock ? (
        <section
          className="draft-copilot__turn-ai"
          aria-labelledby="draft-copilot-turn-ai-title"
        >
          <div
            className={`draft-copilot__turn-ai-status ${aiStatusClass(
              aiEnabled,
              activeDecision?.aiStatus,
              visiblePreparationStage,
            )}`}
            role="status"
            aria-live="polite"
          >
            {aiStatusIcon(
              aiEnabled,
              activeDecision?.aiStatus,
              visiblePreparationStage,
            )}
            <span>
              <strong id="draft-copilot-turn-ai-title">
                {settings
                  ? draftAiStatusLabel(
                      aiEnabled,
                      activeDecision?.aiStatus,
                      visiblePreparationStage,
                    )
                  : "Loading AI preference"}
              </strong>
              <small>
                {draftAiActivityLabel(
                  Boolean(settings),
                  aiEnabled,
                  activeDecision?.aiStatus,
                  visiblePreparationStage,
                  Math.min(8, candidates.length),
                  modelDisplayName(config?.model ?? "gpt-5.6-luna"),
                )}
              </small>
            </span>
          </div>
          <Button
            className="draft-copilot__turn-ai-toggle"
            variant={aiEnabled ? "secondary" : "primary"}
            size="small"
            role="switch"
            aria-checked={aiEnabled}
            aria-label={aiEnabled ? "Turn AI off" : "Turn AI on"}
            disabled={!settings}
            icon={<Bot aria-hidden="true" />}
            onClick={() => void toggleAi(!aiEnabled)}
          >
            {!settings ? "Loading AI" : aiEnabled ? "Turn off" : "Turn on"}
          </Button>
          <ol
            className="draft-copilot__turn-ai-steps"
            aria-label="On-clock AI activity"
          >
            <li data-state="complete">Board ready</li>
            <li data-state={playerContextStepState}>Player context</li>
            <li data-state={synthesisStepState}>
              {modelDisplayName(config?.model ?? "gpt-5.6-luna")}
            </li>
          </ol>
          <small className="draft-copilot__turn-ai-boundary">
            Local ranking remains available · AI never submits a pick
          </small>
        </section>
      ) : null}

      <section className="draft-copilot__primary">
        <div className="draft-copilot__identity">
          <PlayerAvatar player={top.player} size="large" priority />
          <div>
            <span className="draft-copilot__label">
              {auction
                ? context.auction?.currentNominationPlayerId
                  ? "Current nomination"
                  : "Nomination target"
                : context.isUserOnClock
                  ? "Pick now"
                  : "Top board recommendation"}
            </span>
            <div className="draft-copilot__name">
              <h1>{top.player.fullName}</h1>
              <PositionBadge position={top.player.position} />
            </div>
            <p>
              {top.player.team ?? "FA"} · {top.player.position}
              {(top.marketAdp ?? top.player.searchRank)
                ? ` · market rank ${top.marketAdp ?? top.player.searchRank}`
                : ""}
            </p>
            <div className="draft-copilot__badges">
              <TierBadge tier={top.tier} />
              <span>{Math.round(top.confidence * 100)}% confidence</span>
            </div>
          </div>
        </div>
        <div
          className="draft-copilot__score"
          aria-label={`Score ${displayScore} out of 100`}
        >
          <strong>{displayScore}</strong>
          <span>
            {auction
              ? "Value rating"
              : overlay
                ? "AI bounded"
                : "Local calibrated"}
          </span>
        </div>
        <div className="draft-copilot__availability">
          {auction ? (
            <>
              <strong>${auction.maximumRecommendedBid}</strong>
              <span>recommended ceiling · never bids automatically</span>
              <small>
                Value price ${auction.valuePrice} · legal max $
                {auction.maximumLegalBid} · ${auction.remainingBudget} budget
                left
              </small>
            </>
          ) : (
            <>
              <strong>
                {top.nextPickAvailabilityRange[0]}–
                {top.nextPickAvailabilityRange[1]}%
              </strong>
              <span>chance available at your next owned pick</span>
              <small>
                Point estimate {top.nextPickAvailability}% ·{" "}
                {confidenceLabel(top.nextPickConfidence)} confidence
              </small>
            </>
          )}
        </div>
      </section>

      <dl className="draft-copilot__glance" aria-label="Recommendation summary">
        <div>
          <dt>Position need</dt>
          <dd>
            <span>{capitalize(top.rosterFit)}</span>
            <small>{top.player.position} roster fit</small>
          </dd>
        </div>
        <div>
          <dt>Tier risk</dt>
          <dd>
            <span>
              {capitalize(top.risk)} · Tier {top.tier}
            </span>
            <small>{100 - top.nextPickAvailability}% pass risk</small>
          </dd>
        </div>
        <div>
          <dt>Next owned pick</dt>
          <dd>
            <span>
              {context.nextUserPick === undefined
                ? "Not linked"
                : formatOwnedPick(context.nextUserPick, format.teams)}
            </span>
            <small>
              {context.isUserOnClock
                ? "You are on the clock"
                : `${context.picksUntilUser ?? "—"} picks away`}
            </small>
          </dd>
        </div>
      </dl>

      <details className="draft-copilot__details">
        <summary>
          <span>More draft intelligence</span>
          <small>
            {draftAiStatusLabel(
              aiEnabled,
              activeDecision?.aiStatus,
              visiblePreparationStage,
            )}{" "}
            · {top.components.length} factors
          </small>
        </summary>
        <div className="draft-copilot__details-content">
          {turnPair ? <TurnPair plan={turnPair} teams={format.teams} /> : null}

          <dl className="draft-copilot__reasons">
            <InsightRow
              icon={<Target />}
              label="Why now"
              value={top.rationale}
            />
            <InsightRow
              icon={<ShieldCheck />}
              label="Roster impact"
              value={`${capitalize(top.rosterFit)} fit for this build; ${format.superflex && top.player.position === "QB" ? "quarterback demand receives the superflex premium." : "the score respects required starters and flex eligibility."}`}
            />
            <InsightRow
              icon={auction ? <BadgeDollarSign /> : <Users />}
              label={auction ? "Budget pressure" : "Opponent pressure"}
              value={
                auction
                  ? `$${auction.remainingBudget} remains for ${auction.rosterSpotsLeft} roster spots; reserve $${auction.reserveRequired} for legal minimum bids.`
                  : (top.nextPickFactors[0] ??
                    "Opponent selections are included in the survival model.")
              }
            />
            <InsightRow
              icon={<BarChart3 />}
              label={auction ? "Bid discipline" : "Board impact"}
              value={
                auction
                  ? `Modeled value is $${auction.valuePrice}; stop at $${auction.maximumRecommendedBid}, even though the legal maximum is $${auction.maximumLegalBid}.`
                  : `${top.components.find((part) => part.key === "scarcity")?.reason ?? "Tier depth is included."} Passing carries ${100 - top.nextPickAvailability}% point-estimate risk.`
              }
            />
          </dl>

          <section className="draft-copilot__ai" aria-live="polite">
            <div className="draft-copilot__ai-controls">
              <label>
                <span>Provider</span>
                <SleeperSelect
                  value={config?.provider ?? "openai"}
                  disabled={!aiEnabled}
                  onChange={(event) =>
                    void updateConfig({
                      provider: event.target
                        .value as AiFeatureConfig["provider"],
                    })
                  }
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </SleeperSelect>
              </label>
              <label>
                <span>Effort</span>
                <SleeperSelect
                  value={config?.reasoningEffort ?? "medium"}
                  disabled={!aiEnabled}
                  onChange={(event) =>
                    void updateConfig({
                      reasoningEffort: event.target
                        .value as AiFeatureConfig["reasoningEffort"],
                    })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="xhigh">X-high</option>
                </SleeperSelect>
              </label>
              <span className="draft-copilot__model">
                <small>Model</small>
                <strong>
                  {modelDisplayName(config?.model ?? "gpt-5.6-luna")}
                </strong>
              </span>
            </div>
            <div className="draft-copilot__ai-result">
              <header>
                <span
                  className={aiStatusClass(
                    aiEnabled,
                    activeDecision?.aiStatus,
                    visiblePreparationStage,
                  )}
                >
                  {aiStatusIcon(
                    aiEnabled,
                    activeDecision?.aiStatus,
                    visiblePreparationStage,
                  )}
                  {draftAiStatusLabel(
                    aiEnabled,
                    activeDecision?.aiStatus,
                    visiblePreparationStage,
                  )}
                </span>
                {aiEnabled && visibleError ? (
                  <button
                    type="button"
                    onClick={() => void run()}
                    disabled={activeDecision?.aiStatus === "queued"}
                  >
                    <RefreshCw aria-hidden="true" />
                    Retry
                  </button>
                ) : null}
              </header>
              {overlay ? (
                <>
                  <p>{overlay.summary}</p>
                  <small>
                    Bounded score adjustment{" "}
                    {overlay.adjustment >= 0 ? "+" : ""}
                    {overlay.adjustment.toFixed(1)} · recommendation legality
                    unchanged
                  </small>
                  <details>
                    <summary>
                      Sources & explainability · {overlay.evidenceUrls.length}{" "}
                      source
                      {overlay.evidenceUrls.length === 1 ? "" : "s"}
                    </summary>
                    <ul>
                      {overlay.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                      {overlay.evidenceUrls.map((url) => (
                        <li key={url}>
                          <SafeExternalLink url={url}>
                            {new URL(url).hostname}
                          </SafeExternalLink>
                        </li>
                      ))}
                      {overlay.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : aiWorking ? (
                <DraftAiProgress
                  stage={visiblePreparationStage}
                  candidateCount={Math.min(8, candidates.length)}
                  playerContextStatus={visiblePlayerContextStatus}
                />
              ) : aiEnabled ? (
                <p>
                  Automatic analysis starts as your turn approaches. The local
                  answer is ready now.
                </p>
              ) : (
                <p>
                  AI is off. Scores and recommendations remain fully local and
                  deterministic.
                </p>
              )}
              {visibleError ? (
                <div className="draft-copilot__safe-error" role="status">
                  <AlertTriangle aria-hidden="true" />
                  <span>
                    <strong>{visibleError.title}</strong>
                    <small>
                      {visibleError.detail} {visibleError.action}
                    </small>
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <section
            className="draft-copilot__alternatives"
            aria-label="Alternative recommendations"
          >
            {safeAlternative ? (
              <AlternativeCard
                kind="safe"
                recommendation={safeAlternative}
                auction={Boolean(auction)}
              />
            ) : null}
            {upsideAlternative ? (
              <AlternativeCard
                kind="upside"
                recommendation={upsideAlternative}
                auction={Boolean(auction)}
              />
            ) : null}
          </section>

          <p className="draft-copilot__risk">
            <AlertTriangle aria-hidden="true" />
            <span>
              <strong>Risk:</strong>{" "}
              {auction
                ? (auction.warning ??
                  `Do not exceed $${auction.maximumRecommendedBid}; preserve at least $${auction.reserveRequired} for the remaining roster.`)
                : (top.nextPickWarning ??
                  `Passing on ${top.player.fullName} leaves a ${100 - top.nextPickAvailability}% point-estimate chance that another manager selects them first.`)}
            </span>
          </p>

          <ScoreBreakdown
            localScore={top.normalizedScore}
            factors={top.components.map((component) => ({
              key: component.key,
              label: component.label,
              impact: component.value,
              note: component.reason,
            }))}
            {...(top.researchAdjustment !== 0
              ? { researchAdjustment: top.researchAdjustment, researchBound: 8 }
              : {})}
          />
        </div>
      </details>
    </article>
  );
}

function InsightRow({
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
      <dt>
        {icon}
        <span>{label}</span>
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function AlternativeCard({
  kind,
  recommendation,
  auction,
}: {
  kind: "safe" | "upside";
  recommendation: Recommendation;
  auction: boolean;
}) {
  return (
    <article>
      <span className="alternative-kind">
        {kind === "safe" ? <ShieldCheck /> : <Crosshair />}
        {kind === "safe" ? "Safe alternative" : "Upside alternative"}
      </span>
      <div>
        <PlayerAvatar player={recommendation.player} size="medium" />
        <span>
          <strong>{recommendation.player.fullName}</strong>
          <small>
            {recommendation.player.team ?? "FA"} ·{" "}
            {recommendation.player.position} · Tier {recommendation.tier}
          </small>
        </span>
        <b>{Math.round(recommendation.contextualScore)}</b>
      </div>
      <p>{recommendation.rationale}</p>
      <small>
        {auction ? (
          <>
            Nomination alternative · value score{" "}
            {Math.round(recommendation.normalizedScore)}
          </>
        ) : (
          <>
            {recommendation.nextPickAvailabilityRange[0]}–
            {recommendation.nextPickAvailabilityRange[1]}% at next pick
          </>
        )}
      </small>
    </article>
  );
}

function TurnPair({ plan, teams }: { plan: TurnPairPlan; teams: number }) {
  return (
    <section
      className="draft-copilot__turn-pair"
      aria-label="Best two-pick plan"
    >
      <header>
        <span>
          <Crosshair aria-hidden="true" /> Best two-pick plan
        </span>
        <small>
          {formatOwnedPick(plan.firstPickNumber, teams)} +{" "}
          {formatOwnedPick(plan.secondPickNumber, teams)} · combined{" "}
          {plan.combinedScore}
        </small>
      </header>
      <div>
        <article>
          <span>Pick A now</span>
          <PlayerAvatar player={plan.pickA.player} size="small" />
          <strong>{plan.pickA.player.fullName}</strong>
          <PositionBadge position={plan.pickA.player.position} />
        </article>
        <article>
          <span>Expected Pick B options</span>
          <p>
            {plan.pickBOptions
              .map((entry) => entry.player.fullName)
              .join(" · ")}
          </p>
        </article>
      </div>
      <small>{plan.reason}</small>
    </section>
  );
}

function auctionRecommendation(
  context: DraftContext,
  format: LeagueFormat,
  top: Recommendation,
  riskTolerance: number,
) {
  const initialBudget = context.auction?.initialBudget ?? 200;
  const minimumBid = context.auction?.minimumBid ?? 1;
  const rosterSpots =
    context.auction?.rosterSpots ??
    Math.max(
      1,
      Object.values(format.starters).reduce((sum, value) => sum + value, 0) +
        format.bench,
    );
  const filledSpots = context.auction?.filledSpots ?? 0;
  const remainingBudget = context.auction?.remainingBudget ?? initialBudget;
  const team = {
    rosterId: Number(context.rosterId ?? 0),
    budget: initialBudget,
    remainingBudget,
    rosterSpots,
    filledSpots,
    minimumBid,
  };
  const valuePrice = Math.max(
    minimumBid,
    Math.round((top.normalizedScore / 100) * initialBudget * 0.32),
  );
  const recommendation = recommendAuctionBid({
    team,
    player: {
      playerId: top.player.id,
      baselineValue: valuePrice,
      leagueAdjustedValue: valuePrice,
      rosterSpecificValue: Math.max(
        minimumBid,
        Math.round((top.contextualScore / 100) * initialBudget * 0.32),
      ),
    },
    inflation: 1,
    strategyAggression: riskTolerance,
  });
  return {
    ...recommendation,
    valuePrice,
    remainingBudget,
    rosterSpotsLeft: Math.max(0, rosterSpots - filledSpots),
    maximumLegalBid: maximumLegalBid(team),
  };
}

function formatOwnedPick(pick: number, teams: number): string {
  return `${Math.ceil(pick / teams)}.${String(((pick - 1) % teams) + 1).padStart(2, "0")}`;
}

export async function settleWithin<T>(
  promises: Promise<T>[],
  timeoutMs: number,
): Promise<PromiseSettledResult<T>[]> {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<PromiseSettledResult<T>[]>((resolve) => {
    timer = globalThis.setTimeout(() => resolve([]), timeoutMs);
  });
  try {
    return await Promise.race([Promise.allSettled(promises), timeout]);
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}

export function draftAiProgressLabel(
  stage: DraftAiPreparationStage,
  candidateCount: number,
): string {
  if (stage === "checking_context")
    return "Checking current Sleeper player context…";
  if (stage === "starting_ai") return "Starting bounded AI synthesis…";
  if (stage === "synthesizing") return "AI synthesis is running…";
  if (stage === "ready") return "Ready for your pick";
  if (stage === "fallback") return "Local recommendation remains ready";
  return `${candidateCount} candidates scored`;
}

export function draftAiStatusLabel(
  enabled: boolean,
  status: RealtimeDecision["aiStatus"] | undefined,
  stage: DraftAiPreparationStage,
): string {
  if (!enabled) return "AI off";
  if (
    status === "queued" ||
    stage === "checking_context" ||
    stage === "starting_ai" ||
    stage === "synthesizing"
  )
    return "AI working";
  if (status === "ready") return "AI ready";
  if (status === "error") return "Local fallback";
  if (status === "stale") return "Board changed · refreshing";
  return "Local ready · AI standing by";
}

export function draftAiActivityLabel(
  settingsReady: boolean,
  enabled: boolean,
  status: RealtimeDecision["aiStatus"] | undefined,
  stage: DraftAiPreparationStage,
  candidateCount: number,
  modelName = "Luna",
): string {
  if (!settingsReady) return "Loading your saved AI preference…";
  if (!enabled)
    return "Local recommendation is ready. Turn AI on for optional context.";
  if (status === "ready" || stage === "ready")
    return `${modelName} finished. Bounded context is included above.`;
  if (status === "error" || stage === "fallback")
    return `${modelName} could not finish. The verified local recommendation remains active.`;
  if (status === "stale")
    return "The board changed. Local rankings refreshed and AI is restarting.";
  if (stage === "checking_context")
    return `Checking current Sleeper status for ${candidateCount} legal players.`;
  if (stage === "starting_ai")
    return `Starting ${modelName} with this league, roster, and draft board.`;
  if (status === "queued" || stage === "synthesizing")
    return `${modelName} is comparing ${candidateCount} legal players now.`;
  return `Local recommendation is ready. ${modelName} will start automatically.`;
}

function DraftAiProgress({
  stage,
  candidateCount,
  playerContextStatus,
}: {
  stage: DraftAiPreparationStage;
  candidateCount: number;
  playerContextStatus: "pending" | "available" | "unavailable";
}) {
  const contextReady = !["checking_context", "local_ready"].includes(stage);
  const synthesisStarted = ["synthesizing", "ready"].includes(stage);
  return (
    <div
      className="draft-copilot__progress"
      aria-label="AI preparation progress"
    >
      <p>{draftAiProgressLabel(stage, candidateCount)}</p>
      <ul>
        <li data-state="complete">Board synced</li>
        <li data-state="complete">{candidateCount} candidates scored</li>
        <li data-state={contextReady ? "complete" : "active"}>
          {playerContextStatus === "available"
            ? "Sleeper player context checked"
            : playerContextStatus === "unavailable"
              ? "Sleeper player context unavailable"
              : "Checking Sleeper player context"}
        </li>
        <li data-state="complete">Next-pick scenarios ready</li>
        <li data-state={synthesisStarted ? "active" : "pending"}>
          AI synthesis {synthesisStarted ? "running" : "queued"}
        </li>
      </ul>
    </div>
  );
}

function aiStatusClass(
  enabled: boolean,
  status: RealtimeDecision["aiStatus"] | undefined,
  stage: DraftAiPreparationStage,
): string {
  if (!enabled) return "is-off";
  if (status === "ready") return "is-ready";
  if (
    status === "queued" ||
    stage === "checking_context" ||
    stage === "starting_ai" ||
    stage === "synthesizing"
  )
    return "is-working";
  if (status === "error") return "is-error";
  return "is-local";
}

function aiStatusIcon(
  enabled: boolean,
  status: RealtimeDecision["aiStatus"] | undefined,
  stage: DraftAiPreparationStage,
) {
  if (enabled && status === "ready") return <CheckCircle2 aria-hidden="true" />;
  if (enabled && stage === "fallback")
    return <AlertTriangle aria-hidden="true" />;
  return <Bot aria-hidden="true" />;
}

function confidenceLabel(value: number): string {
  if (value >= 0.72) return "high";
  if (value >= 0.52) return "medium";
  return "low";
}

function modelDisplayName(model: string): string {
  return model === "gpt-5.6-luna" ? "Luna" : model;
}

function sessionLabel(kind: DraftContext["sessionKind"]): string {
  return kind.replaceAll("_", " ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
