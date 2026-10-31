/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { checkInput, secretMatches } from "./lib/kunji";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "kjs_test-secret";
const ME = "me@example.com";

beforeEach(() => {
  vi.stubEnv("KUNJI_SECRET", SECRET);
  vi.stubEnv("ALLOWED_EMAILS", `${ME},stranger@example.com`);
});
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: ME, emailVerificationTime: 1 });
    // An unverified sign-up with someone else's email must never count.
    await ctx.db.insert("users", { email: "other@example.com" });
    const strangerId = await ctx.db.insert("users", { email: "stranger@example.com", emailVerificationTime: 1 });
    const tiers = ["S", "A", "B"];
    const movies = await ctx.db.insert("lists", { userId, name: "Movies", emoji: "🎬", mode: "ranked", tiers });
    const games = await ctx.db.insert("lists", { userId, name: "Games", emoji: "🎮", mode: "tiered", tiers });
    const foreign = await ctx.db.insert("lists", { userId: strangerId, name: "Movies", emoji: "🎬", mode: "ranked", tiers });
    const item = (listId: typeof movies, title: string, position: number, extra: object = {}) =>
      ctx.db.insert("items", { listId, title, tags: [], position, tierPosition: position, done: false, ...extra });
    await item(movies, "Heat", 1, { done: true });
    await item(movies, "Alien", 0, { note: "the original", url: "https://example.com/alien", tags: ["sci-fi"] });
    await item(movies, "Up", 2);
    await item(games, "Tetris", 0, { tier: 1 });
    await item(games, "Portal", 0, { tier: 0 });
    await item(games, "Pong", 0);
    await item(foreign, "Secret", 0);
    return { movies, foreign };
  });
  return { t, ...ids };
}

const post = (body: unknown, secret = SECRET) => ({
  method: "POST",
  headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

type T = Awaited<ReturnType<typeof setup>>["t"];
async function call(t: T, tool: string, input: unknown = {}, userEmail = ME) {
  const res = await t.fetch("/kunji/call", post({ tool, input, userEmail }));
  expect(res.status).toBe(200);
  return await res.json();
}

const titles = (items: { title: string }[]) => items.map((i) => i.title);

describe("secret check", () => {
  it("compares exactly", async () => {
    expect(await secretMatches(SECRET, SECRET)).toBe(true);
    expect(await secretMatches(SECRET + "x", SECRET)).toBe(false);
    expect(await secretMatches("", "")).toBe(false);
  });

  it.each([
    ["GET", "/kunji/tools"],
    ["POST", "/kunji/access"],
    ["POST", "/kunji/call"],
  ])("%s %s refuses a wrong or missing secret", async (method, path) => {
    const { t } = await setup();
    const body = method === "POST" ? JSON.stringify({ userEmail: ME, tool: "list_lists" }) : undefined;
    expect((await t.fetch(path, { method, headers: { Authorization: "Bearer nope" }, body })).status).toBe(401);
    expect((await t.fetch(path, { method, body })).status).toBe(401);
  });

  it("refuses everything when KUNJI_SECRET is unset", async () => {
    vi.stubEnv("KUNJI_SECRET", "");
    const { t } = await setup();
    expect((await t.fetch("/kunji/tools", { headers: { Authorization: "Bearer " } })).status).toBe(401);
  });
});

describe("checkInput", () => {
  it("checks required keys, types and unknown fields", () => {
    const schema = {
      type: "object" as const,
      properties: { q: { type: "string" as const }, n: { type: "integer" as const } },
      required: ["q"],
      additionalProperties: false as const,
    };
    expect(checkInput(schema, { q: "x", n: 2 })).toBeNull();
    expect(checkInput(schema, {})).toBe('Missing "q".');
    expect(checkInput(schema, { q: "x", n: 1.5 })).toBe('"n" must be an integer.');
    expect(checkInput(schema, { q: "x", z: 1 })).toBe('Unknown field "z".');
    expect(checkInput(schema, [])).toBe("Input must be a JSON object.");
  });
});

describe("GET /kunji/tools", () => {
  it("lists the tools with their schemas", async () => {
    const { t } = await setup();
    const res = await t.fetch("/kunji/tools", { headers: { Authorization: `Bearer ${SECRET}` } });
    const tools = (await res.json()) as { name: string; inputSchema: { type: string } }[];
    expect(tools.map((x) => x.name)).toEqual(["list_lists", "get_top", "add_to_list"]);
    expect(tools.every((x) => x.inputSchema.type === "object" && /^[a-z][a-z0-9_]{0,63}$/.test(x.name))).toBe(true);
  });
});

describe("POST /kunji/access", () => {
  it.each([
    [ME, "ok"],
    ["ME@Example.com ", "ok"],
    ["nobody@example.com", "no_account"],
    ["other@example.com", "no_account"], // unverified
  ])("%s → %s", async (userEmail, status) => {
    const { t } = await setup();
    const res = await t.fetch("/kunji/access", post({ userEmail }));
    expect(await res.json()).toEqual({ status });
  });

  it("is not_allowed once the email leaves ALLOWED_EMAILS", async () => {
    const { t } = await setup();
    vi.stubEnv("ALLOWED_EMAILS", "someone@else.com");
    expect(await (await t.fetch("/kunji/access", post({ userEmail: ME }))).json()).toEqual({ status: "not_allowed" });
  });

  it("is no_account when two verified rows share the email", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => void (await ctx.db.insert("users", { email: ME, emailVerificationTime: 1 })));
    expect(await (await t.fetch("/kunji/access", post({ userEmail: ME }))).json()).toEqual({ status: "no_account" });
  });

  it("needs userEmail", async () => {
    const { t } = await setup();
    expect((await t.fetch("/kunji/access", post({}))).status).toBe(400);
  });
});

describe("POST /kunji/call", () => {
  it("refuses no_account, not_allowed, unknown tools and bad input", async () => {
    const { t } = await setup();
    expect(await call(t, "list_lists", {}, "nobody@example.com")).toMatchObject({ ok: false, error: { code: "no_account" } });
    expect(await call(t, "delete_everything")).toMatchObject({ ok: false, error: { code: "unknown_tool" } });
    expect(await call(t, "get_top", {})).toMatchObject({ ok: false, error: { code: "bad_input", message: 'Missing "list".' } });
    expect(await call(t, "get_top", { list: "Movies", limit: 101 })).toMatchObject({ ok: false, error: { code: "tool_error" } });
    vi.stubEnv("ALLOWED_EMAILS", "someone@else.com");
    expect(await call(t, "list_lists")).toMatchObject({ ok: false, error: { code: "not_allowed" } });
  });

  it("list_lists shows only the user's lists, with counts", async () => {
    const { t, movies } = await setup();
    const { ok, result } = await call(t, "list_lists");
    expect(ok).toBe(true);
    expect(result).toEqual([
      { id: expect.any(String), name: "Games", emoji: "🎮", mode: "tiered", items: 3, done: 0, tiers: ["S", "A", "B"] },
      { id: movies, name: "Movies", emoji: "🎬", mode: "ranked", items: 3, done: 1 },
    ]);
  });

  it("get_top returns a ranked list in rank order, by name or id", async () => {
    const { t, movies } = await setup();
    const { ok, result } = await call(t, "get_top", { list: " movies " });
    expect(ok).toBe(true);
    expect(result.list).toMatchObject({ id: movies, name: "Movies", mode: "ranked" });
    expect(result.total).toBe(3);
    expect(result.items[0]).toEqual({
      rank: 1,
      title: "Alien",
      done: false,
      note: "the original",
      url: "https://example.com/alien",
      tags: ["sci-fi"],
    });
    expect(titles(result.items)).toEqual(["Alien", "Heat", "Up"]);
    expect(titles((await call(t, "get_top", { list: movies, limit: 2 })).result.items)).toEqual(["Alien", "Heat"]);
    const notDone = (await call(t, "get_top", { list: "Movies", include_done: false })).result.items;
    expect(notDone.map((i: { rank: number }) => i.rank)).toEqual([1, 3]);
  });

  it("get_top orders a tier list by tier and names the tiers", async () => {
    const { t } = await setup();
    const { result } = await call(t, "get_top", { list: "games" });
    expect(result.items.map((i: { title: string; tier: string | null }) => [i.title, i.tier])).toEqual([
      ["Portal", "S"],
      ["Tetris", "A"],
      ["Pong", null],
    ]);
  });

  it("get_top never reads someone else's list", async () => {
    const { t, foreign } = await setup();
    expect(await call(t, "get_top", { list: foreign })).toMatchObject({
      ok: false,
      error: { code: "tool_error", message: 'No list named "' + foreign + '". The user\'s lists: Games, Movies.' },
    });
    expect(await call(t, "get_top", { list: "Books" })).toMatchObject({
      ok: false,
      error: { message: 'No list named "Books". The user\'s lists: Games, Movies.' },
    });
  });

  it("add_to_list adds at the bottom of a ranked list and the unplaced pile of a tier list", async () => {
    const { t, movies } = await setup();
    const { ok, result } = await call(t, "add_to_list", {
      list: "movies",
      title: "  Dune ",
      note: "part one",
      tags: "Sci-Fi, 2021, sci-fi",
    });
    expect(ok).toBe(true);
    expect(result).toEqual({
      list: { id: movies, name: "Movies", mode: "ranked" },
      item: { rank: 4, title: "Dune", done: false, note: "part one", tags: ["sci-fi", "2021"] },
    });
    const games = (await call(t, "add_to_list", { list: "Games", title: "Doom" })).result;
    expect(games.item).toEqual({ rank: 4, title: "Doom", tier: null, done: false });
    const row = await t.run((ctx) => ctx.db.query("items").filter((q) => q.eq(q.field("title"), "Doom")).unique());
    expect(row).toMatchObject({ position: 3, tierPosition: 1 });
    expect(row?.tier).toBeUndefined();
  });

  it("add_to_list refuses duplicates, empty titles and other users' lists", async () => {
    const { t, foreign } = await setup();
    expect(await call(t, "add_to_list", { list: "Movies", title: "alien" })).toMatchObject({
      ok: false,
      error: { code: "tool_error", message: '"Alien" is already in this list.' },
    });
    expect(await call(t, "add_to_list", { list: "Movies", title: " " })).toMatchObject({
      ok: false,
      error: { message: "Title can't be empty." },
    });
    expect(await call(t, "add_to_list", { list: foreign, title: "x" })).toMatchObject({ ok: false, error: { code: "tool_error" } });
    const count = await t.run(async (ctx) => (await ctx.db.query("items").collect()).length);
    expect(count).toBe(7);
  });
});
