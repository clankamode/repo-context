# TASKS.md — repo-context
> Last updated: 2026-03-03 | Status: open

## 🔴 High Priority
- [x] **Add test suite** — 67 tests across 7 test files covering `detector.ts`, `git.ts`, `structure.ts`, `reporter.ts`. All passing. (verified 2026-03-03)
- [x] **Wire up CLI entry point** — `node dist/index.js [path] [flags]` works end-to-end: reads repo, writes `REPO.json` + `REPO.md`, exits 0. Flags: `--json`, `--md`, `--compact`, `--since`, `--out`. (verified 2026-03-03)
- [x] **MCP server — verify tools** — `dist/mcp-server.js` exists and responds. `--mcp` flag starts stdio server. (verified 2026-03-03)

## 🟡 Medium Priority
- [x] **`--since` flag for hot paths** — `--since <period>` supported (e.g. `'7 days ago'`). (landed in v0.2)
- [x] **`--compact` output mode** — `--compact` emits a one-paragraph summary. (landed in v0.2)
- [x] **GitHub remote detection** — when `gh` is available, fetch real `open_prs` and `open_issues` counts via GitHub remote + GraphQL `totalCount`; falls back to `null` when `gh` is unavailable or unauthenticated. (completed 2026-03-05)
- [x] **Add CI workflow** — lint + build + test on push. Added `.github/workflows/ci.yml`. (completed 2026-03-03)

## 🟢 Low Priority / Nice to Have
- [ ] **`--update` flag** — refresh only stale fields (recent_changes, hot_paths); skip full scan
- [ ] **`--diff` mode** — compare current `REPO.json` with previous, print what changed
- [ ] **Register in clanka-api `/tools`** and `assistant-tool-registry`

## 🧠 Notes
- Output: `REPO.json` (agent-consumable) + `REPO.md` (human-readable)
- Key source files: `detector.ts`, `git.ts`, `structure.ts`, `reporter.ts`, `mcp-server.ts`
- v0.2 shipped: `--since`, `--compact`, PR/issue counts
