import { moveIndex } from "../../convex/lib/order";
import type { Item } from "./types";

/** Client copies of the server's moves, for optimistic updates. Inputs are byList results. */
export function applyRankedMove(items: Item[], id: Item["_id"], toIndex: number): Item[] {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const from = ordered.findIndex((i) => i._id === id);
  if (from < 0) return items;
  return moveIndex(ordered, from, toIndex).map((item, position) => ({ ...item, position }));
}

export function applyTieredMove(items: Item[], id: Item["_id"], tier: number | null, toIndex: number): Item[] {
  const item = items.find((i) => i._id === id);
  if (!item) return items;
  const target = tier ?? undefined;
  const group = (t: number | undefined) =>
    items.filter((i) => i.tier === t && i._id !== id).sort((a, b) => a.tierPosition - b.tierPosition);
  const updates = new Map<string, Item>();
  group(item.tier).forEach((i, n) => updates.set(i._id, { ...i, tierPosition: n }));
  const dest = group(target);
  dest.splice(Math.max(0, Math.min(toIndex, dest.length)), 0, { ...item, tier: target });
  dest.forEach((i, n) => updates.set(i._id, { ...i, tierPosition: n }));
  return items
    .map((i) => updates.get(i._id) ?? i)
    .sort((a, b) => (a.tier ?? Infinity) - (b.tier ?? Infinity) || a.tierPosition - b.tierPosition);
}
