#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRepoContext, updateRepoContext } from "./context.js";
import { diffObjects, formatDiff } from "./diff.js";
import { toRepoJson, toRepoMarkdown, toCompactSummary } from "./reporter.js";
import { safeReadJson } from "./utils.js";

const KNOWN_FLAGS = new Set([
  "--json",
  "--md",
  "--compact",
  "--help",
  "--version",
  "--update",
  "--diff",
  "--out",
  "--since"
]);

export function usage(): string {
  return [
    "repo-context [path]",
    "  --json              stdout JSON only",
    "  --md                stdout Markdown only",
    "  --compact           one-paragraph summary",
    "  --since <period>    filter recent_changes lookback (e.g. '7 days ago')",
    "  --update            refresh stale recent_changes and hot_paths only",
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

  const inputPath = filtered[0] ?? ".";
  const repoPath = resolve(inputPath);

  if (!existsSync(repoPath)) {
    throw new Error(`Path not found: ${repoPath}`);
  }

  const jsonOnly = args.includes("--json");
  const mdOnly = args.includes("--md");

  if (diffMode && (compact || jsonOnly || mdOnly || outFile !== null)) {
    throw new Error("--diff cannot be combined with --json, --md, --compact, or --out");
  }

  const previousRepoJson = diffMode ? safeReadJson(join(repoPath, "REPO.json")) : null;

  if (updateOnly && !existsSync(join(repoPath, "REPO.json"))) {
    io.writeError(
      `Warning: no REPO.json at ${join(repoPath, "REPO.json")}; performing full rebuild.\n`
    );
  }

  const context = updateOnly
    ? updateRepoContext(repoPath, { since })
    : buildRepoContext(repoPath, { since });

  if (compact) {
    io.write(`${toCompactSummary(context)}\n`);
    return;
  }

  const json = toRepoJson(context);
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

  if (jsonOnly && mdOnly) {
    io.write(json);
    io.write("\n");
    io.write(md);
    return;
  }

  if (jsonOnly) {
    io.write(json);
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
