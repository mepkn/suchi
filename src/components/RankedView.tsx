import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { ItemContent } from "@/components/ItemContent";
import { useMoves } from "@/hooks/use-moves";
import { useDragSensors } from "@/lib/dnd";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { items: Item[]; onOpen: (item: Item) => void };

export function RankedView({ items, onOpen }: Props) {
  const sensors = useDragSensors();
  const { moveRanked } = useMoves();
  const ordered = [...items].sort((a, b) => a.position - b.position);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const toIndex = ordered.findIndex((i) => i._id === over.id);
    void moveRanked({ id: active.id as Item["_id"], toIndex });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ordered.map((i) => i._id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2">
          {ordered.map((item, i) => (
            <RankedRow key={item._id} item={item} rank={i + 1} onOpen={onOpen} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function RankedRow({ item, rank, onOpen }: { item: Item; rank: number; onOpen: (item: Item) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Drag ${item.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <span
        className={cn(
          "w-7 shrink-0 text-right text-lg font-semibold tabular-nums",
          rank <= 3 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {rank}
      </span>
      <button type="button" className="flex min-w-0 flex-1 text-left" onClick={() => onOpen(item)}>
        <ItemContent item={item} />
      </button>
    </li>
  );
}
