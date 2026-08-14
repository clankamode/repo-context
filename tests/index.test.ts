import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepoContext } from "../src/context.js";
import { main, runCli } from "../src/index.js";

const dirs: string[] = [];

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "repo-context-cli-"));
  dirs.push(dir);

  writeFileSync(join(dir, "package.json"), JSON.stringify({
    name: "tmp-repo",
    version: "1.0.0",
    dependencies: { react: "18.0.0" },
    devDependencies: { vitest: "3.0.8" }
  }, null, 2));
  writeFileSync(join(dir, "index.js"), "console.log('hello')\n");

  execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "feat: init"], { cwd: dir, stdio: "ignore" });

  return dir;
}

function makeNonGitDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "repo-context-nongit-"));
  dirs.push(dir);
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "nongit" }, null, 2));
  writeFileSync(join(dir, "src", "index.js"), "console.log(1)\n");
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("runCli --diff", () => {
  it("prints diff against existing REPO.json baseline", () => {
    const repo = makeRepo();
    const output: string[] = [];

    runCli([repo]);
    writeFileSync(join(repo, "index.js"), "console.log('hello world')\n");

    runCli([repo, "--diff"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(): void {
        /* unused */
      }
    });

    const printed = output.join("");
    expect(printed).toContain("REPO.json changes:");
    expect(printed).toContain("generated");
  });

  it("handles missing baseline REPO.json safely", () => {
    const repo = makeRepo();
    const output: string[] = [];

    runCli([repo, "--diff"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(): void {
        /* unused */
      }
    });

    const printed = output.join("");
    expect(printed).toContain("No previous REPO.json found");
  });

  it("rejects incompatible flags", () => {
    const repo = makeRepo();

    expect(() => runCli([repo, "--diff", "--json"]))
      .toThrow("--diff cannot be combined with --json, --md, --compact, or --out");
  });
});

describe("non-git paths", () => {
  it("buildRepoContext refuses non-git directories", () => {
    const dir = makeNonGitDir();
    expect(() => buildRepoContext(dir)).toThrow(/Not a git repository/);
  });

  it("CLI exits 1 with a clear error instead of writing fake-healthy context", () => {
    const dir = makeNonGitDir();
    const errors: string[] = [];
    const output: string[] = [];

    const code = main([dir, "--compact"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/Error: Not a git repository/);
    expect(output.join("")).not.toContain("Hottest file");
  });
});
