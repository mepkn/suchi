import { MODES, type Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Segmented control for a list's mode. */
export function ModePicker({ value, onChange, className }: { value: Mode; onChange: (m: Mode) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Mode" className={cn("inline-flex rounded-lg border bg-muted p-0.5", className)}>
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          title={m.hint}
          onClick={() => onChange(m.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors",
            value === m.value ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
