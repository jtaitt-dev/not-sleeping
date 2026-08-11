import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup } from "@testing-library/react";

import { afterEach, vi } from "vitest";

Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: webcrypto,
});

Object.defineProperty(globalThis.navigator, "onLine", {
  configurable: true,
  value: true,
});

Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    runtime: {
      id: "not-sleeping-test",
      getManifest: () => ({ version: "0.1.0" }),
      sendMessage: vi.fn(),
      openOptionsPage: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
        setAccessLevel: vi.fn(async () => undefined),
      },
      session: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
        setAccessLevel: vi.fn(async () => undefined),
      },
    },
  },
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
