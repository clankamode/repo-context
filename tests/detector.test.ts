import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { detectStack } from "../src/detector.js";

let dir: string;

describe("detectStack", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "repo-context-detector-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            next: "14.0.0",
            react: "18.0.0"
          },
          devDependencies: {
            vitest: "1.0.0"
          },
          engines: {
            node: ">=20"
          }
        },
        null,
        2
      )
    );
    writeFileSync(join(dir, "package-lock.json"), "{}");
    writeFileSync(join(dir, "src", "index.ts"), "export const a = 1;\n");
    writeFileSync(join(dir, "src", "app.jsx"), "export default function App() { return null; }\n");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("detects language, frameworks, runtime, package manager and test framework", () => {
    const result = detectStack(dir);

    expect(result.languages).toContain("TypeScript");
    expect(result.languages).toContain("JavaScript");
    expect(result.frameworks).toEqual(expect.arrayContaining(["Next.js", "React"]));
    expect(result.runtime).toBe("Node >=20");
    expect(result.package_manager).toBe("npm");
    expect(result.test_framework).toBe("Vitest");
  });
});
