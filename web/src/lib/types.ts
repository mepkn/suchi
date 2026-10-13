import type { Doc } from "@convex/_generated/dataModel";

export type List = Doc<"lists">;
export type Item = Doc<"items">;
export type Mode = List["mode"];

export const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "ranked", label: "Ranked", hint: "Numbered 1…N, drag to reorder" },
  { value: "tiered", label: "Tiered", hint: "S/A/B… rows, drag between tiers" },
  { value: "unranked", label: "Unranked", hint: "A plain collection with ✓ done" },
];
