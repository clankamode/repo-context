import { describe, expect, it } from "vitest";
import { parseHotPathsFromLog } from "../src/git.js";

describe("parseHotPathsFromLog", () => {
  it("aggregates and sorts file frequencies", () => {
    const log = [
      "src/a.ts",
      "src/b.ts",
      "src/a.ts",
      "",
      "README.md",
      "src/a.ts",
      "src/b.ts"
    ].join("\n");

    const result = parseHotPathsFromLog(log, 2);

    expect(result).toEqual([
      { file: "src/a.ts", commits_30d: 3 },
      { file: "src/b.ts", commits_30d: 2 }
    ]);
  });
});
