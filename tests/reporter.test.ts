import { describe, expect, it } from "vitest";
import { toRepoMarkdown, toCompactSummary } from "../src/reporter.js";
import { RepoContext } from "../src/types.js";

const makeContext = (overrides: Partial<RepoContext> = {}): RepoContext => ({
  version: "1.0",
  repo: "demo",
  generated: "2026-02-25T00:00:00.000Z",
  stack: {
    languages: ["TypeScript"],
    frameworks: ["React"],
    runtime: "Node 20",
    package_manager: "npm",
    test_framework: "Vitest",
    ci: "GitHub Actions"
  },
  structure: {
    entry_points: ["src/index.ts"],
    config_files: ["tsconfig.json"],
    test_dirs: ["tests"],
    total_files: 10,
    total_lines: 200
  },
  conventions: {
    commit_pattern: "conventional",
    conventional_commit_ratio: 0.8,
    common_types: ["feat", "fix"]
  },
  hot_paths: [{ file: "src/index.ts", commits_30d: 3 }],
  recent_changes: {
    last_commit: "feat: add x",
    last_commit_sha: "abc",
    last_commit_date: "2026-02-25",
    active_branches: ["feat/x"],
    open_prs: 4,
    open_issues: 7
  },
  dependencies: {
    direct: 3,
    dev: 2,
    notable: ["react", "vitest"]
  },
  agents_md: "Follow conventions",
  ...overrides
});

describe("toRepoMarkdown", () => {
  it("renders main sections and key fields", () => {
    const md = toRepoMarkdown(makeContext());

    expect(md).toContain("# Repository Context");
    expect(md).toContain("## Stack");
    expect(md).toContain("## Structure");
    expect(md).toContain("## Hot Paths");
    expect(md).toContain("src/index.ts (3 commits/30d)");
    expect(md).toContain("## Agent Notes");
  });

  it("renders open PR and issue counts", () => {
    const md = toRepoMarkdown(makeContext());
    expect(md).toContain("**Open PRs**: 4");
    expect(md).toContain("**Open Issues**: 7");
  });

  it("omits PR/issue lines when null", () => {
    const md = toRepoMarkdown(makeContext({
      recent_changes: {
        last_commit: "feat: add x",
        last_commit_sha: "abc",
        last_commit_date: "2026-02-25",
        active_branches: ["feat/x"],
        open_prs: null,
        open_issues: null
      }
    }));
    expect(md).not.toContain("Open PRs");
    expect(md).not.toContain("Open Issues");
  });
});

describe("toCompactSummary", () => {
  it("returns a one-paragraph summary", () => {
    const summary = toCompactSummary(makeContext());
    expect(summary).toContain("demo");
    expect(summary).toContain("TypeScript");
    expect(summary).toContain("React");
    expect(summary).toContain("10 files");
    expect(summary).toContain("200 lines");
    expect(summary).toContain("src/index.ts");
    expect(summary).toContain("4 open PRs");
    expect(summary).toContain("7 open issues");
  });

  it("omits PR/issue info when null", () => {
    const summary = toCompactSummary(makeContext({
      recent_changes: {
        last_commit: "feat: add x",
        last_commit_sha: "abc",
        last_commit_date: "2026-02-25",
        active_branches: [],
        open_prs: null,
        open_issues: null
      }
    }));
    expect(summary).not.toContain("open PRs");
    expect(summary).not.toContain("open issues");
  });
});
