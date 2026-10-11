import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { titleKey } from "../../convex/lib/titles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errorMessage";
import { parseImport } from "@/lib/importLines";
import type { Item, List } from "@/lib/types";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; list: List; items: Item[] };

/** Paste lines (e.g. from a Keep note); each becomes an item. */
export function ImportDialog({ open, onOpenChange, list, items }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <ImportForm list={list} items={items} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ list, items, onDone }: { list: List; items: Item[]; onDone: () => void }) {
  const createMany = useMutation(api.items.createMany);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    const seen = new Set(items.map((i) => titleKey(i.title)));
    let fresh = 0;
    let dupes = 0;
    const lines = parseImport(text);
    for (const l of lines) {
      const key = titleKey(l.title);
      if (seen.has(key) || l.title.length > 200) dupes++;
      else {
        seen.add(key);
        fresh++;
      }
    }
    return { lines, fresh, dupes };
  }, [text, items]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { added, skipped } = await createMany({ listId: list._id, items: preview.lines });
      toast.success(`Added ${added} ${added === 1 ? "item" : "items"}${skipped ? `, skipped ${skipped}` : ""}.`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Import items</DialogTitle>
        <DialogDescription>
          Paste one item per line. Bullets, numbers and checkboxes are removed; ticked ones (☑, [x]) are marked done.
        </DialogDescription>
      </DialogHeader>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Heat\nRonin\nThe Thing"}
        className="max-h-[50vh] min-h-48 font-mono text-sm"
        autoFocus
      />
      <p className="text-sm text-muted-foreground">
        {preview.lines.length === 0
          ? "Nothing to import yet."
          : `${preview.fresh} new ${preview.fresh === 1 ? "item" : "items"}` +
            (preview.dupes ? `, ${preview.dupes} already in this list or repeated (skipped)` : "") +
            "."}
      </p>
      <DialogFooter>
        <Button type="submit" disabled={busy || preview.fresh === 0}>
          {busy && <Loader2Icon className="animate-spin" />}
          Import {preview.fresh || ""}
        </Button>
      </DialogFooter>
    </form>
  );
}
