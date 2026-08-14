import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { assertGitRepo, isGitRepo } from "./utils.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("isGitRepo / assertGitRepo", () => {
  it("returns true for a real git work tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-context-git-"));
    dirs.push(dir);
    execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
    expect(isGitRepo(dir)).toBe(true);
    expect(() => assertGitRepo(dir)).not.toThrow();
  });

  it("returns false and asserts for a plain directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-context-plain-"));
    dirs.push(dir);
    writeFileSync(join(dir, "readme.txt"), "hi\n");
    expect(isGitRepo(dir)).toBe(false);
    expect(() => assertGitRepo(dir)).toThrow(`Not a git repository: ${dir}`);
  });
});
