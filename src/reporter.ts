import { RepoContext } from "./types.js";

const UNAVAILABLE = "Unavailable";

function displayOrUnavailable(value: string): string {
  return value.trim() ? value : UNAVAILABLE;
}

function formatNullableCount(value: number | null): string {
  // null covers missing GitHub remote, missing gh, auth failure, or network errors —
  // do not blame "gh auth" alone.
  return value === null ? `${UNAVAILABLE} (GitHub remote or gh required)` : String(value);
}

export function toRepoJson(context: RepoContext): string {
  return `${JSON.stringify(context, null, 2)}\n`;
}

export function toRepoMarkdown(context: RepoContext): string {
  const hotPaths = context.hot_paths.length
    ? context.hot_paths.map((p) => `- ${p.file} (${p.commits_30d} commits/30d)`).join("\n")
    : "- None detected in lookback window";

  const lines = [
    "# Repository Context",
    "",
    `- **Repo**: ${context.repo}`,
    `- **Generated**: ${context.generated}`,
    "",
    "## Stack",
    `- **Languages**: ${context.stack.languages.join(", ") || "Unknown"}`,
    `- **Frameworks**: ${context.stack.frameworks.join(", ") || "None"}`,
    `- **Runtime**: ${context.stack.runtime ?? "Unknown"}`,
    `- **Package Manager**: ${context.stack.package_manager ?? "Unknown"}`,
    `- **Test Framework**: ${context.stack.test_framework ?? "Unknown"}`,
    `- **CI**: ${context.stack.ci ?? "Unknown"}`,
    "",
    "## Structure",
    `- **Entry Points**: ${context.structure.entry_points.join(", ") || "None"}`,
    `- **Config Files**: ${context.structure.config_files.join(", ") || "None"}`,
    `- **Test Dirs**: ${context.structure.test_dirs.join(", ") || "None"}`,
    `- **Total Files**: ${context.structure.total_files}`,
    `- **Total Lines**: ${context.structure.total_lines}`,
    "",
    "## Conventions",
    `- **Commit Pattern**: ${context.conventions.commit_pattern}`,
    `- **Conventional Ratio**: ${context.conventions.conventional_commit_ratio}`,
    `- **Common Commit Types**: ${context.conventions.common_types.join(", ") || "None"}`,
    "",
    "## Hot Paths",
    hotPaths,
    "",
    "## Recent Changes",
    `- **Last Commit**: ${displayOrUnavailable(context.recent_changes.last_commit)}`,
    `- **SHA**: ${displayOrUnavailable(context.recent_changes.last_commit_sha)}`,
    `- **Date**: ${displayOrUnavailable(context.recent_changes.last_commit_date)}`,
    `- **Active Branches**: ${context.recent_changes.active_branches.join(", ") || "None"}`,
    `- **Open PRs**: ${formatNullableCount(context.recent_changes.open_prs)}`,
    `- **Open Issues**: ${formatNullableCount(context.recent_changes.open_issues)}`,
    "",
    "## Dependencies",
    `- **Direct**: ${context.dependencies.direct}`,
    `- **Dev**: ${context.dependencies.dev}`,
    `- **Notable**: ${context.dependencies.notable.join(", ") || "None"}`,
    "",
    "## Agent Notes",
    context.agents_md
  ];

  return `${lines.join("\n")}\n`;
}

export function toCompactSummary(context: RepoContext): string {
  const langs = context.stack.languages.join(", ") || "unknown languages";
  const frameworks = context.stack.frameworks.length
    ? ` with ${context.stack.frameworks.join(", ")}`
    : "";
  const files = context.structure.total_files;
  const lines = context.structure.total_lines;
  const hotFile = context.hot_paths[0]?.file ?? "none detected";
  const lastCommit = context.recent_changes.last_commit.trim() || UNAVAILABLE;
  const branches = context.recent_changes.active_branches.length;

  const { open_prs: openPrs, open_issues: openIssues } = context.recent_changes;
  let countsPart = "";
  if (openPrs !== null && openIssues !== null) {
    countsPart = `, ${openPrs} open PRs, ${openIssues} open issues`;
  } else if (openPrs !== null) {
    countsPart = `, ${openPrs} open PRs, open issues unavailable`;
  } else if (openIssues !== null) {
    countsPart = `, open PRs unavailable, ${openIssues} open issues`;
  } else {
    countsPart = ", open PR/issue counts unavailable";
  }

  return (
    `${context.repo} is a ${langs}${frameworks} project` +
    ` (${files} files, ${lines} lines).` +
    ` Hottest file: ${hotFile}.` +
    ` Last commit: "${lastCommit}".` +
    ` ${branches} active branch(es)${countsPart}.`
  );
}
