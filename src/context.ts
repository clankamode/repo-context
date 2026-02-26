import { basename, join, resolve } from "node:path";
import { detectStack } from "./detector.js";
import { getConventions, getHotPaths, getRecentChanges } from "./git.js";
import { analyzeStructure } from "./structure.js";
import { RepoContext } from "./types.js";
import { safeReadJson } from "./utils.js";

const NOTABLE_DEPS = ["next", "react", "supabase-js", "vitest", "jest", "express", "fastapi", "django", "vue", "svelte"];

export interface BuildOptions {
  hotDays?: number;
  since?: string;
}

export function buildRepoContext(repoPathArg: string, opts: BuildOptions = {}): RepoContext {
  const { hotDays = 30, since } = opts;
  const repoPath = resolve(repoPathArg);
  const stack = detectStack(repoPath);
  const structure = analyzeStructure(repoPath);
  const hot_paths = getHotPaths(repoPath, hotDays);
  const recent_changes = getRecentChanges(repoPath, since);
  const conventions = getConventions(repoPath, since);

  const pkg = safeReadJson(join(repoPath, "package.json"));
  const deps = (pkg?.dependencies as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg?.devDependencies as Record<string, string> | undefined) ?? {};

  const notable = NOTABLE_DEPS.filter((dep) => dep in deps || dep in devDeps);

  return {
    version: "1.0",
    repo: basename(repoPath),
    generated: new Date().toISOString(),
    stack,
    structure,
    conventions,
    hot_paths,
    recent_changes,
    dependencies: {
      direct: Object.keys(deps).length,
      dev: Object.keys(devDeps).length,
      notable
    },
    agents_md:
      "AI coding agents: use existing project patterns, keep changes scoped, and follow detected test/commit conventions."
  };
}
