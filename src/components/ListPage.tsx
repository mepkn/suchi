import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ItemSheet } from "@/components/ItemSheet";
import { ListFormDialog } from "@/components/ListFormDialog";
import { ModePicker } from "@/components/ModePicker";
import { RankedView } from "@/components/RankedView";
import { TieredView } from "@/components/TieredView";
import { UnrankedView } from "@/components/UnrankedView";
import { errorMessage } from "@/lib/errorMessage";
import { navigate } from "@/lib/router";
import type { Item, List } from "@/lib/types";

export function ListPage({ id }: { id: Id<"lists"> }) {
  const list = useQuery(api.lists.get, { id });
  const items = useQuery(api.items.byList, { listId: id });

  if (list === undefined || items === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (list === null || items === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-medium">This list doesn't exist.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to your lists
        </Button>
      </div>
    );
  }
  return <LoadedList list={list} items={items} />;
}

function LoadedList({ list, items }: { list: List; items: Item[] }) {
  const update = useMutation(api.lists.update).withOptimisticUpdate((store, { id, mode }) => {
    const current = store.getQuery(api.lists.get, { id });
    if (current && mode) store.setQuery(api.lists.get, { id }, { ...current, mode });
  });
  const remove = useMutation(api.lists.remove);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [openId, setOpenId] = useState<Id<"items"> | null>(null);
  const open = items.find((i) => i._id === openId) ?? null;
  const onOpen = (item: Item) => setOpenId(item._id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={() => navigate("/")}>
          <ArrowLeftIcon /> All lists
        </Button>
        <div className="flex items-start justify-between gap-3">
          <h1 className="flex min-w-0 items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="text-3xl leading-none">{list.emoji}</span>
            <span className="truncate">{list.name}</span>
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="List options" />}>
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <PencilIcon /> Edit name & emoji
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
                <Trash2Icon /> Delete list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ModePicker
            value={list.mode}
            onChange={(mode) => update({ id: list._id, mode }).catch((err) => toast.error(errorMessage(err)))}
            className="w-fit"
          />
          <AddItem listId={list._id} />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          Nothing here yet. Add your first item above.
        </p>
      ) : list.mode === "ranked" ? (
        <RankedView items={items} onOpen={onOpen} />
      ) : list.mode === "tiered" ? (
        <TieredView list={list} items={items} onOpen={onOpen} />
      ) : (
        <UnrankedView items={items} onOpen={onOpen} />
      )}

      <ItemSheet item={open} onClose={() => setOpenId(null)} />
      <ListFormDialog open={editing} onOpenChange={setEditing} list={list} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete "${list.name}"?`}
        description={`The list and its ${items.length} ${items.length === 1 ? "item" : "items"} will be deleted. This can't be undone.`}
        confirmLabel="Delete list"
        onConfirm={async () => {
          navigate("/");
          await remove({ id: list._id });
        }}
      />
    </div>
  );
}

/** Quick add: just a title. Details go in the item sheet. */
function AddItem({ listId }: { listId: Id<"lists"> }) {
  const create = useMutation(api.items.create);
  const [title, setTitle] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setTitle("");
    try {
      await create({ listId, title: value });
    } catch (err) {
      setTitle(value);
      toast.error(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2 sm:w-80">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an item…" maxLength={200} />
      <Button type="submit" size="icon" aria-label="Add item" disabled={!title.trim()}>
        <PlusIcon />
      </Button>
    </form>
  );
}
