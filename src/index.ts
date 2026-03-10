#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRepoContext, updateRepoContext } from "./context.js";
import { diffObjects, formatDiff } from "./diff.js";
import { toRepoJson, toRepoMarkdown, toCompactSummary } from "./reporter.js";
import { safeReadJson } from "./utils.js";

export function usage(): string {
  return [
    "repo-context [path]",
    "  --json              stdout JSON only",
    "  --md                stdout Markdown only",
    "  --compact           one-paragraph summary",
    "  --since <period>    filter git log (e.g. '7 days ago')",
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

interface CliIo {
  write(text: string): void;
}

export function runCli(args = process.argv.slice(2), io: CliIo = {
  write(text: string): void {
    process.stdout.write(text);
  }
}): void {

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
    if (["--json", "--md", "--compact", "--help", "--version", "--update", "--diff"].includes(arg)) return false;
    if (arg === "--out" || arg === "--since") return false;
    if (idx > 0 && (args[idx - 1] === "--out" || args[idx - 1] === "--since")) return false;
    return true;
  });

  const inputPath = filtered[0] ?? ".";
  const repoPath = resolve(inputPath);

  const jsonOnly = args.includes("--json");
  const mdOnly = args.includes("--md");

  if (diffMode && (compact || jsonOnly || mdOnly || outFile !== null)) {
    throw new Error("--diff cannot be combined with --json, --md, --compact, or --out");
  }

  const previousRepoJson = diffMode ? safeReadJson(join(repoPath, "REPO.json")) : null;

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
