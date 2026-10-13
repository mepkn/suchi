import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getOwnedList, requireUserId } from "./lib/access";
import { mode } from "./schema";

export const DEFAULT_TIERS = ["S", "A", "B", "C", "D"];

/** Items in the order the list's mode shows them. */
export function sortForMode(list: Doc<"lists">, items: Doc<"items">[]): Doc<"items">[] {
  const sorted = [...items];
  if (list.mode === "ranked") sorted.sort((a, b) => a.position - b.position);
  else if (list.mode === "tiered")
    sorted.sort((a, b) => (a.tier ?? Infinity) - (b.tier ?? Infinity) || a.tierPosition - b.tierPosition);
  else sorted.sort((a, b) => b._creationTime - a._creationTime);
  return sorted;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ConvexError("Name can't be empty.");
  if (trimmed.length > 100) throw new ConvexError("Name is too long.");
  return trimmed;
}

/** Home page: every list with its item count and first three items. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const lists = await ctx.db
      .query("lists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return Promise.all(
      lists.map(async (list) => {
        const items = await ctx.db
          .query("items")
          .withIndex("by_list", (q) => q.eq("listId", list._id))
          .collect();
        return {
          ...list,
          count: items.length,
          preview: sortForMode(list, items)
            .slice(0, 3)
            .map((i) => i.title),
        };
      }),
    );
  },
});

export const get = query({
  args: { id: v.id("lists") },
  handler: async (ctx, { id }) => {
    try {
      return await getOwnedList(ctx, id);
    } catch {
      return null;
    }
  },
});

export const create = mutation({
  args: { name: v.string(), emoji: v.string(), mode },
  handler: async (ctx, { name, emoji, mode }) => {
    const userId = await requireUserId(ctx);
    return ctx.db.insert("lists", {
      userId,
      name: cleanName(name),
      emoji: emoji.trim() || "📋",
      mode,
      tiers: DEFAULT_TIERS,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("lists"),
    name: v.optional(v.string()),
    emoji: v.optional(v.string()),
    mode: v.optional(mode),
  },
  handler: async (ctx, { id, name, emoji, mode }) => {
    await getOwnedList(ctx, id);
    await ctx.db.patch(id, {
      ...(name !== undefined && { name: cleanName(name) }),
      ...(emoji !== undefined && { emoji: emoji.trim() || "📋" }),
      ...(mode !== undefined && { mode }),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("lists") },
  handler: async (ctx, { id }) => {
    await getOwnedList(ctx, id);
    const items = await ctx.db
      .query("items")
      .withIndex("by_list", (q) => q.eq("listId", id))
      .collect();
    await Promise.all(items.map((i) => ctx.db.delete(i._id)));
    await ctx.db.delete(id);
  },
});

export const renameTier = mutation({
  args: { id: v.id("lists"), index: v.number(), name: v.string() },
  handler: async (ctx, { id, index, name }) => {
    const list = await getOwnedList(ctx, id);
    if (!(index in list.tiers)) throw new ConvexError("Tier not found.");
    const tiers = [...list.tiers];
    tiers[index] = cleanName(name);
    await ctx.db.patch(id, { tiers });
  },
});

export const addTier = mutation({
  args: { id: v.id("lists"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const list = await getOwnedList(ctx, id);
    if (list.tiers.length >= 20) throw new ConvexError("A list can have at most 20 tiers.");
    await ctx.db.patch(id, { tiers: [...list.tiers, cleanName(name)] });
  },
});

/** Items in the removed tier go back to the unplaced pile, after what's already there. */
export const removeTier = mutation({
  args: { id: v.id("lists"), index: v.number() },
  handler: async (ctx, { id, index }) => {
    const list = await getOwnedList(ctx, id);
    if (!(index in list.tiers)) throw new ConvexError("Tier not found.");
    const items = await ctx.db
      .query("items")
      .withIndex("by_list", (q) => q.eq("listId", id))
      .collect();
    let unplaced = items.filter((i) => i.tier === undefined).length;
    const moved = items.filter((i) => i.tier === index).sort((a, b) => a.tierPosition - b.tierPosition);
    for (const item of moved) {
      await ctx.db.patch(item._id, { tier: undefined, tierPosition: unplaced++ });
    }
    for (const item of items) {
      if (item.tier !== undefined && item.tier > index) await ctx.db.patch(item._id, { tier: item.tier - 1 });
    }
    await ctx.db.patch(id, { tiers: list.tiers.filter((_, i) => i !== index) });
  },
});
