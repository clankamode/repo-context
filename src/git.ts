import { HotPath, ConventionsInfo, RecentChanges } from "./types.js";
import { tryExec, tryGit } from "./utils.js";

const CONVENTIONAL_PREFIX = /^(feat|fix|chore)(\(.+\))?:\s+.+/;
const GITHUB_REMOTE_PATTERN = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i;
const GITHUB_REMOTE_LINE = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/;
const GITHUB_REPO_SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

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
  const githubRepo = getGitHubRepoSlug(repoPath);

  return {
    last_commit: message,
    last_commit_sha: sha,
    last_commit_date: date,
    active_branches,
    open_prs: getOpenPrCount(repoPath, githubRepo),
    open_issues: getOpenIssueCount(repoPath, githubRepo)
  };
}

export function getGitHubRepoSlug(repoPath: string): string | null {
  const remotes = tryGit(repoPath, ["remote", "-v"]);

  if (remotes) {
    const fallback: string[] = [];
    for (const rawLine of remotes.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.match(GITHUB_REMOTE_LINE);
      if (!parts) continue;
      const [_, remoteName, remoteUrl, direction] = parts;
      const slug = parseGitHubRepoSlug(remoteUrl);
      if (!slug) continue;
      if (remoteName === "origin" && direction === "fetch") return slug;
      fallback.push(slug);
    }

    if (fallback[0]) return fallback[0];
  }

  const ghRepo = tryExec("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], repoPath);
  if (!ghRepo) return null;
  const slug = ghRepo.trim();
  return GITHUB_REPO_SLUG.test(slug) ? slug : null;
}

export function parseGitHubRepoSlug(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  const match = trimmed.match(GITHUB_REMOTE_PATTERN);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return null;
  return `${owner}/${repo}`;
}

function getGitHubCount(repoPath: string, githubRepo: string | null, type: "pullRequests" | "issues"): number | null {
  if (!githubRepo) return null;
  const [owner, name] = githubRepo.split("/", 2);
  if (!owner || !name) return null;

  const countField = type === "pullRequests" ? "pullRequests(states: OPEN)" : "issues(states: OPEN)";
  const jqPath = type === "pullRequests"
    ? ".data.repository.pullRequests.totalCount"
    : ".data.repository.issues.totalCount";
  const query = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${countField}{totalCount}}}`;

  const output = tryExec("gh", ["api", "graphql", "-f", `query=${query}`, "-F", `owner=${owner}`, "-F", `name=${name}`, "--jq", jqPath], repoPath);
  if (output === null) return null;
  const n = parseInt(output, 10);
  return Number.isNaN(n) ? null : n;
}

export function getOpenPrCount(repoPath: string, githubRepo = getGitHubRepoSlug(repoPath)): number | null {
  return getGitHubCount(repoPath, githubRepo, "pullRequests");
}

export function getOpenIssueCount(repoPath: string, githubRepo = getGitHubRepoSlug(repoPath)): number | null {
  return getGitHubCount(repoPath, githubRepo, "issues");
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
