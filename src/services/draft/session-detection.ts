import type { SleeperDraft } from "@/schemas/sleeper";
import type { DraftSessionKind } from "@/types/domain";

export type DraftSessionDetection = {
  kind: DraftSessionKind;
  confidence: number;
  evidence: string[];
  sourceLeagueId?: string;
  overridden: boolean;
};

export function detectDraftSession(input: {
  draft: SleeperDraft;
  routeUrl?: string;
  override?: DraftSessionKind;
}): DraftSessionDetection {
  const sourceLeagueId =
    cleanId(input.draft.league_id) ??
    cleanId(input.draft.metadata["league_id"]) ??
    cleanId(input.draft.metadata["source_league_id"]);
  if (input.override) {
    return {
      kind: input.override,
      confidence: 1,
      evidence: ["Saved correction for this draft"],
      ...(sourceLeagueId ? { sourceLeagueId } : {}),
      overridden: true,
    };
  }

  const route = (input.routeUrl ?? "").toLowerCase();
  const name = cleanText(input.draft.metadata["name"]).toLowerCase();
  const purpose = cleanText(input.draft.metadata["draft_type"]).toLowerCase();
  const explicitLeagueId = cleanId(input.draft.league_id);
  const metadataLeagueId =
    cleanId(input.draft.metadata["league_id"]) ??
    cleanId(input.draft.metadata["source_league_id"]);
  const mockSignals = [
    route.includes("mock-draft") || route.includes("mockdraft"),
    name.includes("mock") || purpose.includes("mock"),
    input.draft.settings["cpu_autopick"] === 1,
  ];
  const mockSignalCount = mockSignals.filter(Boolean).length;

  if (explicitLeagueId) {
    return {
      kind: "league_draft",
      confidence: mockSignalCount > 0 ? 0.78 : 0.97,
      evidence: [
        "Sleeper attached the draft directly to a league",
        ...(mockSignalCount > 0
          ? [
              "A secondary mock signal was present but did not replace the direct league link",
            ]
          : []),
      ],
      sourceLeagueId: explicitLeagueId,
      overridden: false,
    };
  }

  if (metadataLeagueId) {
    return {
      kind: "league_mock",
      confidence: mockSignalCount > 0 ? 0.96 : 0.88,
      evidence: [
        "Sleeper supplied a source league in draft metadata",
        ...(mockSignalCount > 0
          ? ["The draft route or metadata identifies a mock"]
          : []),
      ],
      sourceLeagueId: metadataLeagueId,
      overridden: false,
    };
  }

  if (mockSignalCount > 0 || (input.draft.creators?.length ?? 0) > 0) {
    return {
      kind: "standalone_mock",
      confidence: mockSignalCount > 1 ? 0.94 : 0.82,
      evidence: [
        mockSignalCount > 0
          ? "The draft route or metadata identifies a mock"
          : "Sleeper supplied mock-draft creators without a league link",
        "No source league was attached",
      ],
      overridden: false,
    };
  }

  return {
    kind: "unknown",
    confidence: 0.35,
    evidence: [
      "Sleeper did not provide enough stable signals to classify this session",
    ],
    overridden: false,
  };
}

function cleanId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
