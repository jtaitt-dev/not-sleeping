import { describe, expect, it } from "vitest";

import {
  assertSleeperRequestIsReadOnly,
  sleeperReadOnlyRequest,
} from "@/providers/sleeper/read-only-boundary";

describe("Sleeper public read-only boundary", () => {
  it("creates credential-free GET requests for the public API", () => {
    const url = "https://api.sleeper.app/v1/league/123/rosters";
    const init = sleeperReadOnlyRequest(url);
    expect(init).toMatchObject({
      method: "GET",
      credentials: "omit",
      redirect: "error",
    });
    expect(() => assertSleeperRequestIsReadOnly(url, init)).not.toThrow();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "blocks %s mutations before fetch",
    (method) => {
      expect(() =>
        assertSleeperRequestIsReadOnly(
          "https://api.sleeper.app/v1/draft/123/picks",
          { method },
        ),
      ).toThrow("blocked");
    },
  );

  it("blocks credentials, bodies, private hosts, and unknown paths", () => {
    expect(() =>
      assertSleeperRequestIsReadOnly("https://api.sleeper.app/v1/league/123", {
        method: "GET",
        credentials: "include",
      }),
    ).toThrow("blocked");
    expect(() =>
      assertSleeperRequestIsReadOnly("https://api.sleeper.app/v1/league/123", {
        method: "GET",
        body: "{}",
      }),
    ).toThrow("blocked");
    expect(() =>
      sleeperReadOnlyRequest("https://sleeper.com/api/private"),
    ).toThrow("blocked");
    expect(() =>
      sleeperReadOnlyRequest("https://api.sleeper.app/private/league"),
    ).toThrow("blocked");
  });
});
