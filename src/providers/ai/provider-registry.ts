import { AppError } from "@/services/errors/app-error";
import type { AiProviderId } from "@/types/domain";

import type { AiProvider } from "./types";

export class AiProviderRegistry {
  private readonly providers = new Map<AiProviderId, AiProvider>();

  constructor(providers: AiProvider[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: AiProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: AiProviderId): AiProvider {
    const provider = this.providers.get(id);
    if (provider) return provider;
    throw new AppError({
      code: "UNSUPPORTED_MODEL",
      message: "The selected AI provider is unavailable.",
      safeDetail: `No provider adapter is registered for ${id}.`,
      suggestedAction: "Choose a configured provider in AI settings.",
      retryable: false,
    });
  }

  list(): AiProvider[] {
    return [...this.providers.values()];
  }
}
