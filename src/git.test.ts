import { describe, it, expect, vi, beforeEach } from "vitest";
import { tryGit, tryExec } from "./utils.js";
import { parseHotPathsFromLog, getHotPaths, getConventions, getOpenPrCount, getOpenIssueCount, getGitHubRepoSlug, parseGitHubRepoSlug } from "./git.js";

vi.mock("./utils.js", () => ({
  tryGit: vi.fn(),
  tryExec: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tryGit).mockReturnValue("");
  vi.mocked(tryExec).mockReturnValue(null);
});

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

describe("GitHub remote + open counts", () => {
  it("extracts owner/repo from common GitHub remote URL formats", () => {
    expect(parseGitHubRepoSlug("https://github.com/octocat/hello-world.git")).toBe("octocat/hello-world");
    expect(parseGitHubRepoSlug("git@github.com:octocat/hello-world.git")).toBe("octocat/hello-world");
    expect(parseGitHubRepoSlug("ssh://git@github.com/octocat/hello-world")).toBe("octocat/hello-world");
  });

  it("prefers origin fetch remote when detecting repository slug", () => {
    vi.mocked(tryGit).mockReturnValue(
      [
        "upstream https://github.com/other/fork (fetch)",
        "origin git@github.com:octocat/hello-world.git (fetch)",
        "origin git@github.com:octocat/hello-world.git (push)"
      ].join("\n")
    );

    expect(getGitHubRepoSlug("/fake/repo")).toBe("octocat/hello-world");
  });

  it("returns null when there is no GitHub remote and gh cannot resolve repo", () => {
    vi.mocked(tryGit).mockReturnValue("origin https://gitlab.com/octocat/hello-world.git (fetch)");
    vi.mocked(tryExec).mockReturnValue(null);

    expect(getOpenPrCount("/fake/repo")).toBeNull();
    expect(getOpenIssueCount("/fake/repo")).toBeNull();

    const calls = vi.mocked(tryExec).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.every(([, args]) => args[0] === "repo" && args[1] === "view")).toBe(true);
  });

  it("falls back to gh repo view when GitHub remote parsing fails", () => {
    vi.mocked(tryGit).mockReturnValue("origin https://gitlab.com/octocat/hello-world.git (fetch)");
    vi.mocked(tryExec)
      .mockReturnValueOnce("octocat/hello-world")
      .mockReturnValueOnce("9");

    expect(getOpenPrCount("/fake/repo")).toBe(9);

    const [firstCall, secondCall] = vi.mocked(tryExec).mock.calls;
    expect(firstCall[1]).toEqual(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
    expect(secondCall[1]).toContain("graphql");
    expect(secondCall[1]).toContain("owner=octocat");
    expect(secondCall[1]).toContain("name=hello-world");
  });

  it("ignores malformed gh repo view output", () => {
    vi.mocked(tryGit).mockReturnValue("origin https://gitlab.com/octocat/hello-world.git (fetch)");
    vi.mocked(tryExec).mockReturnValue("not-a-slug");

    expect(getOpenPrCount("/fake/repo")).toBeNull();
    expect(vi.mocked(tryExec)).toHaveBeenCalledTimes(1);
  });

  it("returns pull request and issue counts via gh graphql", () => {
    vi.mocked(tryGit).mockReturnValue("origin https://github.com/octocat/hello-world.git (fetch)");
    vi.mocked(tryExec)
      .mockReturnValueOnce("12")
      .mockReturnValueOnce("34");

    expect(getOpenPrCount("/fake/repo")).toBe(12);
    expect(getOpenIssueCount("/fake/repo")).toBe(34);

    const [firstCall, secondCall] = vi.mocked(tryExec).mock.calls;
    expect(firstCall[0]).toBe("gh");
    expect(firstCall[1]).toContain("owner=octocat");
    expect(firstCall[1]).toContain("name=hello-world");
    expect(firstCall[1]).toContain(".data.repository.pullRequests.totalCount");
    expect(secondCall[1]).toContain(".data.repository.issues.totalCount");
  });

  it("returns null when gh cannot query counts (e.g. missing auth)", () => {
    vi.mocked(tryGit).mockReturnValue("origin https://github.com/octocat/hello-world.git (fetch)");
    vi.mocked(tryExec).mockReturnValue(null);

    expect(getOpenPrCount("/fake/repo")).toBeNull();
    expect(getOpenIssueCount("/fake/repo")).toBeNull();
  });
});
