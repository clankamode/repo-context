import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { listRepoFiles, listAllFiles, safeReadJson, countLinesInFile } from "./utils.js";
import { analyzeStructure } from "./structure.js";

vi.mock("node:fs", () => ({ existsSync: vi.fn() }));
vi.mock("./utils.js", () => ({
  listRepoFiles: vi.fn(),
  listAllFiles: vi.fn(),
  safeReadJson: vi.fn(),
  countLinesInFile: vi.fn(),
}));

describe("analyzeStructure", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(listRepoFiles).mockReturnValue([]);
    vi.mocked(listAllFiles).mockReturnValue([]);
    vi.mocked(safeReadJson).mockReturnValue(null);
    vi.mocked(countLinesInFile).mockReturnValue(0);
  });

  it("counts total files and lines", () => {
    vi.mocked(listRepoFiles).mockReturnValue(["src/a.ts", "src/b.ts"]);
    vi.mocked(countLinesInFile).mockReturnValue(50);

    const result = analyzeStructure("/fake/repo");

    expect(result.total_files).toBe(2);
    expect(result.total_lines).toBe(100);
  });

  it("detects test directories at top level", () => {
    vi.mocked(listAllFiles).mockReturnValue([
      "__tests__/foo.test.ts",
      "e2e/login.spec.ts",
    ]);

    const result = analyzeStructure("/fake/repo");

    expect(result.test_dirs).toContain("__tests__");
    expect(result.test_dirs).toContain("e2e");
  });

  it("detects nested test directories", () => {
    vi.mocked(listAllFiles).mockReturnValue([
      "src/tests/bar.test.ts",
    ]);

    const result = analyzeStructure("/fake/repo");

    expect(result.test_dirs).toContain("src/tests");
  });

  it("detects config files that exist on disk", () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith("tsconfig.json") ||
      String(path).endsWith("next.config.js")
    );

    const result = analyzeStructure("/fake/repo");

    expect(result.config_files).toContain("tsconfig.json");
    expect(result.config_files).toContain("next.config.js");
    expect(result.config_files).not.toContain("vite.config.ts");
  });

  it("includes package.json main field as entry point", () => {
    vi.mocked(safeReadJson).mockReturnValue({ main: "dist/index.js" });

    const result = analyzeStructure("/fake/repo");

    expect(result.entry_points).toContain("dist/index.js");
  });

  it("includes string exports field as entry point", () => {
    vi.mocked(safeReadJson).mockReturnValue({ exports: "./src/index.js" });

    const result = analyzeStructure("/fake/repo");

    expect(result.entry_points).toContain("./src/index.js");
  });

  it("includes conventional src/index.ts when it exists", () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith("src/index.ts")
    );

    const result = analyzeStructure("/fake/repo");

    expect(result.entry_points).toContain("src/index.ts");
  });

  it("returns empty arrays and zero counts for bare repo", () => {
    const result = analyzeStructure("/fake/repo");

    expect(result.entry_points).toHaveLength(0);
    expect(result.config_files).toHaveLength(0);
    expect(result.test_dirs).toHaveLength(0);
    expect(result.total_files).toBe(0);
    expect(result.total_lines).toBe(0);
  });

  it("deduplicates entry points when pkg.main matches a conventional entry", () => {
    vi.mocked(safeReadJson).mockReturnValue({ main: "src/index.ts" });
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith("src/index.ts")
    );

    const result = analyzeStructure("/fake/repo");

    const count = result.entry_points.filter((e) => e === "src/index.ts").length;
    expect(count).toBe(1);
  });

  it("returns test_dirs sorted alphabetically", () => {
    vi.mocked(listAllFiles).mockReturnValue([
      "spec/foo.ts",
      "__tests__/bar.ts",
      "e2e/baz.ts",
    ]);

    const result = analyzeStructure("/fake/repo");

    expect(result.test_dirs).toEqual([...result.test_dirs].sort());
  });
});
