import { ExternalLinkIcon } from "lucide-react";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Thumbnail, title, note and tags: the body shared by every view's rows. */
export function ItemContent({ item, compact }: { item: Item; compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          className={cn("shrink-0 rounded-md border object-cover", compact ? "size-7" : "size-10")}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate font-medium", item.done && "text-muted-foreground line-through")}>
            {item.title}
          </span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Open link"
            >
              <ExternalLinkIcon className="size-3.5" />
            </a>
          )}
        </div>
        {!compact && (item.note || item.tags.length > 0) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.note && <span className="truncate">{item.note}</span>}
            {item.tags.map((t) => (
              <span key={t} className="shrink-0 rounded-full bg-muted px-1.5 py-0.5">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
