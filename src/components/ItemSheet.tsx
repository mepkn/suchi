import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { errorMessage } from "@/lib/errorMessage";
import type { Item } from "@/lib/types";

type Props = { item: Item | null; onClose: () => void };

/** Edit every field of an item, or delete it. */
export function ItemSheet({ item, onClose }: Props) {
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {item && <ItemForm key={item._id} item={item} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function ItemForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const update = useMutation(api.items.update);
  const remove = useMutation(api.items.remove);
  const [title, setTitle] = useState(item.title);
  const [note, setNote] = useState(item.note ?? "");
  const [url, setUrl] = useState(item.url ?? "");
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await update({ id: item._id, title, note, url, imageUrl, tags: tags.split(",") });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>Edit item</SheetTitle>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-4 px-4">
        {imageUrl.trim() && (
          <img src={imageUrl.trim()} alt="" className="max-h-48 w-full rounded-lg border object-cover" />
        )}
        <div className="grid gap-2">
          <Label htmlFor="item-title">Title</Label>
          <Input id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="item-note">Note</Label>
          <Textarea id="item-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="item-url">Link</Label>
          <Input id="item-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="item-image">Image URL</Label>
          <Input
            id="item-image"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…/poster.jpg"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="item-tags">Tags</Label>
          <Input id="item-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
        </div>
      </div>
      <SheetFooter className="flex-row justify-between">
        <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
          <Trash2Icon /> Delete
        </Button>
        <Button type="submit" disabled={busy || !title.trim()}>
          {busy && <Loader2Icon className="animate-spin" />}
          Save
        </Button>
      </SheetFooter>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this item?"
        description={`"${item.title}" will be removed from the list.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await remove({ id: item._id });
          onDone();
        }}
      />
    </form>
  );
}
