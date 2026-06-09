# @cloudglab/mastergo-cli

![mastergo-cli hero](./assets/readme/mastergo-cli-hero.png)

[English](README.md)

把 MasterGo 设计 DSL、D2C/C2D、元信息、组件文档和组件开发工作流接到命令行，方便在 CI、脚本和 AI Skill 里直接调用。

## 安装方式

### 一键安装 CLI + Skill

```bash
npx -y @cloudglab/mastergo-cli@latest install
```

该命令会安装或更新全局 CLI，并安装内置的 `mastergo-cli` skill。

默认通过 GitHub 仓库安装 skill。如果当前环境不能访问远程 `.git` 仓库，但可以访问 npm 包，可改用 npm 静态包模式：

```bash
npx -y @cloudglab/mastergo-cli@latest install --skill-source npm
```

npm 模式会下载 `@cloudglab/mastergo-cli` 包，解压其中的 `skills/` 目录，再通过本地路径安装 skill。

如果已经提前下载并解压好了 npm 静态包，也可以直接指定本地目录：

```bash
mastergo install --skill-local-path ./package
```

后续更新直接运行：

```bash
mastergo update
```

### CI / 脚本里临时使用

```bash
npx -y @cloudglab/mastergo-cli@latest help
npx -y @cloudglab/mastergo-cli@latest dsl "https://mastergo.com/goto/LhGgBAK"
npx -y @cloudglab/mastergo-cli@latest dsl "https://mastergo.com/goto/LhGgBAK" --simplify
```

### 全局安装

```bash
npm i -g @cloudglab/mastergo-cli@latest
mastergo --version
mastergo version
mastergo help
```

### Skill 安装

默认 GitHub 仓库方式：

```bash
npx -y skills add -g cloudglab/mastergo-cli
```

如果只能访问 npm，不能 clone `.git` 仓库：

```bash
npm pack @cloudglab/mastergo-cli@latest
tar -xzf cloudglab-mastergo-cli-*.tgz
npx -y skills add -g ./package
```

Skill / Agent 里推荐优先调用本地命令：

```bash
mastergo dsl "https://mastergo.com/goto/LhGgBAK"
```

本地没有安装时再退回：

```bash
npx -y @cloudglab/mastergo-cli@latest dsl "https://mastergo.com/goto/LhGgBAK"
```

## 环境变量

```bash
export MASTERGO_TOKEN="mg_your_token_here"
export API_BASE_URL="https://mastergo.com"

# 兼容旧版 Python 辅助脚本
export MASTERGO_ENDPOINT="https://mastergo.com"
```

不要在日志或终端输出里打印 token 值。

## 可以这样描述场景

下面这些话可以交给 AI Skill / Agent 转成对应的 `mastergo-cli` 命令。

### 设计 DSL 和结构

- 解析这个 MasterGo 设计链接。
- 获取这个设计图层的 DSL。
- 用树形结构看一下页面层级。
- 简化这个 DSL，减少 token 消耗。
- 先把这个大设计稿拆成 section 再实现。
- 获取 section SVG 预览和精确长文本。
- 提取设计稿里的所有文本。
- 找出 DSL 里的组件文档链接。
- 分析页面之间的跳转关系。

### D2C：设计转代码

- 拉取这个 `mastergo://getd2c/...` 的 D2C 代码。
- 把生成的 Vue/HTML 和资源保存到本地。
- 获取 D2C 输出并放到 `./mastergo-output`。
- 从 file 链接和 layer 路径尝试获取 D2C。
- 解释为什么这个 D2C contentId 返回 10009。

### C2D：代码同步设计稿

- 把这个本地 HTML 文件同步回 MasterGo。
- 上传 `index.html` 到这个 MasterGo 文件链接。
- 把生成代码推回指定的 `fileId` 和 `layer_id`。
- 短链接里只使用 URL 参数里的 `layer_id` 作为目标图层。

### 站点元信息和组件工作流

- 获取这个设计页面的网站元信息。
- 生成组件开发工作流文件。
- 为这个组件创建 `.mastergo/component-workflow.md`。
- 生成代码前先读取关联组件文档。
- 在当前项目里保存组件 JSON 和 SVG 资源。

## 常用命令示例

```bash
# DSL 和人类可读摘要
mastergo dsl "https://mastergo.com/goto/LhGgBAK"
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --source-layer-id 1:24
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --simplify
mastergo analyze "https://mastergo.com/goto/LhGgBAK"
mastergo analyze "https://mastergo.com/goto/LhGgBAK" --format json

# 大设计稿 section 工作流
mastergo design-sections "https://mastergo.com/goto/LhGgBAK"
mastergo design-sections "https://mastergo.com/goto/LhGgBAK" --section-index 0
mastergo design-svgs "https://mastergo.com/goto/LhGgBAK"
mastergo design-texts "https://mastergo.com/goto/LhGgBAK"
mastergo extract-svg "https://mastergo.com/goto/LhGgBAK" --background-color '#ffffff'

# D2C 代码和资源
mastergo d2c --d2c-url "mastergo://getd2c/176452330285910-2-2845" --out-dir ./mastergo-output
mastergo d2c --content-id 176452330285910-2-2845 --document-id 176452330285910 --out-dir ./mastergo-output

# C2D 同步
mastergo c2d --file ./index.html --short-link "https://mastergo.com/file/176452330285910?layer_id=1:23"
mastergo c2d --file ./index.html --file-id 176452330285910 --layer-id 1:23

# 元信息和组件
mastergo meta --file-id 176452330285910 --layer-id 1:23
mastergo component-doc "https://example.com/button.mdx"
mastergo component-workflow --root "$PWD" --file-id 176452330285910 --layer-id 1:23
mastergo fetch-docs "https://example.com/button.mdx"
```

## 命令覆盖

| 命令 | 用途 |
|------|------|
| `mastergo dsl` | 获取包含 `dsl`、`componentDocumentLinks`、`rules` 的包装输出 |
| `mastergo design-sections` | 获取大设计稿的 section 概览，或用 `--section-index` 获取单个 section |
| `mastergo design-svgs` | 获取按 section / 图层组织的缓存 SVG HTML |
| `mastergo design-texts` | 获取精确文本数据，适合保真长文案 |
| `mastergo extract-svg` | 获取指定设计图层的原始 SVG 片段 |
| `mastergo analyze` | 用零依赖 Python 旧脚本输出人类可读 DSL 摘要 |
| `mastergo d2c` | 获取 D2C 数据，并落盘 Vue/HTML 代码、SVG、图片资源 |
| `mastergo c2d` | 读取本地 HTML 并同步回 MasterGo；短链接只使用 `layer_id` |
| `mastergo meta` | 获取网站 / 页面级元信息，并附带 meta 生成规则 |
| `mastergo component-doc` | 读取组件文档链接内容 |
| `mastergo component-workflow` | 创建 `.mastergo/component-workflow.md`、组件 JSON 和 SVG 资源 |

## DSL 简化

当设计稿里有大量矢量图标路径、原始 DSL 太占 AI 上下文时，可以启用 `--simplify`：

```bash
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --simplify
```

该选项默认关闭。启用后，类似图标的 `PATH` / `VECTOR` / SVG 节点，以及名称看起来像图标的节点，会被转换为 `ICON_PLACEHOLDER`；布局和关键样式字段会保留，方便后续实现。输出里会带 `_simplified` 和 `_simplificationStats` 字段。

## 大设计稿 Section 工作流

大页面优先使用 section 工作流，再把 `mastergo dsl` 当作兜底：

```bash
mastergo design-sections "https://mastergo.com/goto/LhGgBAK"
mastergo design-sections "https://mastergo.com/goto/LhGgBAK" --section-index 0
mastergo design-svgs "https://mastergo.com/goto/LhGgBAK"
mastergo design-texts "https://mastergo.com/goto/LhGgBAK"
```

先不带 `--section-index` 调一次 `design-sections` 获取概览，再按 index 把所有 section 都取完。随后用 `design-svgs` 获取缓存 SVG HTML，用 `design-texts` 保留精确长文本。只有 section 接口不可用或失败时，再退回 `mastergo dsl`。

## D2C 说明

`contentId` 接受两种形态：

1. D2C 任务运行 ID，例如 `mastergo://getd2c/<id>`。
2. 从文件和图层路径推导出来的 ID，例如 `<fileId>-<layerId>[/<expandedNodeId>...]`。

如果 file 链接当前 `layer_id` 直接拼接返回 `10009`，先用 `mastergo dsl <file-link>` 查看展开节点路径，再用完整 layer 路径继续尝试。id 中的 `/` 会被安全化为 `_`，不会污染输出目录。

D2C 资源目录遵循接口返回的 `resourcePath` 字段；代码会根据返回的 `frameType` 或代码内容自动保存为 `.vue` 或 `.html`；没有 `resourcePath` 时，图片默认写入 `--out-dir/asset/images`，SVG 默认写入 `--out-dir/asset/icons`。

## 仓库结构

```text
bin/mastergo.js                         CLI 入口
skills/mastergo-cli/SKILL.md            Agent skill 入口
skills/mastergo-cli/scripts/            旧版 Python 辅助脚本
skills/mastergo-cli/references/         DSL、D2C、meta 和 workflow 参考文档
assets/readme/mastergo-cli-hero.png     README hero 图片
```

## 更多命令

```bash
mastergo help
mastergo version
mastergo install --skill-source npm
mastergo update --skill-source npm
```

## 许可证

MIT
