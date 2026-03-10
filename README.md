# repo-context

Generate `REPO.json` (agent-consumable) and `REPO.md` (human-readable) for a Git repository.

## Usage

```bash
repo-context [path]
```

### Common flags

- `--json` stdout JSON only
- `--md` stdout Markdown only
- `--compact` one-paragraph summary
- `--since <period>` filter git history (e.g. `7 days ago`)
- `--update` refresh stale `recent_changes` and `hot_paths` from cached `REPO.json`
- `--diff` regenerate context and print what changed vs previous `REPO.json`
- `--out <file>` write to `.json` or `.md`

## `--diff` mode

`--diff` compares the newly generated `REPO.json` to the previous baseline at `<repo>/REPO.json` and prints a field-level change summary.

Example:

```bash
repo-context . --diff
```

If no baseline exists yet, it safely generates new files and prints a baseline-created notice instead of failing.
