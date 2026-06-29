# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Added optional `mastergo dsl --simplify` output that converts icon-like vector/path nodes to `ICON_PLACEHOLDER` to reduce token consumption.
- Added `mastergo design-sections`, `mastergo design-svgs`, `mastergo design-texts`, and `mastergo extract-svg` commands for the section-first large-design workflow from upstream PR #87.
- Hardened `mastergo c2d` with two-layer write protection: a missing `--confirm=true` returns `{ ok: false, preview: true, reason, action, payload }` preview without POSTing; setting `MASTERGO_DISABLE_WRITE=true` returns `{ ok: false, supported: false, reason }` and never touches the API. See `design.md` §7.2 for the preview contract.
- Added the `mastergo uninstall` command with `--cli-only` / `--skill-only` / `--confirm true`; the real `npm uninstall -g @cloudglab/mastergo-cli` + `npx -y skills remove mastergo-cli --yes` chain only runs after explicit confirmation.
- `mastergo install` / `mastergo update` now also installs / refreshes the global CLI via `npm install -g @cloudglab/mastergo-cli@latest` (skippable with `--skill-only`); pure skill install becomes `--cli-only` + `--skill-only`.
- New single-file project structure: `parseFlags`, `extractIdsFromUrl`, `simplifyDsl`, `simplifyDslNode`, `simplifyDslNodes`, `isIconLikeNode`, `normalizeFileId`, `cloneJson` are now exported from `bin/mastergo.js` with an `import.meta.url` entry guard so unit tests can import them without triggering the CLI. No TypeScript / `src/` split / `tsc` build introduced.
- New test suite under `tests/` using Node.js's built-in test runner (`node --test tests/*.test.js`) covering parameter parsing, URL → fileId/layerId extraction (including `/goto/` short links), and DSL simplification (`PATH` / `VECTOR` / `SVG_ELLIPSE` / `SVG_RECTANGLE` icon replacement, child recursion, deep-clone safety).
- `package.json` scripts: `check` is now `node --check bin/mastergo.js` (syntax check); added `help` (`node bin/mastergo.js help`) and `test` (`node --test tests/*.test.js`); kept `pack:dry-run`.
- New `AGENTS.md` documenting project positioning, agent usage principles, command inventory, known limitations, write-operation protection contract, environment variables, and install / update / uninstall workflow.
- New `references/cheatsheet.md` (full CLI command index) and `references/scenarios.md` (typical command combinations).

### 验证

- `npm run check` 通过：`node --check bin/mastergo.js` 无语法错误。
- `npm run test` 通过：内置 `node --test tests/*.test.js` 跑通 24 个用例（`parseFlags` 10 例、`extractIdsFromUrl` 5 例、`simplifyDsl` / `isIconLikeNode` 9 例），全部 ok / fail=0。
- `mastergo help` 仍输出完整命令清单；新增 `uninstall` 条目、`c2d --confirm true` 提示和 `MASTERGO_DISABLE_WRITE` 环境变量说明。
- 写保护 review：`MASTERGO_DISABLE_WRITE=true` 与缺 `--confirm` 的两条分支都在 `postC2d` 入口拦截，不进入 `requestJson('/mcp/c2d', ...)` 链路；preview / disabled 两条路径分别返回约定的 JSON 结构。
## 1.0.0 - 2026-06-29

- Added optional `mastergo dsl --simplify` output that converts icon-like vector/path nodes to `ICON_PLACEHOLDER` to reduce token consumption.
- Added `mastergo design-sections`, `mastergo design-svgs`, `mastergo design-texts`, and `mastergo extract-svg` commands for the section-first large-design workflow from upstream PR #87.
- Added proxy-aware HTTP fetching for CLI requests and `--proxy` / `HTTPS_PROXY` support, matching upstream `@mastergo/magic-mcp@0.1.8+` behavior.
- Synced upstream changes through `mastergo-design/mastergo-magic-mcp@189a1d0`, including Windows-safe layer image filenames, npm metadata, local tool ignore entries, section-first restoration rules, and meta workflow updates.

## 0.1.0 - 2026-06-07

- Reworked the repository into the `@cloudglab/mastergo-cli` npm package layout.
- Added the `mastergo` CLI entry point for DSL, D2C, C2D, meta, component docs, and component workflow commands.
- Moved the installable agent skill and reference materials under `skills/mastergo-cli`.
- Updated English and Chinese README files with npm, npx, and skill installation instructions.

### 验证

- `mastergo help` 在发布前手动执行，命令清单与 `package.json` 的 `bin` 字段对齐。
- `npm pack --dry-run` 确认 `bin/`、`skills/`、`assets/`、`README.md`、`README.zh-CN.md`、`LICENSE` 都被打包。
- 安装样例：`npm i -g @cloudglab/mastergo-cli@0.1.0` + `mastergo install` 在内部环境跑通。