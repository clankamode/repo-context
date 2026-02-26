import { RepoContext } from "./types.js";

export function toRepoJson(context: RepoContext): string {
  return `${JSON.stringify(context, null, 2)}\n`;
}

export function toRepoMarkdown(context: RepoContext): string {
  const hotPaths = context.hot_paths.length
    ? context.hot_paths.map((p) => `- ${p.file} (${p.commits_30d} commits/30d)`).join("\n")
    : "- None";

  const prIssue: string[] = [];
  if (context.recent_changes.open_prs !== null) {
    prIssue.push(`- **Open PRs**: ${context.recent_changes.open_prs}`);
  }
  if (context.recent_changes.open_issues !== null) {
    prIssue.push(`- **Open Issues**: ${context.recent_changes.open_issues}`);
  }

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
    `- **Last Commit**: ${context.recent_changes.last_commit}`,
    `- **SHA**: ${context.recent_changes.last_commit_sha}`,
    `- **Date**: ${context.recent_changes.last_commit_date}`,
    `- **Active Branches**: ${context.recent_changes.active_branches.join(", ") || "None"}`,
    ...prIssue,
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
  const hotFile = context.hot_paths[0]?.file ?? "N/A";
  const lastCommit = context.recent_changes.last_commit || "N/A";
  const branches = context.recent_changes.active_branches.length;

  const prPart = context.recent_changes.open_prs !== null
    ? `, ${context.recent_changes.open_prs} open PRs`
    : "";
  const issuePart = context.recent_changes.open_issues !== null
    ? `, ${context.recent_changes.open_issues} open issues`
    : "";

  return (
    `${context.repo} is a ${langs}${frameworks} project` +
    ` (${files} files, ${lines} lines).` +
    ` Hottest file: ${hotFile}.` +
    ` Last commit: "${lastCommit}".` +
    ` ${branches} active branch(es)${prPart}${issuePart}.`
  );
}
