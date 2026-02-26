import { describe, expect, it } from "vitest";
import { parseHotPathsFromLog, getOpenPrCount, getOpenIssueCount } from "../src/git.js";

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

  it("skips merge lines", () => {
    const log = "src/a.ts\nmerge branch 'main'\nsrc/a.ts";
    const result = parseHotPathsFromLog(log);
    expect(result).toEqual([{ file: "src/a.ts", commits_30d: 2 }]);
  });
});

describe("getOpenPrCount / getOpenIssueCount", () => {
  it("returns null gracefully when gh is unavailable", () => {
    // Use a non-existent directory so gh (and git) will fail
    const result = getOpenPrCount("/nonexistent");
    expect(result).toBeNull();
  });

  it("returns null for issues when gh is unavailable", () => {
    const result = getOpenIssueCount("/nonexistent");
    expect(result).toBeNull();
  });
});
