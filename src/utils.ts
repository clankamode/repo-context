import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export function safeReadJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type JsonFileRead =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "ok"; value: Record<string, unknown> };

/** Distinguish missing vs unreadable JSON. Never treats parse failure as "file not found". */
export function readJsonFile(path: string): JsonFileRead {
  if (!existsSync(path)) return { status: "missing" };
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { status: "invalid" };
    }
    return { status: "ok", value: value as Record<string, unknown> };
  } catch {
    return { status: "invalid" };
  }
}

/** No-op when the file is absent. Throws when it exists but cannot be parsed as a JSON object. */
export function assertReadableJson(path: string): void {
  if (readJsonFile(path).status === "invalid") {
    throw new Error(`${path} exists but is not valid JSON`);
  }
}

export function safeReadText(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function runGit(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

export function tryGit(repoPath: string, args: string[]): string {
  try {
    return runGit(repoPath, args);
  } catch {
    return "";
  }
}

export function isGitRepo(repoPath: string): boolean {
  return tryGit(repoPath, ["rev-parse", "--is-inside-work-tree"]) === "true";
}

export function isGitBinaryAvailable(): boolean {
  try {
    execFileSync("git", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return true;
  } catch {
    return false;
  }
}

export function assertGitRepo(repoPath: string): void {
  if (!isGitBinaryAvailable()) {
    throw new Error("git is not available on PATH");
  }
  if (!isGitRepo(repoPath)) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }
}

export function listGitVisibleFiles(repoPath: string): string[] {
  const output = runGit(repoPath, ["ls-files", "--cached", "--others", "--exclude-standard"]);
  if (!output) return [];
  return output.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function listRepoFiles(repoPath: string): string[] {
  try {
    // Trust an empty git-visible set. Falling back to a full walk would treat
    // ignored-only (or empty) work trees as a populated clean project.
    return listGitVisibleFiles(repoPath);
  } catch {
    return listAllFiles(repoPath);
  }
}

const SKIP_WALK_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
  ".next",
  "coverage"
]);

export function listAllFiles(repoPath: string): string[] {
  const files: string[] = [];

  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && SKIP_WALK_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(relative(repoPath, fullPath).split(sep).join("/"));
      }
    }
  };

  walk(repoPath);
  return files;
}

export function countLinesInFile(filePath: string): number {
  try {
    const st = statSync(filePath);
    if (!st.isFile()) return 0;
    if (st.size > 1_000_000) return 0;
    const content = readFileSync(filePath, "utf8");
    if (content.length === 0) return 0;
    return content.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function tryExec(command: string, args: string[], cwd: string): string | null {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    return null;
  }
}
