import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { listRepoFiles, safeReadJson, safeReadText } from "./utils.js";
import { detectStack } from "./detector.js";

vi.mock("node:fs", () => ({ existsSync: vi.fn() }));
vi.mock("./utils.js", () => ({
  listRepoFiles: vi.fn(),
  safeReadJson: vi.fn(),
  safeReadText: vi.fn(),
  unique: (arr: string[]) => [...new Set(arr)],
}));

describe("detectStack", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(listRepoFiles).mockReturnValue([]);
    vi.mocked(safeReadJson).mockReturnValue(null);
    vi.mocked(safeReadText).mockReturnValue(null);
  });

  it("detects TypeScript and Next.js from files and package.json", () => {
    vi.mocked(listRepoFiles).mockReturnValue([
      "src/index.ts",
      "src/pages/index.tsx",
      "src/pages/about.tsx",
    ]);
    vi.mocked(safeReadJson).mockReturnValue({
      dependencies: { next: "14.0.0", react: "18.0.0" },
      devDependencies: { vitest: "^3.0.0" },
    });

    const result = detectStack("/fake/repo");

    expect(result.languages).toContain("TypeScript");
    expect(result.frameworks).toContain("Next.js");
    expect(result.frameworks).toContain("React");
    expect(result.test_framework).toBe("Vitest");
  });

  it("detects Python and FastAPI", () => {
    vi.mocked(listRepoFiles).mockReturnValue([
      "main.py",
      "app/routes.py",
      "tests/test_main.py",
    ]);
    vi.mocked(safeReadJson).mockReturnValue({
      dependencies: { fastapi: "0.100.0" },
    });

    const result = detectStack("/fake/repo");

    expect(result.languages).toContain("Python");
    expect(result.frameworks).toContain("FastAPI");
  });

  it("detects Go module", () => {
    vi.mocked(listRepoFiles).mockReturnValue([
      "main.go",
      "handlers/api.go",
      "go.mod",
    ]);

    const result = detectStack("/fake/repo");

    expect(result.languages).toContain("Go");
    expect(result.frameworks).toHaveLength(0);
  });

  it("returns empty/null for unknown repo", () => {
    const result = detectStack("/fake/repo");

    expect(result.languages).toHaveLength(0);
    expect(result.frameworks).toHaveLength(0);
    expect(result.runtime).toBeNull();
    expect(result.package_manager).toBeNull();
    expect(result.test_framework).toBeNull();
    expect(result.ci).toBeNull();
  });

  it("reads runtime from .nvmrc", () => {
    vi.mocked(safeReadText).mockImplementation((path: string) =>
      path.endsWith(".nvmrc") ? "v20.11.0" : null
    );

    const result = detectStack("/fake/repo");

    expect(result.runtime).toBe("Node 20.11.0");
  });

  it("reads runtime from engines field in package.json", () => {
    vi.mocked(safeReadJson).mockReturnValue({
      engines: { node: ">=18" },
    });

    const result = detectStack("/fake/repo");

    expect(result.runtime).toBe("Node >=18");
  });

  it("detects pnpm as package manager", () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith("pnpm-lock.yaml")
    );

    const result = detectStack("/fake/repo");

    expect(result.package_manager).toBe("pnpm");
  });

  it("detects yarn as package manager", () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith("yarn.lock")
    );

    const result = detectStack("/fake/repo");

    expect(result.package_manager).toBe("yarn");
  });

  it("detects npm as package manager", () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith("package-lock.json")
    );

    const result = detectStack("/fake/repo");

    expect(result.package_manager).toBe("npm");
  });

  it("detects GitHub Actions CI from workflows directory", () => {
    vi.mocked(listRepoFiles).mockReturnValue([
      ".github/workflows/ci.yml",
    ]);

    const result = detectStack("/fake/repo");

    expect(result.ci).toBe("GitHub Actions");
  });

  it("accepts .yaml extension for GitHub Actions", () => {
    vi.mocked(listRepoFiles).mockReturnValue([
      ".github/workflows/build.yaml",
    ]);

    const result = detectStack("/fake/repo");

    expect(result.ci).toBe("GitHub Actions");
  });

  it("orders languages by file count descending", () => {
    vi.mocked(listRepoFiles).mockReturnValue([
      "a.ts",
      "b.ts",
      "c.ts",
      "x.py",
    ]);

    const result = detectStack("/fake/repo");

    expect(result.languages[0]).toBe("TypeScript");
    expect(result.languages[1]).toBe("Python");
  });
});
