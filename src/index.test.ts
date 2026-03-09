import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const buildRepoContext = vi.fn();
const refreshStaleFields = vi.fn();

vi.mock("./context.js", () => ({
  buildRepoContext,
  refreshStaleFields,
}));

describe("CLI --update behavior", () => {
  let dir: string;
  const originalArgv = process.argv;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "repo-context-index-"));
    buildRepoContext.mockReset();
    refreshStaleFields.mockReset();
  });

  afterEach(() => {
    process.argv = originalArgv;
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("default run performs full scan without stale-only refresh", async () => {
    const fresh = {
      version: "1.0",
      repo: "demo",
      generated: "2026-03-09T00:00:00.000Z",
      stack: { languages: [], frameworks: [], runtime: null, package_manager: null, test_framework: null, ci: null },
      structure: { entry_points: [], config_files: [], test_dirs: [], total_files: 1, total_lines: 1 },
      conventions: { commit_pattern: "unknown", conventional_commit_ratio: 0, common_types: [] },
      hot_paths: [],
      recent_changes: { last_commit: "", last_commit_sha: "", last_commit_date: "", active_branches: [], open_prs: null, open_issues: null },
      dependencies: { direct: 0, dev: 0, notable: [] },
      agents_md: "",
    };
    buildRepoContext.mockReturnValue(fresh);

    const mod = await import("./index.js");

    process.argv = ["node", "repo-context", dir, "--json"];
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    mod.run();

    expect(buildRepoContext).toHaveBeenCalledTimes(1);
    expect(refreshStaleFields).not.toHaveBeenCalled();
    expect(out).toHaveBeenCalled();
  });

  it("--update fails with actionable message when REPO.json is missing", async () => {
    const fresh = {
      version: "1.0",
      repo: "demo",
      generated: "2026-03-09T00:00:00.000Z",
      stack: { languages: [], frameworks: [], runtime: null, package_manager: null, test_framework: null, ci: null },
      structure: { entry_points: [], config_files: [], test_dirs: [], total_files: 1, total_lines: 1 },
      conventions: { commit_pattern: "unknown", conventional_commit_ratio: 0, common_types: [] },
      hot_paths: [],
      recent_changes: { last_commit: "", last_commit_sha: "", last_commit_date: "", active_branches: [], open_prs: null, open_issues: null },
      dependencies: { direct: 0, dev: 0, notable: [] },
      agents_md: "",
    };
    buildRepoContext.mockReturnValue(fresh);

    const mod = await import("./index.js");

    process.argv = ["node", "repo-context", dir, "--update", "--json"];

    expect(() => mod.run()).toThrow(/Run repo-context once first/);
  });

  it("--update refreshes stale fields using existing REPO.json", async () => {
    const previous = {
      version: "1.0",
      repo: "demo",
      generated: "2026-03-01T00:00:00.000Z",
      stack: { languages: ["TypeScript"], frameworks: [], runtime: "Node 18", package_manager: "npm", test_framework: null, ci: null },
      structure: { entry_points: [], config_files: [], test_dirs: [], total_files: 10, total_lines: 100 },
      conventions: { commit_pattern: "unknown", conventional_commit_ratio: 0, common_types: [] },
      hot_paths: [{ file: "old.ts", commits_30d: 1 }],
      recent_changes: { last_commit: "old", last_commit_sha: "old", last_commit_date: "2026-03-01", active_branches: ["main"], open_prs: 0, open_issues: 0 },
      dependencies: { direct: 1, dev: 1, notable: [] },
      agents_md: "old notes",
    };
    writeFileSync(join(dir, "REPO.json"), JSON.stringify(previous), "utf8");

    const fresh = { ...previous, generated: "2026-03-09T00:00:00.000Z" };
    const merged = { ...previous, generated: fresh.generated, hot_paths: [{ file: "new.ts", commits_30d: 7 }] };

    buildRepoContext.mockReturnValue(fresh);
    refreshStaleFields.mockReturnValue(merged);

    const mod = await import("./index.js");

    process.argv = ["node", "repo-context", dir, "--update", "--json"];
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    mod.run();

    expect(refreshStaleFields).toHaveBeenCalledTimes(1);
    expect(out).toHaveBeenCalledWith(expect.stringContaining('"new.ts"'));
  });
});
