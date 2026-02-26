# TASKS.md — repo-context
> Last updated: 2026-02-25 | Status: open

## 🔴 High Priority
- [ ] **Add test suite** — write tests for: `detector.ts` stack detection (TS+Next.js, Python+FastAPI, Go module), `git.ts` hot paths (mock git log), `structure.ts` file counting, `reporter.ts` REPO.md output shape
- [ ] **Wire up CLI entry point** — verify `node dist/index.js [path] [flags]` works end-to-end: reads repo, writes `REPO.json` + `REPO.md`, exits 0
- [ ] **MCP server — verify tools** — verify `--mcp` flag starts stdio server with `get_repo_context(path) → RepoContext`. Test with `npx @modelcontextprotocol/inspector`.

## 🟡 Medium Priority
- [ ] **`--since` flag for hot paths** — `HotPath.commits_30d` is hardcoded; add `--since <days>` to make window configurable
- [ ] **`--compact` output mode** — shorter REPO.md: stack + entry points + recent changes only; for tight token budgets
- [ ] **GitHub remote detection** — when `gh` is available, fetch real `open_prs` and `open_issues` counts (currently may be null)
- [ ] **Add CI workflow** — lint + build + test on push

## 🟢 Low Priority / Nice to Have
- [ ] **`--update` flag** — refresh only stale fields (recent_changes, hot_paths); skip full scan
- [ ] **`--diff` mode** — compare current `REPO.json` with previous, print what changed
- [ ] **Register in clanka-api `/tools`** and `assistant-tool-registry`

## 🧠 Notes
- Output: `REPO.json` (agent-consumable) + `REPO.md` (human-readable)
- Key source files: `detector.ts`, `git.ts`, `structure.ts`, `reporter.ts`, `mcp-server.ts`
- v0.2 features (Codex agent `wild-coral`): `--since`, `--compact`, PR/issue counts — verify if landed
