import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { applyRankedMove, applyTieredMove } from "@/lib/reorder";

/** Move mutations that reorder the cached list right away, so drops don't snap back. */
export function useMoves() {
  const moveRanked = useMutation(api.items.moveRanked).withOptimisticUpdate((store, { id, toIndex }) => {
    for (const { args, value } of store.getAllQueries(api.items.byList)) {
      if (value?.some((i) => i._id === id)) store.setQuery(api.items.byList, args, applyRankedMove(value, id, toIndex));
    }
  });
  const moveTiered = useMutation(api.items.moveTiered).withOptimisticUpdate((store, { id, tier, toIndex }) => {
    for (const { args, value } of store.getAllQueries(api.items.byList)) {
      if (value?.some((i) => i._id === id))
        store.setQuery(api.items.byList, args, applyTieredMove(value, id, tier, toIndex));
    }
  });
  return { moveRanked, moveTiered };
}
