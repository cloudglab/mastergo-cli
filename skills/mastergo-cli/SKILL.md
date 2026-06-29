---
name: mastergo-cli
description: MasterGo CLI 技能包。用于获取 MasterGo 设计 DSL、D2C 代码、C2D 同步、站点元信息、组件文档和组件开发工作流；当用户提供 MasterGo file/goto 链接、要求解析设计稿、设计转代码、代码同步设计稿或生成组件时使用。
triggers:
  - mastergo
  - MasterGo
  - mastergo-cli
  - 设计稿
  - 设计转代码
  - 代码同步设计稿
  - 解析设计稿
  - 组件开发工作流
  - MasterGo file 链接
  - MasterGo goto 链接
  - mastergo://getd2c/
  - DSL
  - D2C
  - C2D
  - Generator
  - 组件文档
  - 站点元信息
argument-hint: "[mastergo-url|command]"
---

# @cloudglab/mastergo-cli

## 概览

这是 MasterGo 的命令行 / AI Skill 包。优先使用 `mastergo` CLI 子命令完成 DSL、D2C、C2D、元信息和组件工作流操作；只有在需要离线 DSL 摘要时，才退回本包内置的 Python 脚本。

## 入口优先级

1. 未安装时：先 `npm i -g @cloudglab/mastergo-cli@latest`
2. 临时使用：`npx -y @cloudglab/mastergo-cli@latest`
3. 常规任务：使用 `mastergo dsl`、`mastergo d2c`、`mastergo c2d`、`mastergo meta` 等 CLI 子命令
4. 只做人类可读 DSL 摘要时：使用 `mastergo analyze`
5. 只做离线脚本调试时：使用 `skills/mastergo-cli/scripts/` 下的 Python 脚本

## CLI 能力对齐

当前 skill 按本地最新 MasterGo 接口能力对齐，但对外呈现为 CLI 命令：

| 场景 | 优先工具 |
|------|----------|
| 获取 DSL 和生成规则 | `mastergo dsl`，输出包含 `dsl`、`componentDocumentLinks`、`rules`；大文件可加 `--simplify` 降低 token 消耗 |
| 大设计稿 / 完整页面实现 | 优先 `mastergo design-sections` 获取概览和所有 section，再用 `mastergo design-svgs` / `mastergo design-texts` 补视觉和文本 |
| 获取 D2C 代码和资源 | `mastergo d2c`，落盘 Vue/HTML 代码、SVG、图片资源 |
| HTML 代码同步到设计稿 | `mastergo c2d`，支持 `--short-link` 或 `--file-id` |
| 获取站点 / 页面元信息 | `mastergo meta`，输出包含 `result` 和 meta 规则 |
| 获取组件文档链接内容 | `mastergo component-doc` |
| 生成组件开发工作流 | `mastergo component-workflow`，写 `.mastergo/component-workflow.md`、组件 JSON、SVG 图片 |

## Token 和配置

推荐环境变量：

```bash
export MASTERGO_TOKEN="mg_your_token_here"
export API_BASE_URL="https://mastergo.com"
```

兼容旧版 Python 脚本使用：

```bash
export MASTERGO_TOKEN="mg_your_token_here"
export MASTERGO_ENDPOINT="https://mastergo.com"
```

安全要求：不要输出 token，不要执行 `echo $MASTERGO_TOKEN` 或 `printenv` 暴露密钥。只允许用 `test -n "$MASTERGO_TOKEN" && echo "Token is set"` 这类方式检查是否存在。

## 安装 / 更新

```bash
npm i -g @cloudglab/mastergo-cli@latest
mastergo install
mastergo update
```

只能访问 npm 包、不能 clone Git 仓库时：

```bash
mastergo install --skill-source npm
```

安装 skill：

```bash
npx -y skills add -g cloudglab/mastergo-cli
```

## CLI 快速命令

```bash
mastergo help
mastergo analyze "https://mastergo.com/goto/LhGgBAK"
mastergo dsl "https://mastergo.com/goto/LhGgBAK"
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --simplify
mastergo design-sections "https://mastergo.com/goto/LhGgBAK"
mastergo design-sections "https://mastergo.com/goto/LhGgBAK" --section-index 0
mastergo design-svgs "https://mastergo.com/goto/LhGgBAK"
mastergo design-texts "https://mastergo.com/goto/LhGgBAK"
mastergo d2c --d2c-url "mastergo://getd2c/176452330285910-2-2845" --out-dir ./mastergo-output
# 或
mastergo d2c --content-id 176452330285910-2-2845 --document-id 176452330285910 --out-dir ./mastergo-output
mastergo c2d --file ./index.html --short-link "https://mastergo.com/file/176452330285910?layer_id=1:23"
mastergo c2d --file ./index.html --file-id 176452330285910 --layer-id 1:23
mastergo meta --file-id 176452330285910 --layer-id 1:23
mastergo component-workflow --root "$PWD" --file-id 176452330285910 --layer-id 1:23
mastergo fetch-docs "https://example.com/button.mdx"
```

## 使用规则

- 用户说“还原设计稿 / Restore design / 还原设计稿，保存为 html 文件”：把它当作完整页面高保真实现请求。优先执行 `mastergo design-sections <url>` 获取概览并按 `--section-index` 拉取所有 section，再执行 `mastergo design-svgs <url>` 和 `mastergo design-texts <url>`，最后在用户项目中保存 HTML 和必要资源；如果用户提供的是 `mastergo://getd2c/...` 或明确要求 D2C，则改用 `mastergo d2c --out-dir <dir>` 落盘 Vue/HTML 和资源
- 用户说“提取 SVG，放到 html 中预览 / Extract SVG and preview in HTML”：优先用 `mastergo extract-svg <url>` 获取目标图层 SVG，必要时用 `mastergo design-svgs <url>` 获取缓存 SVG HTML，并保存一个本地 HTML 预览文件
- 用户说“完整页面 / 大设计稿 / 高保真实现 / section”：优先用 `mastergo design-sections <url>` 获取 section 概览，再按 `--section-index` 获取所有 section（建议 3-5 个一批）；随后用 `mastergo design-svgs <url>` 获取缓存 SVG HTML，用 `mastergo design-texts <url>` 获取精确文本。只有这些接口不可用或失败时，才退回 `mastergo dsl`
- 用户说“解析设计稿 / 获取 DSL / 看结构”：如果是普通小稿，用 `mastergo dsl`，必要时再用 `mastergo analyze` 做人类可读摘要；如果用户强调 token 消耗、上下文太大、图标路径太多，给 `mastergo dsl` 增加 `--simplify`
- 用户说“设计转代码 / D2C / 生成 Vue 或 HTML”：用 `mastergo d2c`，并传 `--d2c-url mastergo://getd2c/...`（或 `--content-id` + `--document-id`）和 `--out-dir`；代码文件、SVG、图片资源都应落盘，代码文件按接口返回自动保存为 `.vue` 或 `.html`；`contentId` 接受两种形态：① D2C 任务运行 ID（设计稿里点 D2C 后给的 `mastergo://getd2c/<id>`）；② 由 file 链接推导：`fileId` 加 DSL 展开的完整节点路径拼接（如 `<fileId>-<layerId>/<expandedNodeId>`）。如果 file 链接当前 `layer_id` 直接拼接返回 10009，不要说“这个链接获取不到”，也不要说“换成子层获取”；应先用 `mastergo dsl <file-link>` 获取当前入口的展开节点路径，再用 `fileId-完整节点路径` 继续尝试。CLI 会把文件名里的 `/` 替换为 `_`。
- 用户说“代码同步到设计稿 / C2D”：用 `mastergo c2d`；可传 `--short-link`，但只把 URL 中的 `layer_id` 当作图层 ID，禁止把 `pageid/page_id` 当作 `layerId`
- 用户说“完整网站 / 页面配置 / meta”：用 `mastergo meta`
- 用户说“Generator / 组件开发工作流”：主动使用 `mastergo component-workflow`，`--root` 必须是工作区绝对路径
- 如果 DSL 中的 `componentDocumentLinks` 非空，继续用 `mastergo component-doc <url>` 逐个读取组件文档
- 不要在用户项目目录创建临时 DSL 缓存或分析脚本；脚本输出默认走 stdout

## 文档入口

- `references/dsl-types.md`
- `references/dsl-structure.md`
- `references/multi-page-workflow.md`
- `references/meta.md`
- `references/component-workflow.md`
- `references/d2c-notes.md`
