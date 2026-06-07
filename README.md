# @cloudglab/mastergo-cli

[中文文档](README.zh-CN.md)

MasterGo CLI and bundled AI skill package for design DSL analysis, D2C/C2D workflows, metadata retrieval, component documentation, and component generation workflows.

This repository has moved from a standalone `mastergo` skill concept to a CLI-style package layout, following the same shape as local `zentao-cli`: npm package at the root and the installable skill under `skills/mastergo-cli`.

This package now presents MasterGo access as CLI commands. It uses the same stable MasterGo HTTP endpoints as the latest local implementation, without requiring a separate service runtime.

## Features

- **CLI Wrapper**: Run common MasterGo helpers through `mastergo` or `npx`.
- **Bundled Skill**: Install `skills/mastergo-cli` into AI agents.
- **Latest API Alignment**: Reproduces the current MasterGo tool behavior as CLI commands.
- **Legacy Script Support**: Keeps zero-dependency Python scripts for DSL summaries and component docs.

## Install

```bash
npm i -g @cloudglab/mastergo-cli@latest
mastergo --version
mastergo help
```

Temporary usage:

```bash
npx -y @cloudglab/mastergo-cli@latest help
npx -y @cloudglab/mastergo-cli@latest analyze "https://mastergo.com/goto/LhGgBAK"
```

Install the bundled skill:

```bash
npx -y skills add -g cloudglab/mastergo-cli
```

If the environment can access npm but cannot clone git repositories:

```bash
npm pack @cloudglab/mastergo-cli@latest
tar -xzf cloudglab-mastergo-cli-*.tgz
npx -y skills add -g ./package
```

## Configuration

Recommended CLI configuration:

```bash
export MASTERGO_TOKEN="mg_your_token_here"
export API_BASE_URL="https://mastergo.com"
```

Legacy Python scripts use:

```bash
export MASTERGO_TOKEN="mg_your_token_here"
export MASTERGO_ENDPOINT="https://mastergo.com"
```

Do not print token values in logs or terminal output.

## CLI Usage

```bash
mastergo analyze "https://mastergo.com/goto/LhGgBAK"
mastergo analyze "https://mastergo.com/goto/LhGgBAK" --format json
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --source-layer-id 1:24
mastergo d2c --d2c-url "mastergo://getd2c/176452330285910-2-2845" --out-dir ./mastergo-output
# or
mastergo d2c --content-id 176452330285910-2-2845 --document-id 176452330285910 --out-dir ./mastergo-output
mastergo c2d --file ./index.html --short-link "https://mastergo.com/file/176452330285910?layer_id=1:23"
mastergo c2d --file ./index.html --file-id 176452330285910 --layer-id 1:23
mastergo meta --file-id 176452330285910 --layer-id 1:23
mastergo component-doc "https://example.com/button.mdx"
mastergo component-workflow --root "$PWD" --file-id 176452330285910 --layer-id 1:23
mastergo fetch-docs "https://example.com/button.mdx"
mastergo install
mastergo update
```

## Latest CLI Coverage

The bundled skill is aligned with the latest local implementation, but maps capabilities into CLI commands:

| Tool | Purpose |
|------|---------|
| `mastergo dsl` | Retrieve DSL with `dsl`, `componentDocumentLinks`, and `rules` fields |
| `mastergo d2c` | Retrieve D2C data and save Vue/HTML code, SVG, and image resources locally. `contentId` accepts both a D2C task run id (e.g. `mastergo://getd2c/<id>`) and a `fileId` + layer chain (e.g. `<fileId>-<id>[/<id>...]`); any `/` in the id is sanitized to `_` in the output filename. |
| `mastergo c2d` | Read local HTML and send it back to MasterGo design files; short links only use `layer_id` |
| `mastergo meta` | Retrieve high-level website/page metadata with meta generation rules |
| `mastergo component-doc` | Fetch linked component documentation |
| `mastergo component-workflow` | Create `.mastergo/component-workflow.md`, component JSON, and SVG image files |

## Repository Layout

```text
bin/mastergo.js              CLI entry point
skills/mastergo-cli/SKILL.md Agent skill entry point
skills/mastergo-cli/scripts/ Legacy Python helper scripts
skills/mastergo-cli/references/ DSL reference docs
```

Generated D2C resources follow the API `resourcePath` field. The code file is saved as `.vue` when the returned `frameType` or code content indicates Vue; otherwise it is saved as `.html`. When `resourcePath` is absent, images are written to `asset/images` and SVGs are written to `asset/icons` under `--out-dir`.

Note: `contentId` is the D2C task run id (the part after `mastergo://getd2c/`), not a `fileId-layerId` pair. Pass it via `--d2c-url` or `--content-id` + `--document-id`.

## Troubleshooting

### Token Invalid

Regenerate a personal access token in MasterGo personal settings and update `MASTERGO_TOKEN`.

### Permission Denied

MasterGo API access requires a Team Edition or higher account, and design files must be in Team Projects rather than Drafts.

### Short Link Failed

Use the full URL format `https://mastergo.com/file/{fileId}?layer_id={layerId}` or call CLI commands with `--file-id` and `--layer-id` directly.

## License

MIT
