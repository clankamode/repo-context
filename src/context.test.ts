import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectStack } from "./detector.js";
import { getConventions, getHotPaths, getRecentChanges } from "./git.js";
import { analyzeStructure } from "./structure.js";
import { buildRepoContext, HOT_PATHS_MAX_AGE_MS, RECENT_CHANGES_MAX_AGE_MS, updateRepoContext } from "./context.js";
import type { RepoContext, StackInfo, StructureInfo, ConventionsInfo, HotPath, RecentChanges } from "./types.js";
import { safeReadJson } from "./utils.js";

vi.mock("./detector.js", () => ({
  detectStack: vi.fn()
}));

vi.mock("./git.js", () => ({
  getConventions: vi.fn(),
  getHotPaths: vi.fn(),
  getRecentChanges: vi.fn()
}));

vi.mock("./structure.js", () => ({
  analyzeStructure: vi.fn()
}));

vi.mock("./utils.js", () => ({
  safeReadJson: vi.fn()
}));

const stack: StackInfo = {
  languages: ["TypeScript"],
  frameworks: ["Vitest"],
  runtime: "Node 20",
  package_manager: "npm",
  test_framework: "Vitest",
  ci: "GitHub Actions"
};

const structure: StructureInfo = {
  entry_points: ["src/index.ts"],
  config_files: ["tsconfig.json"],
  test_dirs: ["tests"],
  total_files: 4,
  total_lines: 40
};

const conventions: ConventionsInfo = {
  commit_pattern: "conventional",
  conventional_commit_ratio: 0.8,
  common_types: ["feat", "fix"]
};

const hotPaths: HotPath[] = [{ file: "src/index.ts", commits_30d: 3 }];
const recentChanges: RecentChanges = {
  last_commit: "feat: add update mode",
  last_commit_sha: "abc123",
  last_commit_date: "2026-03-08 10:00:00 +0000",
  active_branches: ["fix/update-stale-fields"],
  open_prs: 1,
  open_issues: 2
};

function makeCachedContext(overrides: Partial<RepoContext> = {}): RepoContext {
  return {
    version: "1.0",
    repo: "repo-context",
    generated: "2026-03-08T10:00:00.000Z",
    stack,
    structure,
    conventions,
    hot_paths: hotPaths,
    recent_changes: recentChanges,
    dependencies: {
      direct: 1,
      dev: 1,
      notable: ["react", "vitest"]
    },
    agents_md: "Keep changes scoped",
    refresh: {
      hot_paths: "2026-03-08T10:00:00.000Z",
      recent_changes: "2026-03-08T10:00:00.000Z"
    },
    ...overrides
  };
}

function asJsonRecord(value: RepoContext): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(detectStack).mockReturnValue(stack);
  vi.mocked(analyzeStructure).mockReturnValue(structure);
  vi.mocked(getConventions).mockReturnValue(conventions);
  vi.mocked(getHotPaths).mockReturnValue(hotPaths);
  vi.mocked(getRecentChanges).mockReturnValue(recentChanges);
  vi.mocked(safeReadJson).mockReturnValue({
    dependencies: { react: "^19.0.0" },
    devDependencies: { vitest: "^3.0.0" }
  });
});

describe("buildRepoContext", () => {
  it("records refresh timestamps for incremental updates", () => {
    const now = new Date("2026-03-08T10:00:00.000Z");

    const result = buildRepoContext("/fake/repo", { now });

    expect(result.generated).toBe("2026-03-08T10:00:00.000Z");
    expect(result.refresh).toEqual({
      hot_paths: "2026-03-08T10:00:00.000Z",
      recent_changes: "2026-03-08T10:00:00.000Z"
    });
  });
});

describe("updateRepoContext", () => {
  it("reuses cached context when refreshable fields are still fresh", () => {
    vi.mocked(safeReadJson).mockReturnValueOnce(asJsonRecord(makeCachedContext()));

    const result = updateRepoContext("/fake/repo", {
      now: new Date("2026-03-08T10:30:00.000Z")
    });

    expect(result.hot_paths).toEqual(hotPaths);
    expect(result.recent_changes).toEqual(recentChanges);
    expect(getHotPaths).not.toHaveBeenCalled();
    expect(getRecentChanges).not.toHaveBeenCalled();
  });

  it("refreshes only stale recent_changes and preserves hot_paths timestamp", () => {
    vi.mocked(safeReadJson).mockReturnValueOnce(asJsonRecord(makeCachedContext({
      generated: "2026-03-06T10:00:00.000Z",
      refresh: {
        hot_paths: "2026-03-08T09:30:00.000Z",
        recent_changes: "2026-03-08T08:29:59.000Z"
      }
    })));

    const nextRecentChanges = {
      ...recentChanges,
      last_commit: "fix: refresh stale fields"
    };
    vi.mocked(getRecentChanges).mockReturnValue(nextRecentChanges);

    const result = updateRepoContext("/fake/repo", {
      now: new Date("2026-03-08T09:30:00.000Z"),
      recentChangesMaxAgeMs: RECENT_CHANGES_MAX_AGE_MS
    });

    expect(result.recent_changes).toEqual(nextRecentChanges);
    expect(result.hot_paths).toEqual(hotPaths);
    expect(result.refresh).toEqual({
      hot_paths: "2026-03-08T09:30:00.000Z",
      recent_changes: "2026-03-08T09:30:00.000Z"
    });
    expect(getRecentChanges).toHaveBeenCalledOnce();
    expect(getHotPaths).not.toHaveBeenCalled();
  });

  it("refreshes hot_paths when stale and leaves recent_changes untouched", () => {
    vi.mocked(safeReadJson).mockReturnValueOnce(asJsonRecord(makeCachedContext({
      generated: "2026-03-06T10:00:00.000Z",
      refresh: {
        hot_paths: "2026-03-07T09:29:59.000Z",
        recent_changes: "2026-03-08T09:00:00.000Z"
      }
    })));

    const nextHotPaths = [{ file: "src/context.ts", commits_30d: 8 }];
    vi.mocked(getHotPaths).mockReturnValue(nextHotPaths);

    const result = updateRepoContext("/fake/repo", {
      now: new Date("2026-03-08T09:30:00.000Z"),
      hotPathsMaxAgeMs: HOT_PATHS_MAX_AGE_MS
    });

    expect(result.hot_paths).toEqual(nextHotPaths);
    expect(result.recent_changes).toEqual(recentChanges);
    expect(result.refresh).toEqual({
      hot_paths: "2026-03-08T09:30:00.000Z",
      recent_changes: "2026-03-08T09:00:00.000Z"
    });
    expect(getHotPaths).toHaveBeenCalledOnce();
    expect(getRecentChanges).not.toHaveBeenCalled();
  });

  it("forces recent_changes refresh when --since is provided", () => {
    vi.mocked(safeReadJson).mockReturnValueOnce(asJsonRecord(makeCachedContext()));

    updateRepoContext("/fake/repo", {
      now: new Date("2026-03-08T10:30:00.000Z"),
      since: "7 days ago"
    });

    expect(getRecentChanges).toHaveBeenCalledWith("/fake/repo", "7 days ago");
    expect(getHotPaths).not.toHaveBeenCalled();
  });

  it("falls back to a full build when no cached REPO.json exists", () => {
    vi.mocked(safeReadJson).mockReturnValueOnce(null);

    const result = updateRepoContext("/fake/repo", {
      now: new Date("2026-03-08T10:00:00.000Z")
    });

    expect(result.stack).toEqual(stack);
    expect(detectStack).toHaveBeenCalledOnce();
    expect(analyzeStructure).toHaveBeenCalledOnce();
    expect(getConventions).toHaveBeenCalledOnce();
    expect(getHotPaths).toHaveBeenCalledOnce();
    expect(getRecentChanges).toHaveBeenCalledOnce();
  });

  it("falls back to a full build when cached REPO.json is malformed", () => {
    vi.mocked(safeReadJson).mockReturnValueOnce({
      version: "1.0",
      hot_paths: [],
      recent_changes: {}
    });

    const result = updateRepoContext("/fake/repo", {
      now: new Date("2026-03-08T10:00:00.000Z")
    });

    expect(result.stack).toEqual(stack);
    expect(detectStack).toHaveBeenCalledOnce();
    expect(analyzeStructure).toHaveBeenCalledOnce();
    expect(getConventions).toHaveBeenCalledOnce();
    expect(getHotPaths).toHaveBeenCalledOnce();
    expect(getRecentChanges).toHaveBeenCalledOnce();
  });
});
