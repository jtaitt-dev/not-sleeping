import { z } from "zod";

const boundedText = z.string().max(4000);
const shortText = z.string().max(600);

export const sourceCitationSchema = z.object({
  id: z.string().max(200),
  title: z.string().max(500),
  publisher: z.string().max(200),
  url: z.url().max(2048),
  publicationDate: z.string().max(40).optional(),
  accessedAt: z.number().int(),
  claims: z.array(shortText).max(20),
});

export const dataConflictSchema = z.object({
  topic: z.string().max(200),
  claims: z.array(shortText).min(2).max(10),
  sourceIds: z.array(z.string().max(200)).min(2).max(10),
  resolution: shortText.optional(),
});

export const scoreAdjustmentSchema = z.object({
  playerId: z.string().max(100),
  originalScore: z.number().min(0).max(100),
  adjustment: z.number().min(-8).max(8),
  adjustedComponents: z.array(
    z.object({
      component: z.string().max(100),
      adjustment: z.number().min(-8).max(8),
    }),
  ),
  reason: shortText,
  confidence: z.number().min(0).max(1),
  citationIds: z.array(z.string().max(200)).max(20),
  researchedAt: z.number().int(),
  expiresAt: z.number().int(),
  conflictingEvidence: z.array(shortText).max(20),
});

export const draftRecommendationSchema = z.object({
  playerId: z.string().max(100),
  rank: z.number().int().min(1).max(100),
  shortRationale: shortText,
  confidence: z.number().min(0).max(1),
  risks: z.array(shortText).max(10),
  citationIds: z.array(z.string().max(200)).max(20),
});

export const recommendationListSchema = z.object({
  recommendations: z.array(draftRecommendationSchema).min(1).max(10),
  generatedAt: z.number().int(),
});

export const playerResearchSchema = z.object({
  playerId: z.string().max(100),
  searchContext: shortText,
  researchedAt: z.number().int(),
  currentTeam: z.string().max(20).optional(),
  currentRole: boundedText,
  depthChart: z.array(shortText).max(20),
  injuryStatus: shortText,
  recentUpdates: z.array(shortText).max(20),
  transactions: z.array(shortText).max(20),
  contractContext: boundedText.optional(),
  schemeContext: boundedText,
  recentPerformance: boundedText,
  redraftOutlook: boundedText,
  dynastyOutlook: boundedText,
  rookieOutlook: boundedText.optional(),
  contenderFit: boundedText,
  rebuilderFit: boundedText,
  bullCase: z.array(shortText).max(12),
  bearCase: z.array(shortText).max(12),
  riskFactors: z.array(shortText).max(16),
  conflictingReports: z.array(shortText).max(16),
  unknownFacts: z.array(shortText).max(16),
  confidence: z.number().min(0).max(1),
  citations: z.array(sourceCitationSchema).max(30),
  conflicts: z.array(dataConflictSchema).max(20),
});

const winnerSchema = z.object({
  playerId: z.string().max(100),
  reason: boundedText,
  confidence: z.number().min(0).max(1),
});

export const playerComparisonSchema = z.object({
  deterministicWinner: winnerSchema,
  strategyWinner: winnerSchema,
  cases: z.array(
    z.object({
      playerId: z.string().max(100),
      case: boundedText,
    }),
  ),
  reversalConditions: z.array(shortText).max(20),
  citationIds: z.array(z.string().max(200)).max(30),
});

export const rosterAnalysisSchema = z.object({
  strengths: z.array(shortText).max(20),
  weaknesses: z.array(shortText).max(20),
  fragilePositions: z.array(shortText).max(20),
  surplusPositions: z.array(shortText).max(20),
  breakoutCandidates: z.array(z.string().max(100)).max(20),
  sellHighCandidates: z.array(z.string().max(100)).max(20),
  buyLowCandidates: z.array(z.string().max(100)).max(20),
  confidence: z.number().min(0).max(1),
  citationIds: z.array(z.string().max(200)).max(30),
});

export const dynastyStrategySchema = z.object({
  direction: z.enum([
    "contender",
    "balanced",
    "productive_struggle",
    "rebuild",
  ]),
  rationale: boundedText,
  strategyConflicts: z.array(shortText).max(20),
  assetsToShop: z.array(z.string().max(100)).max(20),
  positionsToTarget: z.array(z.string().max(50)).max(20),
  decisionPoints: z.array(shortText).max(20),
  confidence: z.number().min(0).max(1),
  citationIds: z.array(z.string().max(200)).max(30),
});

export const tradeAnalysisSchema = z.object({
  recommendation: boundedText,
  conditions: z.array(shortText).max(20),
  riskTransfer: boundedText,
  strategyFit: boundedText,
  confidence: z.number().min(0).max(1),
  citationIds: z.array(z.string().max(200)).max(30),
});

export const modelCapabilitySchema = z.object({
  modelId: z.string().max(120),
  structuredOutput: z.boolean(),
  webSearch: z.boolean(),
  reasoning: z.boolean(),
  warnings: z.array(shortText).max(10),
});

export const openAIResponseSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    created_at: z.number().optional(),
    status: z.string().optional(),
    model: z.string().optional(),
    output: z.array(z.unknown()).default([]),
    output_text: z.string().optional(),
    usage: z
      .object({
        input_tokens: z.number().int().default(0),
        output_tokens: z.number().int().default(0),
        total_tokens: z.number().int().default(0),
      })
      .optional(),
    error: z
      .object({
        code: z.string().nullable().optional(),
        message: z.string(),
        type: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .loose();

export const openAIModelsSchema = z.object({
  object: z.literal("list"),
  data: z.array(
    z
      .object({
        id: z.string(),
        object: z.string(),
        created: z.number().int(),
        owned_by: z.string(),
      })
      .loose(),
  ),
});

export type PlayerResearchOutput = z.infer<typeof playerResearchSchema>;
export type OpenAIResponse = z.infer<typeof openAIResponseSchema>;
