/** Titles compare case-insensitively with runs of whitespace collapsed. */
export function titleKey(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}
