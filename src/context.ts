import { basename, join, resolve } from "node:path";
import { detectStack } from "./detector.js";
import { getConventions, getHotPaths, getRecentChanges } from "./git.js";
import { analyzeStructure } from "./structure.js";
import { RefreshInfo, RepoContext } from "./types.js";
import { safeReadJson } from "./utils.js";

const NOTABLE_DEPS = ["next", "react", "supabase-js", "vitest", "jest", "express", "fastapi", "django", "vue", "svelte"];
export const RECENT_CHANGES_MAX_AGE_MS = 60 * 60 * 1000;
export const HOT_PATHS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface BuildOptions {
  hotDays?: number;
  since?: string;
  now?: Date;
}

export interface UpdateOptions extends BuildOptions {
  recentChangesMaxAgeMs?: number;
  hotPathsMaxAgeMs?: number;
}

function getRefreshInfo(context: RepoContext): RefreshInfo {
  return {
    hot_paths: context.refresh?.hot_paths ?? context.generated,
    recent_changes: context.refresh?.recent_changes ?? context.generated
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCachedRepoContext(repoPath: string): RepoContext | null {
  const raw = safeReadJson(join(repoPath, "REPO.json"));
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.hot_paths)) return null;
  if (!isObject(raw.recent_changes)) return null;
  return raw as unknown as RepoContext;
}

function isStale(timestamp: string, maxAgeMs: number, now: Date): boolean {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return true;
  return now.getTime() - parsed >= maxAgeMs;
}

export function buildRepoContext(repoPathArg: string, opts: BuildOptions = {}): RepoContext {
  const { hotDays = 30, since, now = new Date() } = opts;
  const repoPath = resolve(repoPathArg);
  const stack = detectStack(repoPath);
  const structure = analyzeStructure(repoPath);
  const hot_paths = getHotPaths(repoPath, hotDays);
  const recent_changes = getRecentChanges(repoPath, since);
  const conventions = getConventions(repoPath, since);
  const generated = now.toISOString();

  const pkg = safeReadJson(join(repoPath, "package.json"));
  const deps = (pkg?.dependencies as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg?.devDependencies as Record<string, string> | undefined) ?? {};

  const notable = NOTABLE_DEPS.filter((dep) => dep in deps || dep in devDeps);

  return {
    version: "1.0",
    repo: basename(repoPath),
    generated,
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
      "AI coding agents: use existing project patterns, keep changes scoped, and follow detected test/commit conventions.",
    refresh: {
      hot_paths: generated,
      recent_changes: generated
    }
  };
}

export function updateRepoContext(repoPathArg: string, opts: UpdateOptions = {}): RepoContext {
  const {
    hotDays = 30,
    since,
    now = new Date(),
    recentChangesMaxAgeMs = RECENT_CHANGES_MAX_AGE_MS,
    hotPathsMaxAgeMs = HOT_PATHS_MAX_AGE_MS
  } = opts;
  const repoPath = resolve(repoPathArg);
  const cached = readCachedRepoContext(repoPath);

  if (!cached) {
    return buildRepoContext(repoPath, { hotDays, since, now });
  }

  const generated = now.toISOString();
  const refresh = getRefreshInfo(cached);
  const shouldRefreshRecentChanges =
    since !== undefined || isStale(refresh.recent_changes, recentChangesMaxAgeMs, now);
  const shouldRefreshHotPaths = isStale(refresh.hot_paths, hotPathsMaxAgeMs, now);

  return {
    ...cached,
    generated,
    hot_paths: shouldRefreshHotPaths ? getHotPaths(repoPath, hotDays) : cached.hot_paths,
    recent_changes: shouldRefreshRecentChanges ? getRecentChanges(repoPath, since) : cached.recent_changes,
    refresh: {
      hot_paths: shouldRefreshHotPaths ? generated : refresh.hot_paths,
      recent_changes: shouldRefreshRecentChanges ? generated : refresh.recent_changes
    }
  };
}
