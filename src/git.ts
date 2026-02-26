import { HotPath, ConventionsInfo, RecentChanges } from "./types.js";
import { tryExec, tryGit } from "./utils.js";

const CONVENTIONAL_PREFIX = /^(feat|fix|chore)(\(.+\))?:\s+.+/;

export function parseHotPathsFromLog(logOutput: string, topN = 10): HotPath[] {
  const counts = new Map<string, number>();

  for (const rawLine of logOutput.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("merge ")) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([file, commits]) => ({ file, commits_30d: commits }));
}

export function getHotPaths(repoPath: string, days = 30): HotPath[] {
  const output = tryGit(repoPath, [
    "log",
    "--follow",
    `--since=${days}d`,
    "--name-only",
    "--pretty=format:"
  ]);
  if (!output) return [];
  return parseHotPathsFromLog(output);
}

export function getRecentChanges(repoPath: string, since?: string): RecentChanges {
  const logArgs = ["log", "-1", "--pretty=format:%s|%H|%ci"];
  if (since) logArgs.splice(1, 0, `--since=${since}`);
  const line = tryGit(repoPath, logArgs);
  const [message = "", sha = "", date = ""] = line.split("|");

  const branchesRaw = tryGit(repoPath, ["branch", "-r"]);
  const active_branches = branchesRaw
    .split("\n")
    .map((b) => b.replace(/^\s+/, "").replace(/^origin\//, ""))
    .filter(Boolean)
    .filter((b) => !["main", "master", "HEAD -> origin/main", "HEAD -> origin/master"].includes(b))
    .slice(0, 5);

  return {
    last_commit: message,
    last_commit_sha: sha,
    last_commit_date: date,
    active_branches,
    open_prs: getOpenPrCount(repoPath),
    open_issues: getOpenIssueCount(repoPath)
  };
}

export function getOpenPrCount(repoPath: string): number | null {
  const output = tryExec("gh", ["pr", "list", "--json", "number", "--jq", "length"], repoPath);
  if (output === null) return null;
  const n = parseInt(output, 10);
  return Number.isNaN(n) ? null : n;
}

export function getOpenIssueCount(repoPath: string): number | null {
  const output = tryExec("gh", ["issue", "list", "--json", "number", "--jq", "length"], repoPath);
  if (output === null) return null;
  const n = parseInt(output, 10);
  return Number.isNaN(n) ? null : n;
}

export function getConventions(repoPath: string, since?: string): ConventionsInfo {
  const logArgs = ["log", "-20", "--pretty=format:%s"];
  if (since) logArgs.splice(1, 0, `--since=${since}`);
  const output = tryGit(repoPath, logArgs);
  const messages = output.split("\n").map((m) => m.trim()).filter(Boolean);

  if (messages.length === 0) {
    return {
      commit_pattern: "unknown",
      conventional_commit_ratio: 0,
      common_types: []
    };
  }

  let conventional = 0;
  const typeCounts = new Map<string, number>();
  for (const msg of messages) {
    const match = msg.match(/^(\w+)(\(.+\))?:\s+/);
    if (!match) continue;
    const type = match[1];
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    if (CONVENTIONAL_PREFIX.test(msg)) conventional += 1;
  }

  const common_types = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);

  const ratio = Number((conventional / messages.length).toFixed(2));

  return {
    commit_pattern: ratio >= 0.5 ? "conventional" : "non-conventional",
    conventional_commit_ratio: ratio,
    common_types
  };
}
