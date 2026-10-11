import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isAllowedEmail } from "./allowlist";

export async function requireUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Not signed in.");
  // Re-checked on every call, so removing an email cuts off existing sessions.
  const user = await ctx.db.get(userId);
  if (!isAllowedEmail(user?.email)) throw new ConvexError("This email is not on the allowlist.");
  return userId;
}

// Missing and foreign documents look the same to the caller.
export async function getOwnedList(ctx: QueryCtx, id: Id<"lists">): Promise<Doc<"lists">> {
  const userId = await requireUserId(ctx);
  const list = await ctx.db.get(id);
  if (list === null || list.userId !== userId) throw new ConvexError("List not found.");
  return list;
}

export async function getOwnedItem(ctx: QueryCtx, id: Id<"items">) {
  const item = await ctx.db.get(id);
  if (item === null) throw new ConvexError("Item not found.");
  const list = await getOwnedList(ctx, item.listId);
  return { item, list };
}
