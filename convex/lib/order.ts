/** Moves the element at `from` to `to` (both clamped), returning a new array. */
export function moveIndex<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}
