import { describe, expect, it } from "vitest";
import { refreshStaleFields } from "./context.js";
import { RepoContext } from "./types.js";

function makeContext(partial: Partial<RepoContext> = {}): RepoContext {
  return {
    version: "1.0",
    repo: "demo",
    generated: "2026-03-01T00:00:00.000Z",
    stack: {
      languages: ["TypeScript"],
      frameworks: ["React"],
      runtime: "Node 20",
      package_manager: "npm",
      test_framework: "Vitest",
      ci: "GitHub Actions",
    },
    structure: {
      entry_points: ["src/index.ts"],
      config_files: ["tsconfig.json"],
      test_dirs: ["tests"],
      total_files: 50,
      total_lines: 500,
    },
    conventions: {
      commit_pattern: "conventional",
      conventional_commit_ratio: 0.7,
      common_types: ["feat", "fix"],
    },
    hot_paths: [{ file: "src/old.ts", commits_30d: 1 }],
    recent_changes: {
      last_commit: "feat: old",
      last_commit_sha: "oldsha",
      last_commit_date: "2026-03-01",
      active_branches: ["main"],
      open_prs: 1,
      open_issues: 2,
    },
    dependencies: {
      direct: 10,
      dev: 5,
      notable: ["react"],
    },
    agents_md: "follow rules",
    ...partial,
  };
}

describe("refreshStaleFields", () => {
  it("refreshes only hot_paths and recent_changes for --update", () => {
    const previous = makeContext({
      stack: { ...makeContext().stack, runtime: "Node 18" },
      structure: { ...makeContext().structure, total_files: 99 },
      dependencies: { direct: 3, dev: 1, notable: ["vitest"] },
    });

    const fresh = makeContext({
      generated: "2026-03-09T12:00:00.000Z",
      hot_paths: [{ file: "src/new.ts", commits_30d: 8 }],
      recent_changes: {
        last_commit: "fix: new",
        last_commit_sha: "newsha",
        last_commit_date: "2026-03-09",
        active_branches: ["main", "feat/update"],
        open_prs: 3,
        open_issues: 4,
      },
      stack: { ...makeContext().stack, runtime: "Node 22" },
      structure: { ...makeContext().structure, total_files: 1234 },
    });

    const merged = refreshStaleFields(previous, fresh);

    expect(merged.generated).toBe(fresh.generated);
    expect(merged.hot_paths).toEqual(fresh.hot_paths);
    expect(merged.recent_changes).toEqual(fresh.recent_changes);

    expect(merged.stack.runtime).toBe("Node 18");
    expect(merged.structure.total_files).toBe(99);
    expect(merged.dependencies).toEqual(previous.dependencies);
  });
});
