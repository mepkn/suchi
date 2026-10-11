import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ItemContent } from "@/components/ItemContent";
import { useMoves } from "@/hooks/use-moves";
import { useDragSensors } from "@/lib/dnd";
import { errorMessage } from "@/lib/errorMessage";
import type { Item, List } from "@/lib/types";
import { cn } from "@/lib/utils";

// Tier label colours, top to bottom; tiers past the end reuse the last one.
const TIER_COLORS = [
  "bg-rose-400 text-rose-950",
  "bg-orange-300 text-orange-950",
  "bg-amber-200 text-amber-950",
  "bg-lime-300 text-lime-950",
  "bg-sky-300 text-sky-950",
  "bg-violet-300 text-violet-950",
  "bg-zinc-300 text-zinc-900",
];

type Tier = number | null;
const containerId = (tier: Tier) => `tier:${tier ?? "none"}`;
function parseContainer(id: string): Tier | undefined {
  const m = /^tier:(none|\d+)$/.exec(id);
  if (!m) return undefined;
  return m[1] === "none" ? null : Number(m[1]);
}

/**
 * What's under the pointer wins: an item if the pointer is on one, else the tier row.
 * Falls back to the closest centre when the pointer is between rows.
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length > 0) {
    const item = hits.find((h) => parseContainer(String(h.id)) === undefined);
    return [item ?? hits[0]];
  }
  return closestCenter(args);
};

type Props = { list: List; items: Item[]; onOpen: (item: Item) => void };

export function TieredView({ list, items, onOpen }: Props) {
  const sensors = useDragSensors();
  const { moveTiered } = useMoves();
  const addTier = useMutation(api.lists.addTier);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overTier, setOverTier] = useState<Tier | undefined>(undefined);

  const inTier = (tier: Tier) =>
    items.filter((i) => (i.tier ?? null) === tier).sort((a, b) => a.tierPosition - b.tierPosition);
  const byId = new Map(items.map((i) => [i._id as string, i]));

  /** The tier a droppable id belongs to: a tier row itself, or the tier of the item under the pointer. */
  function tierOf(id: string): Tier | undefined {
    const container = parseContainer(id);
    if (container !== undefined) return container;
    const item = byId.get(id);
    return item ? (item.tier ?? null) : undefined;
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function onDragOver({ over }: DragOverEvent) {
    setOverTier(over ? tierOf(String(over.id)) : undefined);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverTier(undefined);
    if (!over || active.id === over.id) return;
    const tier = tierOf(String(over.id));
    if (tier === undefined) return;
    const group = inTier(tier);
    const overIndex = group.findIndex((i) => i._id === over.id);
    const toIndex = overIndex >= 0 ? overIndex : group.length;
    void moveTiered({ id: active.id as Item["_id"], tier, toIndex });
  }

  const active = activeId ? byId.get(activeId) : undefined;
  const unplaced = inTier(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverTier(undefined);
      }}
    >
      <div className="flex flex-col gap-2">
        {list.tiers.map((name, index) => (
          <TierRow
            key={index}
            list={list}
            index={index}
            name={name}
            items={inTier(index)}
            highlighted={activeId !== null && overTier === index}
            onOpen={onOpen}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
          onClick={() =>
            addTier({ id: list._id, name: nextTierName(list.tiers) }).catch((err) => toast.error(errorMessage(err)))
          }
        >
          <PlusIcon /> Add tier
        </Button>

        <div className="mt-4 flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Not placed yet {unplaced.length > 0 && `· ${unplaced.length}`}
          </h2>
          <TierDropZone
            tier={null}
            items={unplaced}
            highlighted={activeId !== null && overTier === null}
            onOpen={onOpen}
            empty="Drag items here to take them out of a tier."
            className="min-h-16 rounded-xl border border-dashed p-2"
          />
        </div>
      </div>
      <DragOverlay>{active && <Chip item={active} overlay />}</DragOverlay>
    </DndContext>
  );
}

function nextTierName(tiers: string[]): string {
  const letters = "SABCDEFGHIJ";
  return [...letters].find((l) => !tiers.includes(l)) ?? `Tier ${tiers.length + 1}`;
}

function TierRow({
  list,
  index,
  name,
  items,
  highlighted,
  onOpen,
}: {
  list: List;
  index: number;
  name: string;
  items: Item[];
  highlighted: boolean;
  onOpen: (item: Item) => void;
}) {
  const renameTier = useMutation(api.lists.renameTier);
  const removeTier = useMutation(api.lists.removeTier);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirming, setConfirming] = useState(false);

  function save() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== name) {
      renameTier({ id: list._id, index, name: draft }).catch((err) => toast.error(errorMessage(err)));
    } else {
      setDraft(name);
    }
  }

  return (
    <div className="flex overflow-hidden rounded-xl border bg-card shadow-xs">
      <div
        className={cn(
          "group relative flex w-16 shrink-0 items-center justify-center p-1 text-center text-lg font-bold sm:w-20",
          TIER_COLORS[Math.min(index, TIER_COLORS.length - 1)],
        )}
      >
        {editing ? (
          <Input
            value={draft}
            autoFocus
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(name);
                setEditing(false);
              }
            }}
            className="h-7 bg-white/70 px-1 text-center text-sm text-zinc-900"
          />
        ) : (
          <span className="line-clamp-3 break-words">{name}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Tier ${name} options`}
                className="absolute top-0.5 right-0.5 rounded p-0.5 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-60"
              />
            }
          >
            <MoreHorizontalIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => {
                setDraft(name);
                setEditing(true);
              }}
            >
              <PencilIcon /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
              <Trash2Icon /> Delete tier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <TierDropZone tier={index} items={items} highlighted={highlighted} onOpen={onOpen} className="min-h-14 flex-1 p-2" />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete tier "${name}"?`}
        description={
          items.length > 0
            ? `Its ${items.length} ${items.length === 1 ? "item moves" : "items move"} to "Not placed yet".`
            : "This tier is empty."
        }
        confirmLabel="Delete tier"
        onConfirm={() => removeTier({ id: list._id, index })}
      />
    </div>
  );
}

function TierDropZone({
  tier,
  items,
  highlighted,
  onOpen,
  empty,
  className,
}: {
  tier: Tier;
  items: Item[];
  highlighted: boolean;
  onOpen: (item: Item) => void;
  empty?: string;
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id: containerId(tier) });
  return (
    <SortableContext items={items.map((i) => i._id)} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn("flex flex-wrap content-start gap-2 transition-colors", highlighted && "bg-primary/5", className)}
      >
        {items.map((item) => (
          <SortableChip key={item._id} item={item} onOpen={onOpen} />
        ))}
        {items.length === 0 && empty && <p className="self-center px-2 text-sm text-muted-foreground">{empty}</p>}
      </div>
    </SortableContext>
  );
}

function SortableChip({ item, onOpen }: { item: Item; onOpen: (item: Item) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(item)}
    >
      <Chip item={item} />
    </div>
  );
}

function Chip({ item, overlay }: { item: Item; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "flex max-w-56 cursor-grab items-center rounded-lg border bg-background px-2.5 py-1.5 text-sm shadow-xs hover:border-primary/50",
        overlay && "cursor-grabbing shadow-lg ring-2 ring-primary/40",
      )}
    >
      <ItemContent item={item} compact />
    </div>
  );
}
