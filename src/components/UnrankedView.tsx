import { useState } from "react";
import { useMutation } from "convex/react";
import { CheckIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { ItemContent } from "@/components/ItemContent";
import { storage } from "@/lib/storage";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

type Sort = "newest" | "oldest" | "name";
const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "A–Z" },
];

type Props = { items: Item[]; onOpen: (item: Item) => void };

export function UnrankedView({ items, onOpen }: Props) {
  const setDone = useMutation(api.items.setDone).withOptimisticUpdate((store, { id, done }) => {
    for (const { args, value } of store.getAllQueries(api.items.byList)) {
      if (value) store.setQuery(api.items.byList, args, value.map((i) => (i._id === id ? { ...i, done } : i)));
    }
  });
  const [sort, setSortState] = useState<Sort>(() => (storage.get("unrankedSort") as Sort | null) ?? "newest");
  const [hideDone, setHideDone] = useState(false);
  const setSort = (s: Sort) => {
    setSortState(s);
    storage.set("unrankedSort", s);
  };

  const doneCount = items.filter((i) => i.done).length;
  const shown = items
    .filter((i) => !hideDone || !i.done)
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
        : sort === "oldest"
          ? a._creationTime - b._creationTime
          : b._creationTime - a._creationTime,
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex gap-1">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSort(s.value)}
              className={cn(
                "rounded-full px-2.5 py-0.5",
                sort === s.value ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {doneCount > 0 && (
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setHideDone(!hideDone)}>
            {hideDone ? `Show done (${doneCount})` : `Hide done (${doneCount})`}
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((item) => (
          <li key={item._id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={item.done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
              onClick={() => void setDone({ id: item._id, done: !item.done })}
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                item.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary",
              )}
            >
              {item.done && <CheckIcon className="size-3.5" />}
            </button>
            <button type="button" className="flex min-w-0 flex-1 text-left" onClick={() => onOpen(item)}>
              <ItemContent item={item} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
