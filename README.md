# repo-context

Generate repository context files (`REPO.json`, `REPO.md`) for coding agents.

## Usage

```bash
repo-context [path]
```

### Options

- `--json` stdout JSON only
- `--md` stdout Markdown only
- `--compact` one-paragraph summary
- `--since <period>` filter git log (for example `7 days ago`)
- `--update` refresh only stale fields (`recent_changes`, `hot_paths`) from existing `REPO.json`
- `--out <file>` write output to file (`.json` or `.md`)
- `--version` print version
- `--help` print usage

## `--update` behavior

`--update` is for fast refreshes.

- Reads existing `<repo>/REPO.json` as the baseline.
- Recomputes only stale fields: `recent_changes` and `hot_paths`.
- Preserves stable fields from the baseline (stack, structure, conventions, dependencies, notes, etc.).
- Updates `generated` timestamp.

If `REPO.json` does not exist (or is invalid), `--update` fails with an actionable error telling you to run a full generation first.

## Examples

```bash
# Full scan and write REPO.json + REPO.md
repo-context .

# Full scan to stdout JSON
repo-context . --json

# Fast stale-only refresh from existing REPO.json
repo-context . --update
```
