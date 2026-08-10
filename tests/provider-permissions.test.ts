import {
  providerHostOrigin,
  requestProviderHostPermission,
} from "@/services/intelligence/provider-permissions";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI provider permissions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps each provider to its narrow optional host origin", () => {
    expect(providerHostOrigin("openai")).toBe("https://api.openai.com/*");
    expect(providerHostOrigin("anthropic")).toBe("https://api.anthropic.com/*");
  });

  it("requests access for the selected provider from the user gesture", async () => {
    const request = vi.fn(async () => true);
    vi.stubGlobal("chrome", { permissions: { request } });

    await expect(requestProviderHostPermission("openai")).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({
      origins: ["https://api.openai.com/*"],
    });
  });

  it("fails closed outside an extension permission context", async () => {
    vi.stubGlobal("chrome", undefined);
    await expect(requestProviderHostPermission("openai")).resolves.toBe(false);
  });
});
