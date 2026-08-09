import type { AiProviderId, ModelCapability } from "@/types/domain";

export const LUNA_MODEL_ID = "gpt-5.6-luna";

export type ResolvedModelSelection = {
  provider: AiProviderId;
  model: string;
  requestedProvider: AiProviderId;
  requestedModel: string;
  fallbackUsed: boolean;
};

export function isModelIdentifierShapeValid(
  provider: AiProviderId,
  model: unknown,
): model is string {
  if (typeof model !== "string" || model.length > 160) return false;
  if (provider === "openai") {
    return /^(?:gpt-|o\d|chatgpt-)[a-z0-9._:-]+$/i.test(model);
  }
  return /^claude-[a-z0-9._:-]+$/i.test(model);
}

export function resolveAvailableModelSelection(input: {
  requestedProvider: AiProviderId;
  requestedModel: string;
  requestedModels: ModelCapability[];
  lunaModels?: ModelCapability[];
}): ResolvedModelSelection | null {
  if (
    isModelIdentifierShapeValid(
      input.requestedProvider,
      input.requestedModel,
    ) &&
    input.requestedModels.some(
      (model) =>
        model.provider === input.requestedProvider &&
        model.id === input.requestedModel,
    )
  ) {
    return {
      provider: input.requestedProvider,
      model: input.requestedModel,
      requestedProvider: input.requestedProvider,
      requestedModel: input.requestedModel,
      fallbackUsed: false,
    };
  }

  const luna = input.lunaModels?.find(
    (model) => model.provider === "openai" && model.id === LUNA_MODEL_ID,
  );
  return luna
    ? {
        provider: "openai",
        model: LUNA_MODEL_ID,
        requestedProvider: input.requestedProvider,
        requestedModel: input.requestedModel,
        fallbackUsed: true,
      }
    : null;
}
