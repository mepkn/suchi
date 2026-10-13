import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getOwnedItem, getOwnedList } from "./lib/access";
import { moveIndex } from "./lib/order";
import { titleKey } from "./lib/titles";
import { sortForMode } from "./lists";

const fields = {
  title: v.string(),
  note: v.optional(v.string()),
  url: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
};

type Fields = { title?: string; note?: string; url?: string; imageUrl?: string; tags?: string[] };

/** Trims everything; empty optional strings are stored as undefined. */
function clean(f: Fields) {
  const opt = (s: string | undefined) => (s === undefined ? undefined : s.trim() || undefined);
  const out: Partial<Doc<"items">> = {};
  if (f.title !== undefined) {
    const title = f.title.trim();
    if (!title) throw new ConvexError("Title can't be empty.");
    if (title.length > 200) throw new ConvexError("Title is too long.");
    out.title = title;
  }
  if ("note" in f) out.note = opt(f.note);
  if ("url" in f) out.url = opt(f.url);
  if ("imageUrl" in f) out.imageUrl = opt(f.imageUrl);
  if (f.tags !== undefined) {
    out.tags = [...new Set(f.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }
  return out;
}

async function listItems(ctx: MutationCtx, listId: Id<"lists">) {
  return ctx.db
    .query("items")
    .withIndex("by_list", (q) => q.eq("listId", listId))
    .collect();
}

/** Writes 0..N-1 into `key` for the given order, touching only items whose value changed. */
async function renumber(ctx: MutationCtx, ordered: Doc<"items">[], key: "position" | "tierPosition") {
  for (const [i, item] of ordered.entries()) {
    if (item[key] !== i) await ctx.db.patch(item._id, { [key]: i });
  }
}

/** Throws if another item in the list already has this title. */
function assertUniqueTitle(items: Doc<"items">[], title: string, exceptId?: Id<"items">) {
  const key = titleKey(title);
  const clash = items.find((i) => i._id !== exceptId && titleKey(i.title) === key);
  if (clash) throw new ConvexError(`"${clash.title}" is already in this list.`);
}

function inTier(items: Doc<"items">[], tier: number | undefined) {
  return items.filter((i) => i.tier === tier).sort((a, b) => a.tierPosition - b.tierPosition);
}

export const byList = query({
  args: { listId: v.id("lists") },
  handler: async (ctx, { listId }) => {
    let list;
    try {
      list = await getOwnedList(ctx, listId);
    } catch {
      return null;
    }
    const items = await ctx.db
      .query("items")
      .withIndex("by_list", (q) => q.eq("listId", listId))
      .collect();
    return sortForMode(list, items);
  },
});

/** New items go to the bottom of the ranking and the bottom of the unplaced pile. */
export const create = mutation({
  args: { listId: v.id("lists"), ...fields },
  handler: async (ctx, { listId, ...f }) => {
    await getOwnedList(ctx, listId);
    const items = await listItems(ctx, listId);
    const c = clean(f);
    assertUniqueTitle(items, c.title!);
    return ctx.db.insert("items", {
      listId,
      title: c.title!,
      note: c.note,
      url: c.url,
      imageUrl: c.imageUrl,
      tags: c.tags ?? [],
      position: items.length,
      tier: undefined,
      tierPosition: inTier(items, undefined).length,
      done: false,
    });
  },
});

/**
 * Adds many titles at once (pasted from a note). Titles already in the list, or repeated in
 * the paste, are skipped rather than failing the whole import.
 */
export const createMany = mutation({
  args: { listId: v.id("lists"), items: v.array(v.object({ title: v.string(), done: v.optional(v.boolean()) })) },
  handler: async (ctx, { listId, items: incoming }) => {
    await getOwnedList(ctx, listId);
    if (incoming.length > 1000) throw new ConvexError("Import at most 1000 items at a time.");
    const items = await listItems(ctx, listId);
    const seen = new Set(items.map((i) => titleKey(i.title)));
    let position = items.length;
    let tierPosition = inTier(items, undefined).length;
    let added = 0;
    let skipped = 0;
    for (const { title: raw, done } of incoming) {
      const title = raw.trim().replace(/\s+/g, " ");
      const key = titleKey(title);
      if (!title || title.length > 200 || seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      await ctx.db.insert("items", {
        listId,
        title,
        tags: [],
        position: position++,
        tier: undefined,
        tierPosition: tierPosition++,
        done: done ?? false,
      });
      added++;
    }
    return { added, skipped };
  },
});

export const update = mutation({
  args: { id: v.id("items"), ...fields, title: v.optional(v.string()) },
  handler: async (ctx, { id, ...f }) => {
    const { item } = await getOwnedItem(ctx, id);
    const c = clean(f);
    if (c.title !== undefined) assertUniqueTitle(await listItems(ctx, item.listId), c.title, id);
    await ctx.db.patch(id, c);
  },
});

export const setDone = mutation({
  args: { id: v.id("items"), done: v.boolean() },
  handler: async (ctx, { id, done }) => {
    await getOwnedItem(ctx, id);
    await ctx.db.patch(id, { done });
  },
});

export const remove = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, { id }) => {
    const { item } = await getOwnedItem(ctx, id);
    await ctx.db.delete(id);
    const rest = (await listItems(ctx, item.listId)).filter((i) => i._id !== id);
    await renumber(ctx, [...rest].sort((a, b) => a.position - b.position), "position");
    await renumber(ctx, inTier(rest, item.tier), "tierPosition");
  },
});

/** Ranked mode: put the item at `toIndex` in the whole-list order. */
export const moveRanked = mutation({
  args: { id: v.id("items"), toIndex: v.number() },
  handler: async (ctx, { id, toIndex }) => {
    const { item } = await getOwnedItem(ctx, id);
    const ordered = (await listItems(ctx, item.listId)).sort((a, b) => a.position - b.position);
    const from = ordered.findIndex((i) => i._id === id);
    await renumber(ctx, moveIndex(ordered, from, toIndex), "position");
  },
});

/** Tiered mode: put the item at `toIndex` inside `tier` (null = unplaced). */
export const moveTiered = mutation({
  args: { id: v.id("items"), tier: v.union(v.number(), v.null()), toIndex: v.number() },
  handler: async (ctx, { id, tier: rawTier, toIndex }) => {
    const { item, list } = await getOwnedItem(ctx, id);
    const tier = rawTier ?? undefined;
    if (tier !== undefined && !(tier in list.tiers)) throw new ConvexError("Tier not found.");
    const items = await listItems(ctx, item.listId);
    if (tier === item.tier) {
      const group = inTier(items, tier);
      const from = group.findIndex((i) => i._id === id);
      await renumber(ctx, moveIndex(group, from, toIndex), "tierPosition");
      return;
    }
    await renumber(ctx, inTier(items, item.tier).filter((i) => i._id !== id), "tierPosition");
    const target = inTier(items, tier);
    const at = Math.max(0, Math.min(toIndex, target.length));
    await ctx.db.patch(id, { tier });
    // `item` still carries its old tierPosition, so force a write for it.
    const ordered = [...target.slice(0, at), { ...item, tierPosition: -1 }, ...target.slice(at)];
    await renumber(ctx, ordered, "tierPosition");
  },
});
