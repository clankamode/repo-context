import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFileSync } from "node:fs";
import { buildRepoContext, updateRepoContext } from "./context.js";
import { toCompactSummary, toRepoJson, toRepoMarkdown } from "./reporter.js";
import { runCli, usage } from "./index.js";
import type { RepoContext } from "./types.js";

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn()
}));

vi.mock("./context.js", () => ({
  buildRepoContext: vi.fn(),
  updateRepoContext: vi.fn()
}));

vi.mock("./reporter.js", () => ({
  toCompactSummary: vi.fn(),
  toRepoJson: vi.fn(),
  toRepoMarkdown: vi.fn()
}));

const context: RepoContext = {
  version: "1.0",
  repo: "repo-context",
  generated: "2026-03-08T10:00:00.000Z",
  stack: {
    languages: ["TypeScript"],
    frameworks: [],
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
    total_lines: 100
  },
  conventions: {
    commit_pattern: "conventional",
    conventional_commit_ratio: 0.8,
    common_types: ["feat"]
  },
  hot_paths: [],
  recent_changes: {
    last_commit: "feat: add --update",
    last_commit_sha: "abc123",
    last_commit_date: "2026-03-08",
    active_branches: [],
    open_prs: 0,
    open_issues: 0
  },
  dependencies: {
    direct: 1,
    dev: 1,
    notable: ["vitest"]
  },
  agents_md: "Keep changes scoped",
  refresh: {
    hot_paths: "2026-03-08T10:00:00.000Z",
    recent_changes: "2026-03-08T10:00:00.000Z"
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildRepoContext).mockReturnValue(context);
  vi.mocked(updateRepoContext).mockReturnValue(context);
  vi.mocked(toCompactSummary).mockReturnValue("compact summary");
  vi.mocked(toRepoJson).mockReturnValue("{\"repo\":\"repo-context\"}\n");
  vi.mocked(toRepoMarkdown).mockReturnValue("# Repository Context\n");
});

describe("usage", () => {
  it("documents the --update flag", () => {
    expect(usage()).toContain("--update");
  });
});

describe("runCli", () => {
  it("keeps default behavior and uses full build without --update", () => {
    const output: string[] = [];

    runCli(["."], { write: (text) => output.push(text) });

    expect(buildRepoContext).toHaveBeenCalledOnce();
    expect(updateRepoContext).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledTimes(2);
    expect(output[0]).toContain("Generated");
  });

  it("uses incremental update mode when --update is passed", () => {
    const output: string[] = [];

    runCli(["./repo", "--update", "--since", "7 days ago"], {
      write: (text) => output.push(text)
    });

    expect(updateRepoContext).toHaveBeenCalledWith(expect.stringMatching(/repo$/), {
      since: "7 days ago"
    });
    expect(buildRepoContext).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledTimes(2);
    expect(output[0]).toContain("Generated");
  });

  it("still supports compact output in update mode", () => {
    const output: string[] = [];

    runCli(["--update", "--compact"], { write: (text) => output.push(text) });

    expect(updateRepoContext).toHaveBeenCalledOnce();
    expect(toCompactSummary).toHaveBeenCalledWith(context);
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(output).toEqual(["compact summary\n"]);
  });
});
