# repo-context

Generate `REPO.json` (agent-consumable) and `REPO.md` (human-readable) for a local Git repository.

## Usage

```bash
repo-context [path]
```

`path` must be a local directory. Remote `owner/repo` shorthand is not supported yet.

### Common flags

- `--json` stdout JSON only
- `--md` stdout Markdown only
- `--compact` one-paragraph summary
- `--since <period>` filter git history (e.g. `7 days ago`)
- `--update` refresh stale `recent_changes` and `hot_paths` from cached `REPO.json`
- `--diff` regenerate context and print what changed vs previous `REPO.json`
- `--out <file>` write to `.json` or `.md`

Open PR/issue counts require a detectable GitHub remote and a working `gh` auth session. When unavailable, JSON keeps `null` and human output marks those counts as unavailable.

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
