#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildRepoContext } from "./context.js";
import { toRepoJson, toRepoMarkdown } from "./reporter.js";

function usage(): string {
  return [
    "repo-context [path]",
    "  --json         stdout JSON only",
    "  --md           stdout Markdown only",
    "  --out <file>   write output to file (.json or .md)",
    "  --version      print version",
    "  --help         usage"
  ].join("\n");
}

function getVersion(): string {
  return "0.1.0";
}

function run(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (args.includes("--version")) {
    process.stdout.write(`${getVersion()}\n`);
    return;
  }

  const outIndex = args.indexOf("--out");
  const outFile = outIndex >= 0 ? args[outIndex + 1] : null;
  if (outIndex >= 0 && !outFile) {
    throw new Error("--out requires a file path");
  }

  const filtered = args.filter((arg, idx) => {
    if (arg === "--json" || arg === "--md" || arg === "--help" || arg === "--version") return false;
    if (arg === "--out") return false;
    if (idx > 0 && args[idx - 1] === "--out") return false;
    return true;
  });

  const inputPath = filtered[0] ?? ".";
  const repoPath = resolve(inputPath);
  const context = buildRepoContext(repoPath);

  const jsonOnly = args.includes("--json");
  const mdOnly = args.includes("--md");

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
    process.stdout.write(`${outPath}\n`);
    return;
  }

  if (jsonOnly && mdOnly) {
    process.stdout.write(json);
    process.stdout.write("\n");
    process.stdout.write(md);
    return;
  }

  if (jsonOnly) {
    process.stdout.write(json);
    return;
  }

  if (mdOnly) {
    process.stdout.write(md);
    return;
  }

  writeFileSync(join(repoPath, "REPO.json"), json, "utf8");
  writeFileSync(join(repoPath, "REPO.md"), md, "utf8");
  process.stdout.write(`Generated ${join(repoPath, "REPO.json")} and ${join(repoPath, "REPO.md")}\n`);
}

run();
