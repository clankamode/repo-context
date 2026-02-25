import { existsSync } from "node:fs";
import { join } from "node:path";
import { StackInfo } from "./types.js";
import { listRepoFiles, safeReadJson, safeReadText, unique } from "./utils.js";

const LANGUAGE_MAP: Record<string, StackInfo["languages"][number]> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust"
};

const FRAMEWORK_MAP: Record<string, string> = {
  next: "Next.js",
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  express: "Express",
  fastapi: "FastAPI",
  django: "Django"
};

const TEST_MAP: Record<string, string> = {
  vitest: "Vitest",
  jest: "Jest",
  mocha: "Mocha",
  pytest: "Pytest"
};

function getDeps(pkg: Record<string, unknown> | null): Record<string, unknown> {
  if (!pkg) return {};
  return {
    ...((pkg.dependencies as Record<string, unknown>) ?? {}),
    ...((pkg.devDependencies as Record<string, unknown>) ?? {})
  };
}

function extractNodeVersion(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^v/, "");
}

export function detectStack(repoPath: string): StackInfo {
  const files = listRepoFiles(repoPath);
  const pkg = safeReadJson(join(repoPath, "package.json"));
  const deps = getDeps(pkg);

  const languageCounts = new Map<string, number>();
  for (const file of files) {
    const idx = file.lastIndexOf(".");
    if (idx < 0) continue;
    const ext = file.slice(idx);
    const language = LANGUAGE_MAP[ext];
    if (!language) continue;
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  }

  const languages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([language]) => language as StackInfo["languages"][number]);

  const frameworks = unique(
    Object.entries(FRAMEWORK_MAP)
      .filter(([dep]) => dep in deps)
      .map(([, name]) => name)
  );

  const runtime = (() => {
    const nvmrc = safeReadText(join(repoPath, ".nvmrc"));
    if (nvmrc) return `Node ${extractNodeVersion(nvmrc)}`;

    const nodeVersion = safeReadText(join(repoPath, ".node-version"));
    if (nodeVersion) return `Node ${extractNodeVersion(nodeVersion)}`;

    const engines = (pkg?.engines as Record<string, string> | undefined)?.node;
    if (engines) return `Node ${engines}`;

    return null;
  })();

  const package_manager = (() => {
    if (existsSync(join(repoPath, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(join(repoPath, "yarn.lock"))) return "yarn";
    if (existsSync(join(repoPath, "package-lock.json"))) return "npm";
    return null;
  })();

  const test_framework = (() => {
    for (const [dep, name] of Object.entries(TEST_MAP)) {
      if (dep in deps) return name;
    }
    return null;
  })();

  const ci = (() => {
    if (files.some((f) => f.startsWith(".github/workflows/") && /\.ya?ml$/.test(f))) return "GitHub Actions";
    if (existsSync(join(repoPath, ".gitlab-ci.yml"))) return "GitLab CI";
    if (existsSync(join(repoPath, ".circleci", "config.yml"))) return "CircleCI";
    return null;
  })();

  return {
    languages,
    frameworks,
    runtime,
    package_manager,
    test_framework,
    ci
  };
}
