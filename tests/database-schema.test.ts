import { db } from "@/services/cache/database";
import { describe, expect, it } from "vitest";

describe("NotSleepingDatabase", () => {
  it("indexes every field used to order the live player pool", () => {
    expect(db.players.schema.indexes.map((index) => index.name)).toContain(
      "searchRank",
    );
  });
});
