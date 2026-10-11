import { useState } from "react";
import { useQuery } from "convex/react";
import { PlusIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListFormDialog } from "@/components/ListFormDialog";
import { listPath, navigate } from "@/lib/router";
import { MODES } from "@/lib/types";

export function HomePage() {
  const lists = useQuery(api.lists.mine);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your lists</h1>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon /> New list
        </Button>
      </div>

      {lists === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="text-4xl">📋</p>
          <p className="font-medium">No lists yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Make one for songs, movies, channels, places — rank them, tier them, or just collect them.
          </p>
          <Button className="mt-2" onClick={() => setCreating(true)}>
            <PlusIcon /> New list
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <a
              key={list._id}
              href={listPath(list._id)}
              onClick={(e) => {
                e.preventDefault();
                navigate(listPath(list._id));
              }}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/50"
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">{list.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-primary">{list.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {MODES.find((m) => m.value === list.mode)?.label} · {list.count} {list.count === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
              {list.preview.length > 0 ? (
                <ol className="flex flex-col gap-1 text-sm">
                  {list.preview.map((title, i) => (
                    <li key={i} className="flex gap-2 truncate">
                      <span className="w-4 shrink-0 text-right text-muted-foreground tabular-nums">
                        {list.mode === "ranked" ? i + 1 : "•"}
                      </span>
                      <span className="truncate">{title}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Empty</p>
              )}
            </a>
          ))}
        </div>
      )}

      <ListFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
