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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
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

function isRefreshInfo(value: unknown): value is RefreshInfo {
  return isObject(value) && isString(value.hot_paths) && isString(value.recent_changes);
}

function isRepoContext(value: unknown): value is RepoContext {
  if (!isObject(value)) return false;
  if (!isString(value.version) || !isString(value.repo) || !isString(value.generated)) return false;
  if (!isString(value.agents_md)) return false;
  if (value.refresh !== undefined && !isRefreshInfo(value.refresh)) return false;

  const stack = value.stack;
  if (!isObject(stack)) return false;
  if (!isStringArray(stack.languages) || !isStringArray(stack.frameworks)) return false;
  if (!isNullableString(stack.runtime) || !isNullableString(stack.package_manager)) return false;
  if (!isNullableString(stack.test_framework) || !isNullableString(stack.ci)) return false;

  const structure = value.structure;
  if (!isObject(structure)) return false;
  if (!isStringArray(structure.entry_points) || !isStringArray(structure.config_files)) return false;
  if (!isStringArray(structure.test_dirs)) return false;
  if (!isNumber(structure.total_files) || !isNumber(structure.total_lines)) return false;

  const conventions = value.conventions;
  if (!isObject(conventions)) return false;
  if (!isString(conventions.commit_pattern) || !isNumber(conventions.conventional_commit_ratio)) return false;
  if (!isStringArray(conventions.common_types)) return false;

  if (!Array.isArray(value.hot_paths)) return false;
  if (!value.hot_paths.every((item) => isObject(item) && isString(item.file) && isNumber(item.commits_30d))) {
    return false;
  }

  const recentChanges = value.recent_changes;
  if (!isObject(recentChanges)) return false;
  if (!isString(recentChanges.last_commit) || !isString(recentChanges.last_commit_sha) || !isString(recentChanges.last_commit_date)) {
    return false;
  }
  if (!isStringArray(recentChanges.active_branches)) return false;
  if (!isNullableNumber(recentChanges.open_prs) || !isNullableNumber(recentChanges.open_issues)) return false;

  const dependencies = value.dependencies;
  if (!isObject(dependencies)) return false;
  if (!isNumber(dependencies.direct) || !isNumber(dependencies.dev)) return false;
  if (!isStringArray(dependencies.notable)) return false;

  return true;
}

function readCachedRepoContext(repoPath: string): RepoContext | null {
  const raw = safeReadJson(join(repoPath, "REPO.json"));
  if (!isRepoContext(raw)) return null;
  return raw;
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
