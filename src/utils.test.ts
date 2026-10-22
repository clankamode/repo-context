import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { assertGitRepo, assertReadableJson, isGitBinaryAvailable, isGitRepo, listRepoFiles, readJsonFile } from "./utils.js";

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

  it("names a missing git binary instead of claiming the path is not a repo", () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-context-nogit-"));
    dirs.push(dir);
    const originalPath = process.env.PATH;
    process.env.PATH = "/no-such-bin";
    try {
      expect(isGitBinaryAvailable()).toBe(false);
      expect(() => assertGitRepo(dir)).toThrow(/git is not available on PATH/);
      expect(() => assertGitRepo(dir)).not.toThrow(/Not a git repository/);
    } finally {
      process.env.PATH = originalPath;
    }
  });
});

describe("listRepoFiles", () => {
  it("does not treat git-ignored files as a populated project when the visible set is empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-context-ignored-"));
    dirs.push(dir);
    execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
    writeFileSync(join(dir, ".gitignore"), "*\n");
    writeFileSync(join(dir, "secret.ts"), "export const secret = 1;\n");
    writeFileSync(join(dir, "ignored.js"), "console.log('nope')\n");

    expect(listRepoFiles(dir)).toEqual([]);
  });

  it("still walks the filesystem when the path is not a git work tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-context-nongit-files-"));
    dirs.push(dir);
    writeFileSync(join(dir, "index.ts"), "export const n = 1;\n");

    expect(listRepoFiles(dir)).toEqual(["index.ts"]);
  });
});

describe("readJsonFile / assertReadableJson", () => {
  it("distinguishes missing files from corrupt JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-context-json-"));
    dirs.push(dir);
    const missing = join(dir, "missing.json");
    const corrupt = join(dir, "corrupt.json");
    writeFileSync(corrupt, "{not json");

    expect(readJsonFile(missing)).toEqual({ status: "missing" });
    expect(readJsonFile(corrupt)).toEqual({ status: "invalid" });
    expect(() => assertReadableJson(missing)).not.toThrow();
    expect(() => assertReadableJson(corrupt)).toThrow(`${corrupt} exists but is not valid JSON`);
  });
});
