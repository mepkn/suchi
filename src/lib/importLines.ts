export type ImportLine = { title: string; done: boolean };

// Checklist markers from Keep ("☐ ", "☑ "), Markdown ("- [ ] ", "- [x] ") and plain ticks.
const DONE = /^(?:[☑☒✅✓✔]|\[[xX]\])\s*/;
const TODO = /^(?:[☐□]|\[ \])\s*/;
// Bullets and numbering: "- ", "* ", "• ", "1. ", "1) ".
const BULLET = /^(?:[-*•◦▪‣·]|\d+[.)])\s+/;

/** One item per non-empty line, with bullets, numbering and checkboxes stripped. */
export function parseImport(text: string): ImportLine[] {
  const out: ImportLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim().replace(BULLET, "");
    let done = false;
    if (DONE.test(line)) {
      done = true;
      line = line.replace(DONE, "");
    } else {
      line = line.replace(TODO, "");
    }
    line = line.replace(/\s+/g, " ").trim();
    if (line) out.push({ title: line, done });
  }
  return out;
}
