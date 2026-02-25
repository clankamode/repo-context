import { existsSync } from "node:fs";
import { join } from "node:path";
import { StructureInfo } from "./types.js";
import { countLinesInFile, listAllFiles, listRepoFiles, safeReadJson } from "./utils.js";

const TEST_DIR_NAMES = new Set(["__tests__", "test", "tests", "e2e", "spec"]);

export function analyzeStructure(repoPath: string): StructureInfo {
  const files = listRepoFiles(repoPath);
  const allFiles = listAllFiles(repoPath);
  const pkg = safeReadJson(join(repoPath, "package.json"));

  const entry_points: string[] = [];

  const main = typeof pkg?.main === "string" ? pkg.main : null;
  if (main) entry_points.push(main);

  const exportsField = pkg?.exports;
  if (typeof exportsField === "string") entry_points.push(exportsField);
  if (exportsField && typeof exportsField === "object") {
    for (const value of Object.values(exportsField as Record<string, unknown>)) {
      if (typeof value === "string") entry_points.push(value);
      if (value && typeof value === "object") {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          if (typeof nested === "string") entry_points.push(nested);
        }
      }
    }
  }

  const conventionalEntries = ["src/index.ts", "src/app/page.tsx", "src/main.ts"];
  for (const p of conventionalEntries) {
    if (existsSync(join(repoPath, p))) entry_points.push(p);
  }

  const configCandidates = [
    "tsconfig.json",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "vite.config.js",
    "vite.config.ts",
    "vite.config.mjs",
    ".env.example",
    "Dockerfile"
  ];

  const config_files = configCandidates.filter((c) => existsSync(join(repoPath, c)));

  const dirSet = new Set<string>();
  for (const file of allFiles) {
    const parts = file.split("/");
    for (let i = 0; i < parts.length - 1; i += 1) {
      const dirName = parts[i];
      if (TEST_DIR_NAMES.has(dirName)) {
        dirSet.add(parts.slice(0, i + 1).join("/"));
      }
    }
  }

  const total_files = files.length;
  const total_lines = files.reduce((sum, file) => sum + countLinesInFile(join(repoPath, file)), 0);

  return {
    entry_points: [...new Set(entry_points)],
    config_files,
    test_dirs: [...dirSet].sort(),
    total_files,
    total_lines
  };
}
