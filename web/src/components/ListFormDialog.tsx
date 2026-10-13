import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModePicker } from "@/components/ModePicker";
import { errorMessage } from "@/lib/errorMessage";
import { listPath, navigate } from "@/lib/router";
import { MODES, type List, type Mode } from "@/lib/types";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; list?: List };

/** Create a list, or rename / re-emoji an existing one. */
export function ListFormDialog({ open, onOpenChange, list }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open && <ListForm list={list} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function ListForm({ list, onDone }: { list?: List; onDone: () => void }) {
  const create = useMutation(api.lists.create);
  const update = useMutation(api.lists.update);
  const [name, setName] = useState(list?.name ?? "");
  const [emoji, setEmoji] = useState(list?.emoji ?? "📋");
  const [mode, setMode] = useState<Mode>(list?.mode ?? "ranked");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (list) {
        await update({ id: list._id, name, emoji });
      } else {
        const id = await create({ name, emoji, mode });
        navigate(listPath(id));
      }
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
        <DialogTitle>{list ? "Edit list" : "New list"}</DialogTitle>
      </DialogHeader>
      <div className="flex gap-3">
        <div className="grid w-16 gap-2">
          <Label htmlFor="list-emoji">Emoji</Label>
          <Input id="list-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} className="text-center" />
        </div>
        <div className="grid flex-1 gap-2">
          <Label htmlFor="list-name">Name</Label>
          <Input
            id="list-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Favourite movies"
            maxLength={100}
            required
            autoFocus
          />
        </div>
      </div>
      {!list && (
        <div className="grid gap-2">
          <Label>Mode</Label>
          <ModePicker value={mode} onChange={setMode} className="w-fit" />
          <p className="text-xs text-muted-foreground">
            {MODES.find((m) => m.value === mode)?.hint}. You can switch any time.
          </p>
        </div>
      )}
      <DialogFooter>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy && <Loader2Icon className="animate-spin" />}
          {list ? "Save" : "Create list"}
        </Button>
      </DialogFooter>
    </form>
  );
}
