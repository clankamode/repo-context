# repo-context

Generate `REPO.json` (agent-consumable) and `REPO.md` (human-readable) for a local Git repository.

## Usage

```bash
repo-context [path]
```

`path` must be a local git work tree. Remote `owner/repo` shorthand is not supported yet.
Non-git directories fail with a clear error instead of writing empty context.

### Agent entrypoint

Coding agents should use `--agent` (or `--json`) to ingest context in one shot:

```bash
repo-context --agent
repo-context --json
```

Both print a single JSON object on stdout (no markdown chatter). `--agent` is compact
(one line); `--json` is pretty-printed. The payload includes `repo`, `default_branch`,
`stack`, `structure`, `conventions`, `hot_paths`, `recent_changes` (with `open_prs` /
`open_issues` as numbers or `null` when GitHub data cannot be read), and `dependencies`.

### Common flags

- `--agent` compact JSON on stdout (recommended for agents)
- `--json` stdout pretty JSON only
- `--md` stdout Markdown only
- `--compact` one-paragraph summary
- `--since <period>` filter recent_changes / conventions lookback (e.g. `7 days ago`); hot_paths keep their own window. Invalid periods fail instead of being treated as "now". Duplicate `--since` fails instead of using only the first value
- `--update` refresh stale `recent_changes` and `hot_paths` from cached `REPO.json`. With `--since`, conventions are refreshed too. Missing or invalid cache warns and falls back to a full rebuild
- `--diff` regenerate context and print what changed vs previous `REPO.json`. A corrupt baseline is an error, not a silent "no previous file"
- `--out <file>` write to `.json` or `.md`. Incompatible with `--json` / `--agent` / `--md` / `--compact` (those combinations used to ignore a flag). Duplicate `--out` fails instead of writing only the first path

`--json`, `--agent`, and `--md` cannot be combined: those mixes used to ignore compact JSON or append markdown onto a JSON stdout stream. Extra positional arguments fail instead of being ignored. Git-ignored files are not counted as project files just because the visible git set is empty.

Open PR/issue counts require a detectable GitHub remote and a working `gh` session.
When unavailable (no GitHub remote, missing `gh`, auth, or network), JSON keeps `null`
and human output marks those counts as unavailable — without inventing `0` or blaming
auth alone.

### MCP server

```bash
repo-context-mcp
# or: npm run start:mcp
```

Exposes `get_context`, `get_stack`, `get_hot_paths`, and `get_conventions` over stdio. There is no `repo-context --mcp` flag.

## `--diff` mode

`--diff` compares the newly generated `REPO.json` to the previous baseline at `<repo>/REPO.json` and prints a field-level change summary.

Example:

```bash
repo-context . --diff
```

If no baseline exists yet, it safely generates new files and prints a baseline-created notice instead of failing.
