import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const mode = v.union(v.literal("ranked"), v.literal("tiered"), v.literal("unranked"));

export default defineSchema({
  ...authTables,
  lists: defineTable({
    userId: v.id("users"),
    name: v.string(),
    emoji: v.string(),
    mode,
    tiers: v.array(v.string()),
  }).index("by_user", ["userId"]),
  items: defineTable({
    listId: v.id("lists"),
    title: v.string(),
    note: v.optional(v.string()),
    url: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    tags: v.array(v.string()),
    // Both orders are kept, so switching a list's mode loses nothing.
    // 0..N-1 across the whole list (ranked mode).
    position: v.number(),
    // Index into the list's tiers; undefined means not placed in a tier yet.
    tier: v.optional(v.number()),
    // 0..N-1 within the item's tier, or among the unplaced items (tiered mode).
    tierPosition: v.number(),
    done: v.boolean(),
  }).index("by_list", ["listId"]),
});
