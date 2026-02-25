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
    "component_pattern": "src/components/{name}/{name}.tsx",
    "test_pattern": "src/__tests__/{name}.test.ts",
    "import_alias": "@/ → src/",
    "branch_pattern": "feat/{slug} | fix/{slug}",
    "commit_pattern": "type(scope): message"
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
  "agents_md": "AI coding agents: use Next.js App Router patterns. All components in src/components/. Tests in src/__tests__/. Never push to main — branch + PR."
}
```

## CLI

```bash
# Generate context for current repo
repo-context

# Generate for a GitHub repo
repo-context owner/repo

# Output formats
repo-context --json          # stdout JSON
repo-context --md            # stdout Markdown
repo-context --out REPO.md   # write to file

# Watch mode (regenerate on git changes)
repo-context --watch
```

## GitHub Action

```yaml
- uses: clankamode/repo-context@v1
  with:
    output: REPO.json        # commit to repo for agents to find
    commit: true             # auto-commit if changed
```

## MCP Server

```
Tools:
  - get_context(repo?) → full REPO.json
  - get_stack(repo?) → just the stack section
  - get_hot_paths(repo?, days?) → hot files
  - get_conventions(repo?) → conventions
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
| Conventions | git log patterns, file naming analysis |
| Hot paths | `git log --follow --since=30d` per file |
| Import alias | tsconfig.json paths, next.config.ts |
| Branch pattern | `git branch -r` analysis |

## Competitive Landscape

| Tool | Output | Agent-friendly | Zero config | MCP |
|------|--------|---------------|-------------|-----|
| **repo-context** | REPO.json + REPO.md | ✅ | ✅ | ✅ |
| GitNexus | HTML + JSON | Partial | ❌ needs setup | ✅ |
| Axon | In-memory graph | Partial | ❌ | ✅ |
| mcp-vector-search | Vector DB | ✅ | ❌ heavy setup | ✅ |
| `cat README.md` | Markdown | ❌ unstructured | ✅ | ❌ |

## v0.1 MVP Scope

- [ ] Language + framework detection
- [ ] Entry point detection
- [ ] Hot paths (git log analysis)
- [ ] Recent changes summary
- [ ] REPO.json + REPO.md output
- [ ] CLI with --json/--md/--out flags
- [ ] MCP server (get_context, get_stack, get_hot_paths)
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
