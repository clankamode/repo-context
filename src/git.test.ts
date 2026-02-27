import { describe, it, expect, vi, beforeEach } from "vitest";
import { tryGit, tryExec } from "./utils.js";
import { parseHotPathsFromLog, getHotPaths, getConventions } from "./git.js";

vi.mock("./utils.js", () => ({
  tryGit: vi.fn(),
  tryExec: vi.fn(),
}));

describe("parseHotPathsFromLog", () => {
  it("returns empty array for empty input", () => {
    expect(parseHotPathsFromLog("")).toEqual([]);
  });

  it("counts file occurrences and sorts by frequency", () => {
    const log = [
      "src/index.ts",
      "src/index.ts",
      "src/utils.ts",
      "src/index.ts",
    ].join("\n");

    const result = parseHotPathsFromLog(log);

    expect(result[0]).toEqual({ file: "src/index.ts", commits_30d: 3 });
    expect(result[1]).toEqual({ file: "src/utils.ts", commits_30d: 1 });
  });

  it("ignores lines starting with 'merge '", () => {
    const log = [
      "merge branch 'main'",
      "src/index.ts",
      "src/index.ts",
    ].join("\n");

    const result = parseHotPathsFromLog(log);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("src/index.ts");
  });

  it("ignores blank lines", () => {
    const log = "\nsrc/app.ts\n\nsrc/app.ts\n\n";

    const result = parseHotPathsFromLog(log);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ file: "src/app.ts", commits_30d: 2 });
  });

  it("trims whitespace from lines", () => {
    const log = "  src/index.ts  \n  src/index.ts  ";

    const result = parseHotPathsFromLog(log);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("src/index.ts");
    expect(result[0].commits_30d).toBe(2);
  });

  it("respects topN limit", () => {
    const files = Array.from({ length: 15 }, (_, i) => `file${i}.ts`);
    const log = files.join("\n");

    const result = parseHotPathsFromLog(log, 5);

    expect(result).toHaveLength(5);
  });

  it("defaults to topN=10", () => {
    const files = Array.from({ length: 12 }, (_, i) => `file${i}.ts`);
    const log = files.join("\n");

    const result = parseHotPathsFromLog(log);

    expect(result).toHaveLength(10);
  });
});

describe("getHotPaths", () => {
  beforeEach(() => {
    vi.mocked(tryGit).mockReturnValue("");
  });

  it("returns empty array when git returns empty output", () => {
    const result = getHotPaths("/fake/repo");

    expect(result).toEqual([]);
  });

  it("returns parsed hot paths from git log output", () => {
    vi.mocked(tryGit).mockReturnValue(
      "src/index.ts\nsrc/index.ts\nsrc/utils.ts"
    );

    const result = getHotPaths("/fake/repo");

    expect(result[0]).toEqual({ file: "src/index.ts", commits_30d: 2 });
    expect(result[1]).toEqual({ file: "src/utils.ts", commits_30d: 1 });
  });
});

describe("getConventions", () => {
  beforeEach(() => {
    vi.mocked(tryGit).mockReturnValue("");
  });

  it("returns unknown pattern for empty commit history", () => {
    const result = getConventions("/fake/repo");

    expect(result.commit_pattern).toBe("unknown");
    expect(result.conventional_commit_ratio).toBe(0);
    expect(result.common_types).toEqual([]);
  });

  it("detects conventional commits when ratio >= 0.5", () => {
    vi.mocked(tryGit).mockReturnValue(
      "feat: add login\nfix: correct typo\nfeat(auth): update token\nchore: bump deps"
    );

    const result = getConventions("/fake/repo");

    expect(result.commit_pattern).toBe("conventional");
    expect(result.conventional_commit_ratio).toBeGreaterThanOrEqual(0.5);
    expect(result.common_types).toContain("feat");
  });

  it("detects non-conventional commits", () => {
    vi.mocked(tryGit).mockReturnValue(
      "update stuff\nfix things\nsome work\ncleaning up"
    );

    const result = getConventions("/fake/repo");

    expect(result.commit_pattern).toBe("non-conventional");
    expect(result.conventional_commit_ratio).toBe(0);
  });

  it("returns top 3 common commit types", () => {
    vi.mocked(tryGit).mockReturnValue(
      [
        "feat: a", "feat: b", "feat: c",
        "fix: x", "fix: y",
        "chore: z",
        "docs: d",
      ].join("\n")
    );

    const result = getConventions("/fake/repo");

    expect(result.common_types).toHaveLength(3);
    expect(result.common_types[0]).toBe("feat");
    expect(result.common_types[1]).toBe("fix");
  });
});
