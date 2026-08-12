import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { buildRepoContext, updateRepoContext } from "./context.js";
import { toCompactSummary, toRepoJson, toRepoMarkdown } from "./reporter.js";
import { main, runCli, usage } from "./index.js";
import type { RepoContext } from "./types.js";

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn()
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
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(buildRepoContext).mockReturnValue(context);
  vi.mocked(updateRepoContext).mockReturnValue(context);
  vi.mocked(toCompactSummary).mockReturnValue("compact summary");
  vi.mocked(toRepoJson).mockReturnValue("{\"repo\":\"repo-context\"}\n");
  vi.mocked(toRepoMarkdown).mockReturnValue("# Repository Context\n");
});

function makeIo() {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    io: {
      write(text: string): void {
        output.push(text);
      },
      writeError(text: string): void {
        errors.push(text);
      }
    }
  };
}

describe("usage", () => {
  it("documents the --update flag", () => {
    expect(usage()).toContain("--update");
  });
});

describe("runCli", () => {
  it("keeps default behavior and uses full build without --update", () => {
    const { output, io } = makeIo();

    runCli(["."], io);

    expect(buildRepoContext).toHaveBeenCalledOnce();
    expect(updateRepoContext).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledTimes(2);
    expect(output[0]).toContain("Generated");
  });

  it("uses incremental update mode when --update is passed", () => {
    const { output, io } = makeIo();

    runCli(["./repo", "--update", "--since", "7 days ago"], io);

    expect(updateRepoContext).toHaveBeenCalledWith(expect.stringMatching(/repo$/), {
      since: "7 days ago"
    });
    expect(buildRepoContext).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledTimes(2);
    expect(output[0]).toContain("Generated");
  });

  it("still supports compact output in update mode", () => {
    const { output, io } = makeIo();

    runCli(["--update", "--compact"], io);

    expect(updateRepoContext).toHaveBeenCalledOnce();
    expect(toCompactSummary).toHaveBeenCalledWith(context);
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(output).toEqual(["compact summary\n"]);
  });

  it("warns on stderr when --update has no REPO.json baseline", () => {
    vi.mocked(existsSync).mockImplementation((path) => !String(path).endsWith("REPO.json"));
    const { errors, io } = makeIo();

    runCli(["./repo", "--update"], io);

    expect(errors.some((line) => line.includes("performing full rebuild"))).toBe(true);
    expect(updateRepoContext).toHaveBeenCalledOnce();
  });

  it("rejects unknown options instead of treating them as paths", () => {
    expect(() => runCli(["--watch"], makeIo().io)).toThrow(/Unknown option: --watch/);
  });

  it("rejects missing paths with a clear error", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() => runCli(["./missing"], makeIo().io)).toThrow(/Path not found/);
  });
});

describe("main", () => {
  it("returns exit code 1 and prints Error: for failures", () => {
    const { errors, io } = makeIo();
    const code = main(["--out"], io);

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/^Error: --out requires a file path/);
  });

  it("returns exit code 0 on success", () => {
    const { io } = makeIo();
    expect(main(["--help"], io)).toBe(0);
  });
});
