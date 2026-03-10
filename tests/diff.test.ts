import { describe, expect, it } from "vitest";
import { diffObjects, formatDiff } from "../src/diff.js";

describe("diffObjects", () => {
  it("returns empty array when objects are equal", () => {
    const value = { a: 1, nested: { ok: true } };
    expect(diffObjects(value, value)).toEqual([]);
  });

  it("detects added, removed, and changed keys", () => {
    const previous = { a: 1, b: 2, nested: { x: 1 } };
    const current = { a: 1, c: 3, nested: { x: 2 } };

    const diff = diffObjects(previous, current);
    expect(diff).toEqual([
      { path: "b", type: "removed", before: 2 },
      { path: "c", type: "added", after: 3 },
      { path: "nested.x", type: "changed", before: 1, after: 2 }
    ]);
  });
});

describe("formatDiff", () => {
  it("renders helpful no-change message", () => {
    expect(formatDiff([])).toContain("No changes detected");
  });

  it("renders human-readable change lines", () => {
    const output = formatDiff([
      { path: "a", type: "added", after: 1 },
      { path: "b", type: "removed", before: 2 },
      { path: "c", type: "changed", before: 3, after: 4 }
    ]);

    expect(output).toContain("REPO.json changes:");
    expect(output).toContain("+ a: 1");
    expect(output).toContain("- b: 2");
    expect(output).toContain("~ c: 3 -> 4");
  });
});
