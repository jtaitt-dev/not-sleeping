import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@/services/storage/settings";
import type { AppSettings } from "@/types/domain";
import { discoverSleeperAccount } from "@/services/account/sleeper-account-discovery";
import {
  findSignedInSleeperUsername,
  normalizeSleeperUsername,
  observeSignedInSleeperUsername,
} from "@/services/context/sleeper-identity";

describe("signed-in Sleeper identity detection", () => {
  it("reads only the navigation profile and ignores roster names", () => {
    document.body.innerHTML = `
      <div class="roster"><div class="name">wrong-roster-user</div></div>
      <div class="nav-profile-item">
        <div class="profile-wrapper">
          <div class="name-container"><div class="name"> signed_in_user </div></div>
        </div>
      </div>`;

    expect(findSignedInSleeperUsername()).toBe("signed_in_user");
    document.querySelector(".nav-profile-item")?.remove();
    expect(findSignedInSleeperUsername()).toBeNull();
  });

  it("rejects whitespace, control characters, and oversized names", () => {
    expect(normalizeSleeperUsername("valid_name-1")).toBe("valid_name-1");
    expect(normalizeSleeperUsername("not a username")).toBeNull();
    expect(normalizeSleeperUsername("bad\u0000name")).toBeNull();
    expect(normalizeSleeperUsername("x".repeat(65))).toBeNull();
  });

  it("detects a profile rendered after the content script starts", async () => {
    document.body.innerHTML = "<main>Sleeper</main>";
    const onUsername = vi.fn();
    const stop = observeSignedInSleeperUsername(onUsername);

    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="nav-profile-item"><div class="name">late_user</div></div>',
    );
    await vi.waitFor(() =>
      expect(onUsername).toHaveBeenCalledWith("late_user"),
    );
    document
      .querySelector(".nav-profile-item .name")
      ?.replaceChildren("late_user");
    await Promise.resolve();
    expect(onUsername).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe("automatic Sleeper account sync", () => {
  it("resolves the stable user id, syncs leagues, then saves the account", async () => {
    const calls: string[] = [];
    const saveSettings = vi.fn(async (settings: AppSettings) => {
      calls.push("save");
      return settings;
    });
    const syncCatalog = vi.fn(async () => {
      calls.push("sync");
      return [];
    });

    await expect(
      discoverSleeperAccount("signed_in_user", {
        getUser: vi.fn(async () => {
          calls.push("resolve");
          return {
            user_id: "fixture-user-id",
            username: "Signed_In_User",
          };
        }),
        getSettings: vi.fn(async () => DEFAULT_SETTINGS),
        saveSettings,
        resolveSyncWindow: vi.fn(async () => ({
          seasons: ["2026", "2025"],
          week: 1,
        })),
        syncCatalog,
      }),
    ).resolves.toEqual({
      username: "Signed_In_User",
      userId: "fixture-user-id",
      leagueCount: 0,
    });

    expect(syncCatalog).toHaveBeenCalledWith({
      userId: "fixture-user-id",
      seasons: ["2026", "2025"],
      week: 1,
    });
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        sleeperUsername: "Signed_In_User",
        sleeperUserId: "fixture-user-id",
      }),
    );
    expect(calls).toEqual(["resolve", "sync", "save"]);
  });

  it("does not publish a half-connected account when league sync fails", async () => {
    const saveSettings = vi.fn(async (settings: AppSettings) => settings);
    await expect(
      discoverSleeperAccount("user", {
        getUser: vi.fn(async () => ({ user_id: "1234", username: "user" })),
        getSettings: vi.fn(async () => DEFAULT_SETTINGS),
        saveSettings,
        resolveSyncWindow: vi.fn(async () => ({
          seasons: ["2026"],
          week: 1,
        })),
        syncCatalog: vi.fn(async () => {
          throw new Error("offline");
        }),
      }),
    ).rejects.toMatchObject({
      code: "INDEXED_DB_FAILURE",
      safeDetail: "Automatic account discovery failed during sync (Error).",
    });
    expect(saveSettings).not.toHaveBeenCalled();
  });
});
