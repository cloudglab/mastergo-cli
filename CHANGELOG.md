# Changelog

## Unreleased

- Added optional `mastergo dsl --simplify` output that converts icon-like vector/path nodes to `ICON_PLACEHOLDER` to reduce token consumption.
- Added `mastergo design-sections`, `mastergo design-svgs`, `mastergo design-texts`, and `mastergo extract-svg` commands for the section-first large-design workflow from upstream PR #87.

## 0.1.0 - 2026-06-07

- Reworked the repository into the `@cloudglab/mastergo-cli` npm package layout.
- Added the `mastergo` CLI entry point for DSL, D2C, C2D, meta, component docs, and component workflow commands.
- Moved the installable agent skill and reference materials under `skills/mastergo-cli`.
- Updated English and Chinese README files with npm, npx, and skill installation instructions.
