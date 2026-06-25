# CLI 命令速查

`@cloudglab/mastergo-cli` 暴露的全部命令、参数与典型返回值。所有命令均通过 `mastergo <command>` 调用，URL 或 `<fileId> <layerId>` 形式均可作为位置参数。

## 元命令

| 命令 | 说明 |
|------|------|
| `mastergo help` / `-h` / `--help` | 打印命令清单和环境变量 |
| `mastergo version` / `-v` / `--version` | 打印版本号 |

## DSL / 设计稿解析

| 命令 | 参数 | 说明 |
|------|------|------|
| `mastergo analyze` | `<mastergo-url> [--format tree|json|flat]` | 通过 Python 脚本输出人类可读的 DSL 摘要 |
| `mastergo dsl` / `mastergo get-dsl` | `<url\|fileId layerId> [--source-layer-id ID] [--rule RULE] [--no-rule] [--simplify]` | 获取 DSL、`componentDocumentLinks` 和规则；`--simplify` 把图标类节点替换为 `ICON_PLACEHOLDER` |
| `mastergo design-sections` / `mastergo get-design-sections` | `<url\|fileId layerId> [--source-layer-id ID] [--section-index N]` | 大稿 section 概览（`N` 不传时返回所有 section 列表） |
| `mastergo design-svgs` / `mastergo get-design-svgs` | `<url\|fileId layerId> [--source-layer-id ID]` | 获取缓存 SVG HTML |
| `mastergo design-texts` / `mastergo get-design-texts` | `<url\|fileId layerId> [--source-layer-id ID]` | 获取精确长文本 |
| `mastergo extract-svg` | `<url\|fileId layerId> [--background-color #fff]` | 把图层导出为 SVG |

## D2C / C2D

| 命令 | 参数 | 说明 |
|------|------|------|
| `mastergo d2c` | `[--d2c-url mastergo://getd2c/<contentId> \| --content-id ID --document-id ID] [--out-dir DIR]` | 拉取 D2C 任务结果并落盘代码 / SVG / 图片（`.vue` / `.html`） |
| `mastergo c2d` | `--file HTML (--short-link URL \| --file-id ID [--layer-id ID]) [--confirm true]` | **写操作**：把本地 HTML 推回设计稿；缺 `--confirm` 返回 preview，`MASTERGO_DISABLE_WRITE=true` 直接禁用 |

## 元信息 / 组件

| 命令 | 参数 | 说明 |
|------|------|------|
| `mastergo meta` | `--file-id ID --layer-id ID [--source-layer-id ID]` | 获取站点 / 页面元信息，输出含 `result` 和 meta 规则 |
| `mastergo component-doc` | `<url>` | 抓取组件文档页文本 |
| `mastergo component-workflow` | `--root PATH --file-id ID --layer-id ID [--source-layer-id ID]` | 在 `<root>/.mastergo/` 生成组件工作流、组件 JSON 和 SVG 图标 |
| `mastergo fetch-docs` | `<url...>` | legacy 入口，调用 `mastergo_fetch_docs.py` 抓取文档 |

## 安装 / 维护

| 命令 | 参数 | 说明 |
|------|------|------|
| `mastergo install` | `[--skill-source git\|npm] [--skill-local-path <path>] [--cli-only] [--skill-only]` | 安装全局 CLI（`npm install -g`）+ Skill（`npx skills add -g`） |
| `mastergo update` | `[--skill-source git\|npm] [--skill-local-path <path>] [--cli-only] [--skill-only]` | 更新全局 CLI（`@latest`）+ Skill |
| `mastergo uninstall` | `[--cli-only] [--skill-only] [--confirm true]` | **写操作**：卸载 Skill（`npx skills remove`）+ CLI（`npm uninstall -g`）；缺 `--confirm` 返回 preview |

## 全局参数

| 参数 | 适用 | 说明 |
|------|------|------|
| `--token <token>` | 大部分命令 | 覆盖 token，覆盖 `MASTERGO_TOKEN` 等 |
| `--url <baseUrl>` | 大部分命令 | 覆盖 endpoint，覆盖 `MASTERGO_ENDPOINT` 等 |
| `--rule <rule>` | `dsl` | 追加单条 DSL 规则，可重复传入成为数组 |
| `--no-rule` | `dsl` | 关闭内置规则，仅保留 CLI / 环境变量传入 |
| `--simplify` | `dsl` | 把图标类节点替换为 `ICON_PLACEHOLDER` |
| `--source-layer-id <id>` | 多个 | 指定用于回溯的源图层 ID |
| `--section-index <N>` | `design-sections` | 获取第 N 个 section |
| `--background-color <#hex>` | `extract-svg` | 提取 SVG 时的背景色 |
| `--out-dir <dir>` | `d2c` | D2C 资源落盘目录，默认 `cwd` |
| `--confirm true` | `c2d` / `uninstall` | 写操作确认 |
| `--cli-only` / `--skill-only` | `install` / `update` / `uninstall` | 只安装 / 卸载 CLI 或 Skill |
| `--skill-source <git\|npm>` | `install` / `update` | Skill 来源，默认 `git` |
| `--skill-local-path <path>` | `install` / `update` | 使用本地 Skill 目录 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `MASTERGO_TOKEN` / `MASTERGO_API_TOKEN` / `MG_MCP_TOKEN` | API token |
| `MASTERGO_ENDPOINT` / `API_BASE_URL` | API base URL |
| `MASTERGO_DISABLE_WRITE=true` | 禁用所有写命令（`c2d` / `uninstall`） |
| `RULES` | JSON 数组，附加到 `dsl` 输出 `rules` |

## 写保护返回结构

`c2d` / `uninstall` 未传 `--confirm=true` 时：

```json
{
  "ok": false,
  "preview": true,
  "reason": "写操作缺少确认。若要执行 <action>，需要传入 confirm: true。",
  "action": "c2d",
  "payload": { "fileId": "...", "layerId": "...", "file": "/abs/path/index.html" }
}
```

`MASTERGO_DISABLE_WRITE=true` 时：

```json
{
  "ok": false,
  "supported": false,
  "reason": "写操作已被 MASTERGO_DISABLE_WRITE 禁用。"
}
```