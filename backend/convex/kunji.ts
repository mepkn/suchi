import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { findKunjiUser, type KunjiTool } from "./lib/kunji";
import { titleKey } from "./lib/titles";
import { insertItem } from "./items";
import { sortForMode } from "./lists";

// Suchi's tools for kunji (kunji SPEC.md → App contract). Each runs as the
// user kunji named and only ever sees that user's lists. The one write is
// add_to_list; nothing deletes, reorders or edits existing items.

const TOP_LIMIT = 10;
const TOP_MAX = 100;

export const access = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => await findKunjiUser(ctx, email),
});

async function userLists(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("lists")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();
}

async function listItems(ctx: QueryCtx, listId: Id<"lists">) {
  return await ctx.db
    .query("items")
    .withIndex("by_list", (q) => q.eq("listId", listId))
    .collect();
}

/** A list named by its id or its name (ignoring case and extra spaces). */
async function findList(ctx: QueryCtx, userId: Id<"users">, ref: string): Promise<Doc<"lists">> {
  const lists = await userLists(ctx, userId);
  const id = ctx.db.normalizeId("lists", ref.trim());
  const byId = id === null ? undefined : lists.find((l) => l._id === id);
  if (byId) return byId;
  const matches = lists.filter((l) => titleKey(l.name) === titleKey(ref));
  if (matches.length === 1) return matches[0];
  const names = lists.map((l) => l.name).join(", ") || "none yet";
  if (matches.length > 1) {
    throw new ConvexError(`Several lists are named "${ref.trim()}"; use its id from list_lists.`);
  }
  throw new ConvexError(`No list named "${ref.trim()}". The user's lists: ${names}.`);
}

/** One item as a model sees it; empty fields are left out. */
function itemView(list: Doc<"lists">, item: Doc<"items">, rank: number) {
  return {
    rank,
    title: item.title,
    ...(list.mode === "tiered" && { tier: item.tier === undefined ? null : (list.tiers[item.tier] ?? null) }),
    done: item.done,
    ...(item.note && { note: item.note }),
    ...(item.url && { url: item.url }),
    ...(item.tags.length > 0 && { tags: item.tags }),
  };
}

export const listLists = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const lists = await userLists(ctx, userId);
    return await Promise.all(
      lists.map(async (list) => {
        const items = await listItems(ctx, list._id);
        return {
          id: list._id,
          name: list.name,
          emoji: list.emoji,
          mode: list.mode,
          items: items.length,
          done: items.filter((i) => i.done).length,
          ...(list.mode === "tiered" && { tiers: list.tiers }),
        };
      }),
    );
  },
});

export const getTop = internalQuery({
  args: { userId: v.id("users"), list: v.string(), limit: v.number(), includeDone: v.boolean() },
  handler: async (ctx, { userId, list: ref, limit, includeDone }) => {
    const list = await findList(ctx, userId, ref);
    const sorted = sortForMode(list, await listItems(ctx, list._id));
    // Rank is the item's place in the whole list, so it stays the same with done items hidden.
    const ranked = sorted.map((item, i) => itemView(list, item, i + 1));
    const shown = ranked.filter((i) => includeDone || !i.done);
    return {
      list: { id: list._id, name: list.name, emoji: list.emoji, mode: list.mode },
      total: sorted.length,
      items: shown.slice(0, limit),
    };
  },
});

export const addToList = internalMutation({
  args: {
    userId: v.id("users"),
    list: v.string(),
    title: v.string(),
    note: v.optional(v.string()),
    url: v.optional(v.string()),
    tags: v.optional(v.string()),
  },
  handler: async (ctx, { userId, list: ref, title, note, url, tags }) => {
    const list = await findList(ctx, userId, ref);
    const id = await insertItem(ctx, list._id, { title, note, url, tags: tags?.split(",") });
    const items = sortForMode(list, await listItems(ctx, list._id));
    const rank = items.findIndex((i) => i._id === id) + 1;
    return {
      list: { id: list._id, name: list.name, mode: list.mode },
      item: itemView(list, items[rank - 1], rank),
    };
  },
});

export const tools: KunjiTool[] = [
  {
    name: "list_lists",
    description:
      "List the user's Suchi lists (rankings, tier lists and plain lists of movies, books, places…), newest first. " +
      "Returns each list's id, name, emoji, mode (ranked, tiered or unranked), item count, how many are done, " +
      "and for tier lists the tier names. Use get_top to read a list's items.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (ctx, userId) => await ctx.runQuery(internal.kunji.listLists, { userId }),
  },
  {
    name: "get_top",
    description:
      "Read the top items of one of the user's lists, in the list's own order: ranked lists by rank, tier lists " +
      "by tier (best tier first, unplaced items last) and unranked lists newest first. Each item has its rank " +
      "(place in the whole list), title, done flag, and its tier, note, url and tags when it has them.",
    inputSchema: {
      type: "object",
      properties: {
        list: { type: "string", description: "The list's name (ignoring case) or its id from list_lists." },
        limit: { type: "integer", description: `How many items to return, 1–${TOP_MAX} (default ${TOP_LIMIT}).` },
        include_done: { type: "boolean", description: "Include items marked done (default true)." },
      },
      required: ["list"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) => {
      const limit = (input.limit as number | undefined) ?? TOP_LIMIT;
      if (limit < 1 || limit > TOP_MAX) throw new ConvexError(`"limit" must be from 1 to ${TOP_MAX}.`);
      return await ctx.runQuery(internal.kunji.getTop, {
        userId,
        list: input.list as string,
        limit,
        includeDone: input.include_done !== false,
      });
    },
  },
  {
    name: "add_to_list",
    description:
      "Add an item to one of the user's lists. It goes to the bottom of a ranked list, to the unplaced pile of a " +
      "tier list (the user ranks it in the app) and to the top of an unranked list (newest first). A title already " +
      "in the list (ignoring case) is refused. Returns the new item with its rank.",
    inputSchema: {
      type: "object",
      properties: {
        list: { type: "string", description: "The list's name (ignoring case) or its id from list_lists." },
        title: { type: "string", description: "The item, e.g. \"Dune\"; at most 200 characters." },
        note: { type: "string", description: "Optional note." },
        url: { type: "string", description: "Optional link." },
        tags: { type: "string", description: "Optional comma-separated tags, e.g. \"sci-fi, 2021\" (stored lowercase)." },
      },
      required: ["list", "title"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) =>
      await ctx.runMutation(internal.kunji.addToList, {
        userId,
        list: input.list as string,
        title: input.title as string,
        note: input.note as string | undefined,
        url: input.url as string | undefined,
        tags: input.tags as string | undefined,
      }),
  },
];
