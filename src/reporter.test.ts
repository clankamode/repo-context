import { describe, it, expect } from "vitest";
import { toRepoJson, toRepoMarkdown, toCompactSummary } from "./reporter.js";
import type { RepoContext } from "./types.js";

const baseContext: RepoContext = {
  version: "1.0",
  repo: "my-app",
  generated: "2024-01-01T00:00:00.000Z",
  stack: {
    languages: ["TypeScript"],
    frameworks: ["Next.js"],
    runtime: "Node 20",
    package_manager: "pnpm",
    test_framework: "Vitest",
    ci: "GitHub Actions",
  },
  structure: {
    entry_points: ["src/index.ts"],
    config_files: ["tsconfig.json"],
    test_dirs: ["__tests__"],
    total_files: 42,
    total_lines: 1500,
  },
  conventions: {
    commit_pattern: "conventional",
    conventional_commit_ratio: 0.9,
    common_types: ["feat", "fix"],
  },
  hot_paths: [
    { file: "src/index.ts", commits_30d: 10 },
    { file: "src/utils.ts", commits_30d: 5 },
  ],
  recent_changes: {
    last_commit: "feat: add login",
    last_commit_sha: "abc123",
    last_commit_date: "2024-01-01 12:00:00 +0000",
    active_branches: ["feat/auth"],
    open_prs: 3,
    open_issues: 7,
  },
  dependencies: {
    direct: 5,
    dev: 10,
    notable: ["next", "react"],
  },
  agents_md: "AI agents: follow project conventions.",
};

describe("toRepoJson", () => {
  it("returns valid JSON", () => {
    const result = toRepoJson(baseContext);

    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("round-trips all top-level keys", () => {
    const parsed = JSON.parse(toRepoJson(baseContext)) as RepoContext;

    expect(parsed.version).toBe("1.0");
    expect(parsed.repo).toBe("my-app");
    expect(parsed.stack.languages).toEqual(["TypeScript"]);
    expect(parsed.hot_paths).toHaveLength(2);
    expect(parsed.recent_changes.open_prs).toBe(3);
    expect(parsed.recent_changes.open_issues).toBe(7);
  });

  it("ends with a newline", () => {
    expect(toRepoJson(baseContext).endsWith("\n")).toBe(true);
  });

  it("preserves null values for optional fields", () => {
    const ctx: RepoContext = {
      ...baseContext,
      stack: {
        ...baseContext.stack,
        runtime: null,
        package_manager: null,
        test_framework: null,
        ci: null,
      },
      recent_changes: {
        ...baseContext.recent_changes,
        open_prs: null,
        open_issues: null,
      },
    };

    const parsed = JSON.parse(toRepoJson(ctx)) as RepoContext;

    expect(parsed.stack.runtime).toBeNull();
    expect(parsed.recent_changes.open_prs).toBeNull();
  });
});

describe("toRepoMarkdown", () => {
  it("starts with # Repository Context heading", () => {
    expect(toRepoMarkdown(baseContext).startsWith("# Repository Context")).toBe(true);
  });

  it("includes all section headings", () => {
    const result = toRepoMarkdown(baseContext);

    expect(result).toContain("## Stack");
    expect(result).toContain("## Structure");
    expect(result).toContain("## Conventions");
    expect(result).toContain("## Hot Paths");
    expect(result).toContain("## Recent Changes");
    expect(result).toContain("## Dependencies");
    expect(result).toContain("## Agent Notes");
  });

  it("includes repo name and generated timestamp", () => {
    const result = toRepoMarkdown(baseContext);

    expect(result).toContain("my-app");
    expect(result).toContain("2024-01-01T00:00:00.000Z");
  });

  it("includes hot paths with commit counts", () => {
    const result = toRepoMarkdown(baseContext);

    expect(result).toContain("src/index.ts (10 commits/30d)");
    expect(result).toContain("src/utils.ts (5 commits/30d)");
  });

  it("shows None when hot_paths is empty", () => {
    const result = toRepoMarkdown({ ...baseContext, hot_paths: [] });

    expect(result).toContain("- None");
  });

  it("includes open PRs and issues when present", () => {
    const result = toRepoMarkdown(baseContext);

    expect(result).toContain("Open PRs**: 3");
    expect(result).toContain("Open Issues**: 7");
  });

  it("omits PR and issue lines when null", () => {
    const ctx: RepoContext = {
      ...baseContext,
      recent_changes: {
        ...baseContext.recent_changes,
        open_prs: null,
        open_issues: null,
      },
    };

    const result = toRepoMarkdown(ctx);

    expect(result).not.toContain("Open PRs");
    expect(result).not.toContain("Open Issues");
  });

  it("shows Unknown for null stack fields", () => {
    const ctx: RepoContext = {
      ...baseContext,
      stack: {
        ...baseContext.stack,
        runtime: null,
        package_manager: null,
        test_framework: null,
        ci: null,
      },
    };

    const result = toRepoMarkdown(ctx);

    // All four Unknown occurrences from the null fields
    const unknownCount = (result.match(/Unknown/g) ?? []).length;
    expect(unknownCount).toBeGreaterThanOrEqual(4);
  });

  it("ends with a newline", () => {
    expect(toRepoMarkdown(baseContext).endsWith("\n")).toBe(true);
  });
});

describe("toCompactSummary", () => {
  it("returns a single-paragraph string without newlines", () => {
    expect(toCompactSummary(baseContext)).not.toContain("\n");
  });

  it("includes repo name and language", () => {
    const result = toCompactSummary(baseContext);

    expect(result).toContain("my-app");
    expect(result).toContain("TypeScript");
  });

  it("includes framework when present", () => {
    const result = toCompactSummary(baseContext);

    expect(result).toContain("Next.js");
  });

  it("includes file and line counts", () => {
    const result = toCompactSummary(baseContext);

    expect(result).toContain("42 files");
    expect(result).toContain("1500 lines");
  });

  it("includes hottest file", () => {
    const result = toCompactSummary(baseContext);

    expect(result).toContain("src/index.ts");
  });

  it("falls back to N/A for hottest file when hot_paths is empty", () => {
    const result = toCompactSummary({ ...baseContext, hot_paths: [] });

    expect(result).toContain("N/A");
  });

  it("includes open PR and issue counts", () => {
    const result = toCompactSummary(baseContext);

    expect(result).toContain("3 open PRs");
    expect(result).toContain("7 open issues");
  });

  it("omits PR and issue parts when null", () => {
    const ctx: RepoContext = {
      ...baseContext,
      recent_changes: {
        ...baseContext.recent_changes,
        open_prs: null,
        open_issues: null,
      },
    };

    const result = toCompactSummary(ctx);

    expect(result).not.toContain("open PRs");
    expect(result).not.toContain("open issues");
  });

  it("includes active branch count", () => {
    const result = toCompactSummary(baseContext);

    expect(result).toContain("1 active branch");
  });
});
