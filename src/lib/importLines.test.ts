import { describe, expect, test } from "vitest";
import { parseImport } from "./importLines";

describe("parseImport", () => {
  test("strips bullets, numbering and checkboxes; ticked lines are done", () => {
    const text = "☐ Heat\n☑ Ronin\n\n- The Thing\n2) Alien\n* [x] Arrival\n- [ ]  Sicario  \n   \n•  Dune";
    expect(parseImport(text)).toEqual([
      { title: "Heat", done: false },
      { title: "Ronin", done: true },
      { title: "The Thing", done: false },
      { title: "Alien", done: false },
      { title: "Arrival", done: true },
      { title: "Sicario", done: false },
      { title: "Dune", done: false },
    ]);
  });

  test("keeps titles that merely start with a number or dash-word", () => {
    expect(parseImport("1917\n-ish\n2001: A Space Odyssey").map((l) => l.title)).toEqual([
      "1917",
      "-ish",
      "2001: A Space Odyssey",
    ]);
  });
});
