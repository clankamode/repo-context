import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

  it("errors when baseline REPO.json exists but is not valid JSON", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "REPO.json"), "{not json");
    const output: string[] = [];
    const errors: string[] = [];

    const code = main([repo, "--diff"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/REPO.json exists but is not valid JSON/);
    expect(output.join("")).not.toContain("No previous REPO.json found");
  });

  it("rejects incompatible flags", () => {
    const repo = makeRepo();

    expect(() => runCli([repo, "--diff", "--json"]))
      .toThrow("--diff cannot be combined with --json, --agent, --md, --compact, or --out");
    expect(() => runCli([repo, "--diff", "--agent"]))
      .toThrow("--diff cannot be combined with --json, --agent, --md, --compact, or --out");
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

  it("CLI --agent also fails closed on non-git paths", () => {
    const dir = makeNonGitDir();
    const errors: string[] = [];
    const output: string[] = [];

    const code = main([dir, "--agent"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/Error: Not a git repository/);
    expect(output.join("")).toBe("");
  });
});

describe("honesty: leftover silent no-ops and fake-healthy empties", () => {
  it("rejects extra positional arguments instead of scanning only the first path", () => {
    const repo = makeRepo();
    const other = makeRepo();
    const errors: string[] = [];

    const code = main([repo, other, "--json"], {
      write(): void {
        /* unused */
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/Unexpected extra argument/);
  });

  it("rejects duplicate --out instead of writing only the first file", () => {
    const repo = makeRepo();
    const first = join(repo, "a.json");
    const second = join(repo, "b.json");
    const errors: string[] = [];

    const code = main([repo, "--out", first, "--out", second], {
      write(): void {
        /* unused */
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/--out can only be specified once/);
    expect(existsSync(first)).toBe(false);
    expect(existsSync(second)).toBe(false);
  });

  it("rejects --json --agent instead of ignoring compact JSON", () => {
    const repo = makeRepo();
    const output: string[] = [];
    const errors: string[] = [];

    const code = main([repo, "--json", "--agent"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/--json cannot be combined with --agent/);
    expect(output.join("")).toBe("");
  });

  it("rejects --agent --md instead of appending markdown onto agent JSON", () => {
    const repo = makeRepo();
    const output: string[] = [];
    const errors: string[] = [];

    const code = main([repo, "--agent", "--md"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/--md cannot be combined with --json or --agent/);
    expect(output.join("")).toBe("");
  });

  it("does not count git-ignored files as a clean populated project", () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-context-ignored-cli-"));
    dirs.push(dir);
    execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, stdio: "ignore" });
    writeFileSync(join(dir, ".gitignore"), "*\n");
    writeFileSync(join(dir, "secret.ts"), "export const secret = 1;\n");
    const output: string[] = [];

    const code = main([dir, "--json"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(): void {
        /* unused */
      }
    });

    expect(code).toBe(0);
    const parsed = JSON.parse(output.join("")) as {
      structure: { total_files: number };
      stack: { languages: string[] };
    };
    expect(parsed.structure.total_files).toBe(0);
    expect(parsed.stack.languages).toEqual([]);
  });
});

describe("honesty: failed inputs are not fake-healthy", () => {
  it("rejects invalid --since instead of exiting 0 with unfiltered history", () => {
    const repo = makeRepo();
    const output: string[] = [];
    const errors: string[] = [];

    const code = main([repo, "--since", "not-a-valid-date", "--json"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/Invalid --since value: not-a-valid-date/);
    expect(output.join("")).toBe("");
  });

  it("still accepts a valid --since lookback", () => {
    const repo = makeRepo();
    const output: string[] = [];

    const code = main([repo, "--since", "7 days ago", "--json"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(): void {
        /* unused */
      }
    });

    expect(code).toBe(0);
    const parsed = JSON.parse(output.join("")) as { recent_changes: { last_commit: string } };
    expect(parsed.recent_changes.last_commit).toBe("feat: init");
  });

  it("rejects --compact --out instead of printing compact and skipping the file", () => {
    const repo = makeRepo();
    const outFile = join(repo, "out.json");
    const errors: string[] = [];

    const code = main([repo, "--compact", "--out", outFile], {
      write(): void {
        /* unused */
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/--compact cannot be combined/);
    expect(existsSync(outFile)).toBe(false);
  });

  it("fails when package.json exists but is not valid JSON", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "package.json"), "{bad");
    const output: string[] = [];
    const errors: string[] = [];

    const code = main([repo, "--json"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/package.json exists but is not valid JSON/);
    expect(output.join("")).not.toContain('"direct": 0');
  });

  it("warns when --update finds invalid REPO.json instead of silently rebuilding", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "REPO.json"), "{not json");
    const errors: string[] = [];

    const code = main([repo, "--update", "--compact"], {
      write(): void {
        /* unused */
      },
      writeError(text: string): void {
        errors.push(text);
      }
    });

    expect(code).toBe(0);
    expect(errors.join("")).toMatch(/invalid REPO.json/);
    expect(errors.join("")).toMatch(/performing full rebuild/);
  });
});

describe("agent JSON entrypoint", () => {
  it("--agent prints one compact JSON object with null GitHub counts when unavailable", () => {
    const repo = makeRepo();
    const output: string[] = [];

    const code = main([repo, "--agent"], {
      write(text: string): void {
        output.push(text);
      },
      writeError(): void {
        /* unused */
      }
    });

    expect(code).toBe(0);
    const printed = output.join("");
    expect(printed.trimEnd()).not.toContain("\n");
    const parsed = JSON.parse(printed) as {
      repo: string;
      default_branch: string | null;
      recent_changes: { open_prs: number | null; open_issues: number | null };
      hot_paths: unknown[];
      conventions: unknown;
    };
    expect(parsed.default_branch).toBe("main");
    expect(parsed.recent_changes.open_prs).toBeNull();
    expect(parsed.recent_changes.open_issues).toBeNull();
    expect(Array.isArray(parsed.hot_paths)).toBe(true);
    expect(parsed.conventions).toBeTruthy();
  });
});
