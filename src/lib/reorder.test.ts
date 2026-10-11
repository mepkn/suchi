import { describe, expect, test } from "vitest";
import { applyRankedMove, applyTieredMove } from "./reorder";
import type { Item } from "./types";

const item = (id: string, position: number, tier?: number, tierPosition = position) =>
  ({ _id: id, title: id, position, tier, tierPosition }) as unknown as Item;

describe("optimistic reorder", () => {
  test("ranked move renumbers", () => {
    const out = applyRankedMove([item("a", 0), item("b", 1), item("c", 2)], "c" as Item["_id"], 0);
    expect(out.map((i) => [i._id, i.position])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  test("tier move closes the old gap and opens the new one", () => {
    const items = [item("a", 0, 0, 0), item("b", 1, 0, 1), item("c", 2, undefined, 0)];
    const out = applyTieredMove(items, "a" as Item["_id"], null, 1);
    expect(out.map((i) => [i._id, i.tier, i.tierPosition])).toEqual([
      ["b", 0, 0],
      ["c", undefined, 0],
      ["a", undefined, 1],
    ]);
  });
});
