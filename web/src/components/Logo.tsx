import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <img src="/favicon.svg" alt="" className="size-[1.2em]" />
      Suchi
    </span>
  );
}
