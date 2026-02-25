export type Language = "TypeScript" | "JavaScript" | "Python" | "Go" | "Rust";

export interface StackInfo {
  languages: Language[];
  frameworks: string[];
  runtime: string | null;
  package_manager: string | null;
  test_framework: string | null;
  ci: string | null;
}

export interface StructureInfo {
  entry_points: string[];
  config_files: string[];
  test_dirs: string[];
  total_files: number;
  total_lines: number;
}

export interface ConventionsInfo {
  commit_pattern: string;
  conventional_commit_ratio: number;
  common_types: string[];
}

export interface HotPath {
  file: string;
  commits_30d: number;
}

export interface RecentChanges {
  last_commit: string;
  last_commit_sha: string;
  last_commit_date: string;
  active_branches: string[];
}

export interface DependenciesInfo {
  direct: number;
  dev: number;
  notable: string[];
}

export interface RepoContext {
  version: string;
  repo: string;
  generated: string;
  stack: StackInfo;
  structure: StructureInfo;
  conventions: ConventionsInfo;
  hot_paths: HotPath[];
  recent_changes: RecentChanges;
  dependencies: DependenciesInfo;
  agents_md: string;
}
