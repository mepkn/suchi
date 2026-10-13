import { useSyncExternalStore } from "react";

/** A tiny pushState router: the app only has "/" and "/lists/:id". */
const listeners = new Set<() => void>();
window.addEventListener("popstate", () => listeners.forEach((l) => l()));

export function navigate(path: string) {
  if (path === location.pathname) return;
  history.pushState(null, "", path);
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

export function usePath(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => location.pathname,
  );
}

export const listPath = (id: string) => `/lists/${id}`;

export function parseListId(path: string): string | null {
  return /^\/lists\/([^/]+)\/?$/.exec(path)?.[1] ?? null;
}
