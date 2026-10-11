import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { newTest, signedInUser, type TestConvex } from "./test.helpers";

type User = Awaited<ReturnType<typeof signedInUser>>;

async function listWith(user: User, titles: string[], mode: "ranked" | "tiered" | "unranked" = "ranked") {
  const listId = await user.mutation(api.lists.create, { name: "Movies", emoji: "🎬", mode });
  const ids: Id<"items">[] = [];
  for (const title of titles) ids.push(await user.mutation(api.items.create, { listId, title }));
  return { listId, ids };
}

async function titles(user: User, listId: Id<"lists">) {
  return (await user.query(api.items.byList, { listId }))!.map((i) => i.title);
}

async function rows(t: TestConvex, listId: Id<"lists">) {
  return t.run((ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_list", (q) => q.eq("listId", listId))
      .collect(),
  );
}

describe("allowlist", () => {
  test("is read case-insensitively from ALLOWED_EMAILS", async () => {
    newTest();
    const { isAllowedEmail } = await import("./lib/allowlist");
    expect(isAllowedEmail("bob@example.com")).toBe(true);
    expect(isAllowedEmail(" ALICE@example.com ")).toBe(true);
    expect(isAllowedEmail("mallory@example.com")).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
  });

  test("a signed-in user whose email isn't allowed is refused", async () => {
    const t = newTest();
    const mallory = await signedInUser(t, "mallory@example.com");
    await expect(mallory.query(api.lists.mine, {})).rejects.toThrow("allowlist");
    await expect(mallory.mutation(api.lists.create, { name: "x", emoji: "", mode: "ranked" })).rejects.toThrow("allowlist");
  });

  test("removing an email cuts off an existing session", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    expect(await alice.query(api.lists.mine, {})).toEqual([]);
    vi.stubEnv("ALLOWED_EMAILS", "bob@example.com");
    await expect(alice.query(api.lists.mine, {})).rejects.toThrow("allowlist");
  });
});

describe("ownership", () => {
  test("signed-out callers are refused", async () => {
    const t = newTest();
    await expect(t.query(api.lists.mine, {})).rejects.toThrow("Not signed in");
  });

  test("users only see and change their own lists", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const bob = await signedInUser(t, "bob@example.com");
    const { listId, ids } = await listWith(alice, ["Heat"]);
    expect(await bob.query(api.lists.mine, {})).toEqual([]);
    expect(await bob.query(api.lists.get, { id: listId })).toBeNull();
    expect(await bob.query(api.items.byList, { listId })).toBeNull();
    await expect(bob.mutation(api.items.update, { id: ids[0], title: "x" })).rejects.toThrow("List not found");
    await expect(bob.mutation(api.lists.remove, { id: listId })).rejects.toThrow("List not found");
  });
});

describe("lists", () => {
  test("home shows count and the top three in mode order", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { ids } = await listWith(alice, ["A", "B", "C", "D"]);
    await alice.mutation(api.items.moveRanked, { id: ids[3], toIndex: 0 });
    const [list] = await alice.query(api.lists.mine, {});
    expect(list.count).toBe(4);
    expect(list.preview).toEqual(["D", "A", "B"]);
  });

  test("deleting a list deletes its items", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { listId } = await listWith(alice, ["A", "B"]);
    await alice.mutation(api.lists.remove, { id: listId });
    expect(await rows(t, listId)).toEqual([]);
  });
});

describe("items", () => {
  test("fields are trimmed, empty optionals dropped, tags deduplicated", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { listId } = await listWith(alice, []);
    await alice.mutation(api.items.create, { listId, title: "  Heat ", note: " ", tags: ["Crime", "crime ", ""] });
    const [item] = (await alice.query(api.items.byList, { listId }))!;
    expect(item).toMatchObject({ title: "Heat", tags: ["crime"] });
    expect(item).not.toHaveProperty("note");
    await expect(alice.mutation(api.items.create, { listId, title: " " })).rejects.toThrow("Title");
  });
});

describe("ranked order", () => {
  test("moving renumbers positions 0..N-1", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { listId, ids } = await listWith(alice, ["A", "B", "C", "D"]);
    await alice.mutation(api.items.moveRanked, { id: ids[0], toIndex: 2 });
    expect(await titles(alice, listId)).toEqual(["B", "C", "A", "D"]);
    await alice.mutation(api.items.moveRanked, { id: ids[3], toIndex: 0 });
    expect(await titles(alice, listId)).toEqual(["D", "B", "C", "A"]);
    const positions = (await rows(t, listId)).map((r) => r.position).sort();
    expect(positions).toEqual([0, 1, 2, 3]);
  });

  test("deleting closes the gap", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { listId, ids } = await listWith(alice, ["A", "B", "C"]);
    await alice.mutation(api.items.remove, { id: ids[0] });
    const r = await rows(t, listId);
    expect(r.map((i) => [i.title, i.position])).toEqual([
      ["B", 0],
      ["C", 1],
    ]);
  });
});

describe("tiers", () => {
  test("moving between tiers keeps both tiers numbered", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { listId, ids } = await listWith(alice, ["A", "B", "C"], "tiered");
    await alice.mutation(api.items.moveTiered, { id: ids[1], tier: 0, toIndex: 0 });
    await alice.mutation(api.items.moveTiered, { id: ids[2], tier: 0, toIndex: 0 });
    expect(await titles(alice, listId)).toEqual(["C", "B", "A"]);
    const r = await rows(t, listId);
    const of = (title: string) => r.find((i) => i.title === title)!;
    expect([of("C").tier, of("C").tierPosition]).toEqual([0, 0]);
    expect([of("B").tier, of("B").tierPosition]).toEqual([0, 1]);
    expect([of("A").tier, of("A").tierPosition]).toEqual([undefined, 0]);
    await alice.mutation(api.items.moveTiered, { id: ids[2], tier: 0, toIndex: 5 });
    expect(await titles(alice, listId)).toEqual(["B", "C", "A"]);
  });

  test("switching mode keeps the ranked order", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { listId, ids } = await listWith(alice, ["A", "B"]);
    await alice.mutation(api.items.moveRanked, { id: ids[1], toIndex: 0 });
    await alice.mutation(api.lists.update, { id: listId, mode: "tiered" });
    await alice.mutation(api.items.moveTiered, { id: ids[0], tier: 1, toIndex: 0 });
    await alice.mutation(api.lists.update, { id: listId, mode: "ranked" });
    expect(await titles(alice, listId)).toEqual(["B", "A"]);
  });

  test("removing a tier sends its items to unplaced and shifts later tiers", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { listId, ids } = await listWith(alice, ["A", "B", "C"], "tiered");
    await alice.mutation(api.items.moveTiered, { id: ids[0], tier: 0, toIndex: 0 });
    await alice.mutation(api.items.moveTiered, { id: ids[1], tier: 1, toIndex: 0 });
    await alice.mutation(api.lists.removeTier, { id: listId, index: 0 });
    const r = await rows(t, listId);
    const of = (title: string) => r.find((i) => i.title === title)!;
    expect([of("A").tier, of("A").tierPosition]).toEqual([undefined, 1]);
    expect(of("B").tier).toBe(0);
    expect((await alice.query(api.lists.get, { id: listId }))!.tiers).toEqual(["A", "B", "C", "D"]);
  });
});
