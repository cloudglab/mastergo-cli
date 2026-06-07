# @cloudglab/mastergo-cli

[English](README.md)

MasterGo CLI + AI Skill 包，用于设计 DSL 分析、D2C/C2D、元信息获取、组件文档读取和组件开发工作流。

这个仓库已经从单独的 `mastergo` skill 概念迁移为 `mastergo-cli`：根目录是 npm/CLI 包，真正可安装的 skill 放在 `skills/mastergo-cli`，结构参考本地 `zentao-cli`。

本包现在把 MasterGo 能力表达为 CLI 子命令。底层对齐最新本地实现使用的稳定 MasterGo HTTP 接口，不再要求用户启动额外服务运行时。

## 功能特性

- **CLI 包装器**：通过 `mastergo` 或 `npx` 运行常用 MasterGo 辅助命令。
- **内置 Skill**：`skills/mastergo-cli` 可直接安装到 AI Agent。
- **最新 API 对齐**：把当前 MasterGo 工具行为还原成 CLI 子命令。
- **旧脚本保留**：保留零依赖 Python 脚本，用于 DSL 摘要和组件文档读取。

## 安装

```bash
npm i -g @cloudglab/mastergo-cli@latest
mastergo --version
mastergo help
```

临时使用：

```bash
npx -y @cloudglab/mastergo-cli@latest help
npx -y @cloudglab/mastergo-cli@latest analyze "https://mastergo.com/goto/LhGgBAK"
```

安装内置 skill：

```bash
npx -y skills add -g cloudglab/mastergo-cli
```

如果只能访问 npm，不能 clone git 仓库：

```bash
npm pack @cloudglab/mastergo-cli@latest
tar -xzf cloudglab-mastergo-cli-*.tgz
npx -y skills add -g ./package
```

## 配置

推荐 CLI 配置：

```bash
export MASTERGO_TOKEN="mg_your_token_here"
export API_BASE_URL="https://mastergo.com"
```

旧版 Python 脚本使用：

```bash
export MASTERGO_TOKEN="mg_your_token_here"
export MASTERGO_ENDPOINT="https://mastergo.com"
```

不要在日志或终端输出里打印 token 值。

## CLI 用法

```bash
mastergo analyze "https://mastergo.com/goto/LhGgBAK"
mastergo analyze "https://mastergo.com/goto/LhGgBAK" --format json
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --source-layer-id 1:24
mastergo d2c --d2c-url "mastergo://getd2c/176452330285910-2-2845" --out-dir ./mastergo-output
# 或
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

## 最新 CLI 能力覆盖

当前 skill 已和本地最新实现对齐，但能力映射为 CLI 命令：

| 工具 | 用途 |
|------|------|
| `mastergo dsl` | 获取包含 `dsl`、`componentDocumentLinks`、`rules` 的包装输出 |
| `mastergo d2c` | 获取 D2C 数据，并落盘 Vue/HTML 代码、SVG、图片资源。`contentId` 接受两种形态：D2C 任务运行 ID（形如 `mastergo://getd2c/<id>`）或 `fileId` + layer 链（形如 `<fileId>-<id>[/<id>...]`）；id 中的 `/` 会被安全化为 `_`，不会污染输出目录。 |
| `mastergo c2d` | 读取本地 HTML 并同步回 MasterGo；短链接只使用 `layer_id` |
| `mastergo meta` | 获取网站 / 页面级元信息，并附带 meta 生成规则 |
| `mastergo component-doc` | 读取组件文档链接内容 |
| `mastergo component-workflow` | 创建 `.mastergo/component-workflow.md`、组件 JSON 和 SVG 图片文件 |

## 仓库结构

```text
bin/mastergo.js              CLI 入口
skills/mastergo-cli/SKILL.md Agent skill 入口
skills/mastergo-cli/scripts/ 旧版 Python 辅助脚本
skills/mastergo-cli/references/ DSL 参考文档
```

D2C 资源目录遵循接口返回的 `resourcePath` 字段；代码会根据返回的 `frameType` 或代码内容自动保存为 `.vue` 或 `.html`；没有 `resourcePath` 时，图片默认写入 `--out-dir/asset/images`，SVG 默认写入 `--out-dir/asset/icons`。

注意：`contentId` 是 D2C 任务运行 ID（`mastergo://getd2c/` 之后那段），不是 `fileId-layerId` 拼出来的；请用 `--d2c-url` 或 `--content-id` + `--document-id` 传入。

## 故障排除

### Token 无效

在 MasterGo 个人设置里重新生成访问令牌，并更新 `MASTERGO_TOKEN`。

### 权限被拒绝

MasterGo API 访问要求团队版或更高账号，设计稿必须放在团队项目中，不能在草稿箱里。

### 短链接失败

使用完整 URL：`https://mastergo.com/file/{fileId}?layer_id={layerId}`，或直接给 CLI 命令传 `--file-id` 和 `--layer-id`。

## 许可证

MIT
