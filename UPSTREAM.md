# Upstream Sync

This package tracks selected changes from `mastergo-design/mastergo-magic-mcp` and adapts them to the standalone `@cloudglab/mastergo-cli` package layout.

## Last synced upstream commit

- `189a1d0` (`chore: publish v0.2.0`, 2026-06-10)

## Included upstream changes

- `82bb640` / PR #87: added design sections, SVGs, texts, and extract SVG workflows.
- `189a1d0` / `v0.2.0` source diff from `v0.1.8`: added section-by-section server instructions, DSL fallback guidance, SVG/text fidelity rules, and background color anti-hallucination rules; adapted into CLI output rules and the installable skill references.
- `98f2ed8` / `v0.1.9-alpha.0` source diff from `v0.1.8`: added proxy-aware HTTP fetching and `--proxy` / `HTTPS_PROXY` support.
- `99264bc` / PR #95: replaced colons in generated layer image filenames for Windows compatibility.
- `ef39d88` / PR #96: added npm homepage, repository, and issue metadata, adapted to `cloudglab/mastergo-cli`.
- `2f63ec4`: added `.reasonix` and `.codegraph` ignore entries; `.codegraph/` already existed locally.

## Source comparison notes

- Compared npm package diffs for `@mastergo/magic-mcp@0.1.8 -> 0.1.9-alpha.0 -> 0.2.0`.
- Compared upstream source tags `v0.1.8` and `v0.2.0` before porting missing implementation guidance.
- Local CLI endpoint implementations for `design-sections`, `design-svgs`, `design-texts`, `extract-svg`, `normalizeFileId`, proxy-aware fetches, and Windows-safe image IDs are present; the additional `v0.2.0` gap was workflow/rule behavior returned to agents.
