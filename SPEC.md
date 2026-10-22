# repo-context — Product Spec

> One command. One file. Every agent knows your repo.

## Problem

Every coding agent wastes tokens and time figuring out the same things about a codebase:
- What's the tech stack?
- What are the main entry points?
- What are the conventions?
- What changed recently?
- Which files are "hot" (frequently modified)?

GitNexus, Axon, mcp-vector-search — all exist, all fragmented, all require setup. Nobody ships the simple thing: **a single structured file that any agent can read in one shot**.

## Product

`repo-context` generates a `REPO.md` (human-readable) and `REPO.json` (agent-consumable) for any Git repo. Think of it as `git log --oneline` but for agents instead of humans.

## Output Schema (REPO.json)

```json
{
  "version": "1.0",
  "repo": "owner/repo",
  "default_branch": "main",
  "generated": "2026-02-25T15:00:00Z",
  "stack": {
    "languages": ["TypeScript", "CSS"],
    "frameworks": ["Next.js", "React"],
    "runtime": "Node 22",
    "package_manager": "npm",
    "test_framework": "Vitest",
    "ci": "GitHub Actions"
  },
  "structure": {
    "entry_points": ["src/app/page.tsx", "src/app/layout.tsx"],
    "config_files": ["next.config.ts", "tsconfig.json", ".env.local"],
    "test_dirs": ["src/__tests__", "e2e"],
    "total_files": 342,
    "total_lines": 28410
  },
  "conventions": {
    "commit_pattern": "conventional",
    "conventional_commit_ratio": 0.9,
    "common_types": ["feat", "fix"]
  },
  "hot_paths": [
    { "file": "src/app/practice/page.tsx", "commits_30d": 12 },
    { "file": "src/components/PracticeSession.tsx", "commits_30d": 9 }
  ],
  "recent_changes": {
    "last_commit": "fix(practice): correct N-Queens test cases",
    "last_commit_sha": "abc1234",
    "last_commit_date": "2026-02-25",
    "open_prs": 4,
    "active_branches": ["feat/ai-tutor-api", "fix/dijkstra"]
  },
  "dependencies": {
    "direct": 24,
    "dev": 18,
    "notable": ["next", "react", "supabase-js", "vitest"]
  },
  "agents_md": "AI coding agents: use existing project patterns, keep changes scoped, and follow detected test/commit conventions."
}
```

## CLI

```bash
# Generate context for a local repo path (default: .)
repo-context
repo-context ./my-repo

# Output formats
repo-context --agent         # agent entrypoint: one compact JSON object on stdout
repo-context --json          # stdout pretty JSON (same payload as --agent)
repo-context --md            # stdout Markdown
repo-context --out REPO.md   # write to file
repo-context --update        # refresh stale recent_changes/hot_paths only
repo-context --diff          # compare against previous REPO.json
repo-context --compact       # one-paragraph summary
```

`--json`, `--agent`, `--md`, `--compact`, and `--out` are mutually exclusive. Extra positional arguments and duplicate `--out` / `--since` fail instead of being ignored. `get_hot_paths` `days` must be a positive integer (invalid values fail closed instead of looking like "no hot files"). Git-ignored files are not counted as project files when the git-visible set is empty.

Planned (not implemented yet):

```bash
# Remote GitHub shorthand clone/fetch
repo-context owner/repo

# Watch mode (regenerate on git changes)
repo-context --watch
```

### Incremental Refresh

`--update` reads the existing `REPO.json` in the target repo and skips the full file-system scan when it can reuse cached sections.

- `recent_changes` is refreshed when older than 1 hour, or immediately when `--since` is supplied
- `hot_paths` is refreshed when older than 24 hours
- `conventions` is refreshed when `--since` is supplied (same lookback as `recent_changes`)
- if `REPO.json` is missing or invalid, `--update` warns and falls back to a full rebuild
- refresh timestamps are stored under an optional `refresh` object in `REPO.json` for future `--update` runs

## GitHub Action

Planned (not shipped): a reusable Action that writes `REPO.json` on CI. Until then, run the CLI in your own workflow step.

## MCP Server

Binary: `repo-context-mcp` (stdio). Not a `repo-context --mcp` flag.

```
Tools:
  - get_context(repo_path?) → full REPO.json
  - get_stack(repo_path?) → just the stack section
  - get_hot_paths(repo_path?, days?) → hot files (`days` is a positive integer; default 30)
  - get_conventions(repo_path?) → conventions
```

## Why This Wins

- **Zero config** — runs in any Git repo, infers everything from files
- **Standard output** — agents know where to look (REPO.json at root)
- **Human-readable too** — REPO.md is useful for PR descriptions, onboarding
- **Composable** — agents can load just the section they need
- **Works offline** — no API keys needed for basic mode

## Detection Heuristics

| Signal | Detection |
|--------|-----------|
| Language | File extensions + parser (e.g. tsx → TypeScript) |
| Framework | package.json deps + config files |
| Entry points | package.json `main`/`exports` + framework conventions |
| Test framework | package.json deps (vitest/jest/mocha) |
| CI | .github/workflows/*.yml, .gitlab-ci.yml, .circleci |
| Conventions | recent `git log` subjects → conventional vs non-conventional + common types |
| Hot paths | `git log --since=<N> days ago --name-only` (whole-repo; not `--follow`) |

## Competitive Landscape

| Tool | Output | Agent-friendly | Zero config | MCP |
|------|--------|---------------|-------------|-----|
| **repo-context** | REPO.json + REPO.md | ✅ | ✅ | ✅ |
| GitNexus | HTML + JSON | Partial | ❌ needs setup | ✅ |
| Axon | In-memory graph | Partial | ❌ | ✅ |
| mcp-vector-search | Vector DB | ✅ | ❌ heavy setup | ✅ |
| `cat README.md` | Markdown | ❌ unstructured | ✅ | ❌ |

## v0.1 MVP Scope

- [x] Language + framework detection
- [x] Entry point detection
- [x] Hot paths (git log analysis)
- [x] Recent changes summary
- [x] REPO.json + REPO.md output
- [x] CLI with --json/--md/--out flags
- [x] MCP server (get_context, get_stack, get_hot_paths)
- [ ] GitHub Action

## Tech Stack

- TypeScript (Node.js)
- No heavy dependencies — use `git` CLI + file inspection
- Optional: `@modelcontextprotocol/sdk` for MCP
- Tests: Vitest with fixture repos

## Repo

`clankamode/repo-context`

## Success Metrics

- Week 1: shipped, dogfooded on jamesperalta.com
- Month 1: 100+ stars, included in agent workflows
- Month 3: default context tool in Codex/Claude Code setups
