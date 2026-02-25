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

export function listGitVisibleFiles(repoPath: string): string[] {
  const output = tryGit(repoPath, ["ls-files", "--cached", "--others", "--exclude-standard"]);
  if (!output) return [];
  return output.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function listRepoFiles(repoPath: string): string[] {
  const gitFiles = listGitVisibleFiles(repoPath);
  if (gitFiles.length > 0) return gitFiles;
  return listAllFiles(repoPath);
}

export function listAllFiles(repoPath: string): string[] {
  const files: string[] = [];

  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git") continue;
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
