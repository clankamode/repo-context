import { describe, expect, it } from "vitest";
import { toRepoMarkdown } from "../src/reporter.js";
import { RepoContext } from "../src/types.js";

describe("toRepoMarkdown", () => {
  it("renders main sections and key fields", () => {
    const context: RepoContext = {
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
        active_branches: ["feat/x"]
      },
      dependencies: {
        direct: 3,
        dev: 2,
        notable: ["react", "vitest"]
      },
      agents_md: "Follow conventions"
    };

    const md = toRepoMarkdown(context);

    expect(md).toContain("# Repository Context");
    expect(md).toContain("## Stack");
    expect(md).toContain("## Structure");
    expect(md).toContain("## Hot Paths");
    expect(md).toContain("src/index.ts (3 commits/30d)");
    expect(md).toContain("## Agent Notes");
  });
});
