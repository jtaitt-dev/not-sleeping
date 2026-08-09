import { db } from "@/services/cache/database";
import { leagueRecordId } from "@/services/league/league-service";
import { describe, expect, it } from "vitest";

describe("NotSleepingDatabase", () => {
  it("indexes every field used to order the live player pool", () => {
    expect(db.players.schema.indexes.map((index) => index.name)).toContain(
      "searchRank",
    );
  });

  it("uses the account-scoped v5 league and workspace indexes", () => {
    expect(db.verno).toBe(5);
    expect(db.leagues.schema.primKey.name).toBe("id");
    expect(db.leagues.schema.indexes.map((index) => index.name)).toContain(
      "[userId+leagueId]",
    );
    expect(
      db.leagueWorkspaces.schema.indexes.map((index) => index.name),
    ).toContain("[userId+leagueId+season]");
  });

  it("builds injective league keys across account and league boundaries", () => {
    expect(leagueRecordId("account:one", "league")).not.toBe(
      leagueRecordId("account", "one:league"),
    );
  });
});
