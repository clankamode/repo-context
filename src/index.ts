#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRepoContext, inspectCachedRepoContext, updateRepoContext } from "./context.js";
import { diffObjects, formatDiff } from "./diff.js";
import { assertValidSince } from "./git.js";
import { toRepoJson, toRepoMarkdown, toCompactSummary, toAgentJson } from "./reporter.js";
import { readJsonFile } from "./utils.js";

const KNOWN_FLAGS = new Set([
  "--json",
  "--agent",
  "--md",
  "--compact",
  "--help",
  "--version",
  "--update",
  "--diff",
  "--out",
  "--since"
]);

function countFlag(args: string[], flag: string): number {
  return args.filter((arg) => arg === flag).length;
}

export function usage(): string {
  return [
    "repo-context [path]",
    "  --agent             agent entrypoint: one compact JSON object on stdout",
    "  --json              stdout pretty JSON only (same payload as --agent)",
    "  --md                stdout Markdown only",
    "  --compact           one-paragraph summary",
    "  --since <period>    filter recent_changes/conventions lookback (e.g. '7 days ago')",
    "  --update            refresh stale recent_changes and hot_paths from cache",
    "  --diff              compare previous and current REPO.json",
    "  --out <file>        write output to file (.json or .md)",
    "  --version           print version",
    "  --help              usage"
  ].join("\n");
}

export function getVersion(): string {
  return "0.2.0";
}

export interface CliIo {
  write(text: string): void;
  writeError(text: string): void;
}

const defaultIo: CliIo = {
  write(text: string): void {
    process.stdout.write(text);
  },
  writeError(text: string): void {
    process.stderr.write(text);
  }
};

function formatCliError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

export function runCli(args = process.argv.slice(2), io: CliIo = defaultIo): void {
  if (args.includes("--help")) {
    io.write(`${usage()}\n`);
    return;
  }

  if (args.includes("--version")) {
    io.write(`${getVersion()}\n`);
    return;
  }

  if (countFlag(args, "--out") > 1) {
    throw new Error("--out can only be specified once");
  }
  if (countFlag(args, "--since") > 1) {
    throw new Error("--since can only be specified once");
  }

  const outIndex = args.indexOf("--out");
  const outFile = outIndex >= 0 ? args[outIndex + 1] : null;
  if (outIndex >= 0 && !outFile) {
    throw new Error("--out requires a file path");
  }

  const sinceIndex = args.indexOf("--since");
  const since = sinceIndex >= 0 ? args[sinceIndex + 1] : undefined;
  if (sinceIndex >= 0 && !since) {
    throw new Error("--since requires a value (e.g. '7 days ago')");
  }
  if (since !== undefined) {
    assertValidSince(since);
  }

  const compact = args.includes("--compact");
  const updateOnly = args.includes("--update");
  const diffMode = args.includes("--diff");

  const filtered = args.filter((arg, idx) => {
    if (KNOWN_FLAGS.has(arg)) return false;
    if (idx > 0 && (args[idx - 1] === "--out" || args[idx - 1] === "--since")) return false;
    return true;
  });

  const unknownFlag = filtered.find((arg) => arg.startsWith("-"));
  if (unknownFlag) {
    throw new Error(`Unknown option: ${unknownFlag}\n\n${usage()}`);
  }

  if (filtered.length > 1) {
    throw new Error(`Unexpected extra argument: ${filtered[1]}`);
  }

  const inputPath = filtered[0] ?? ".";
  const repoPath = resolve(inputPath);

  if (!existsSync(repoPath)) {
    throw new Error(`Path not found: ${repoPath}`);
  }

  const jsonOnly = args.includes("--json");
  const agentOnly = args.includes("--agent");
  const mdOnly = args.includes("--md");

  if (diffMode && (compact || jsonOnly || agentOnly || mdOnly || outFile !== null)) {
    throw new Error("--diff cannot be combined with --json, --agent, --md, --compact, or --out");
  }

  if (compact && (jsonOnly || agentOnly || mdOnly || outFile !== null)) {
    throw new Error("--compact cannot be combined with --json, --agent, --md, or --out");
  }

  if (outFile !== null && (jsonOnly || agentOnly || mdOnly)) {
    throw new Error("--out cannot be combined with --json, --agent, or --md");
  }

  if (jsonOnly && agentOnly) {
    throw new Error("--json cannot be combined with --agent");
  }

  if (mdOnly && (jsonOnly || agentOnly)) {
    throw new Error("--md cannot be combined with --json or --agent");
  }

  let previousRepoJson: Record<string, unknown> | null = null;
  if (diffMode) {
    const baselinePath = join(repoPath, "REPO.json");
    const baseline = readJsonFile(baselinePath);
    switch (baseline.status) {
      case "missing":
        previousRepoJson = null;
        break;
      case "invalid":
        throw new Error(`REPO.json exists but is not valid JSON: ${baselinePath}`);
      case "ok":
        previousRepoJson = baseline.value;
        break;
      default: {
        const _exhaustive: never = baseline;
        throw new Error(`unexpected REPO.json read status: ${String(_exhaustive)}`);
      }
    }
  }

  if (updateOnly) {
    const cachePath = join(repoPath, "REPO.json");
    const cached = inspectCachedRepoContext(repoPath);
    switch (cached.status) {
      case "missing":
        io.writeError(`Warning: no REPO.json at ${cachePath}; performing full rebuild.\n`);
        break;
      case "invalid":
        io.writeError(`Warning: invalid REPO.json at ${cachePath}; performing full rebuild.\n`);
        break;
      case "ok":
        break;
      default: {
        const _exhaustive: never = cached;
        throw new Error(`unexpected cache status: ${String(_exhaustive)}`);
      }
    }
  }

  const context = updateOnly
    ? updateRepoContext(repoPath, { since })
    : buildRepoContext(repoPath, { since });

  if (compact) {
    io.write(`${toCompactSummary(context)}\n`);
    return;
  }

  const json = toRepoJson(context);
  const agentJson = toAgentJson(context);
  const md = toRepoMarkdown(context);

  if (outFile) {
    const outPath = resolve(outFile);
    if (outPath.endsWith(".json")) {
      writeFileSync(outPath, json, "utf8");
    } else if (outPath.endsWith(".md")) {
      writeFileSync(outPath, md, "utf8");
    } else {
      throw new Error("--out must end in .json or .md");
    }
    io.write(`${outPath}\n`);
    return;
  }

  const stdoutJson = jsonOnly ? json : agentOnly ? agentJson : null;

  if (stdoutJson !== null) {
    io.write(stdoutJson);
    return;
  }

  if (mdOnly) {
    io.write(md);
    return;
  }

  const repoJsonPath = join(repoPath, "REPO.json");
  const repoMdPath = join(repoPath, "REPO.md");

  writeFileSync(repoJsonPath, json, "utf8");
  writeFileSync(repoMdPath, md, "utf8");

  if (diffMode) {
    const currentRepoJson = JSON.parse(json) as unknown;
    if (!previousRepoJson) {
      io.write(`Generated ${repoJsonPath} and ${repoMdPath}\n`);
      io.write(`No previous REPO.json found at ${repoJsonPath}; baseline created.\n`);
      return;
    }
    const diff = diffObjects(previousRepoJson, currentRepoJson);
    io.write(`${formatDiff(diff)}\n`);
    return;
  }

  io.write(`Generated ${repoJsonPath} and ${repoMdPath}\n`);
}

export function main(args = process.argv.slice(2), io: CliIo = defaultIo): number {
  try {
    runCli(args, io);
    return 0;
  } catch (error) {
    io.writeError(`Error: ${formatCliError(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
