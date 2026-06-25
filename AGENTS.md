# AGENTS.md

给 AI Agent / Skill 维护者看的项目说明。`README.md` 面向用户，只保留安装方式、命令清单和场景化用法；实现细节、已知限制、写操作保护、环境变量和发布说明放在这里。

## 项目定位

`@cloudglab/mastergo-cli` 是面向 MasterGo 设计平台的命令行 + AI Skill 工具包，当前以单文件 JavaScript 实现（`bin/mastergo.js`），无需构建步骤、TypeScript 或额外依赖分层。

核心目标：把 MasterGo 的 DSL、D2C（设计稿 → 代码）、C2D（代码 → 设计稿）、站点元信息、组件文档和组件开发工作流能力暴露给命令行、脚本和 AI Skill 使用。

## Agent 使用原则

- 优先使用本机 `mastergo`。
- 未安装时，优先推荐一键安装：`npm i -g @cloudglab/mastergo-cli@latest`，再 `mastergo install` 安装 Skill。
- 当前环境不方便安装全局时，才临时使用 `npx -y @cloudglab/mastergo-cli@latest <command>`。
- 解析 MasterGo 链接时，优先使用 `design-sections` + `design-svgs` + `design-texts` 三段式获取大稿，避免一次性 `dsl` 触发 token 过载；只有在接口不可用或失败时才退回 `dsl`。
- 大稿 / 图标密集场景下，给 `mastergo dsl` 加 `--simplify`，把图标类节点替换为 `ICON_PLACEHOLDER`。
- 默认只读；只有 `c2d` 是写操作，真实写入必须传 `--confirm=true`。如需禁用写操作，可设置 `MASTERGO_DISABLE_WRITE=true`。

## 命令清单

- `help`：打印命令清单与环境变量。
- `version` / `-v` / `--version`：打印版本号。
- `analyze <mastergo-url> [--format tree|json|flat]`：调用内置 Python 脚本输出人类可读的 DSL 摘要。
- `dsl | get-dsl <url|fileId layerId> [--source-layer-id ID] [--rule RULE] [--no-rule] [--simplify]`：获取 DSL、组件文档链接、规则。
- `design-sections | get-design-sections <url|fileId layerId> [--source-layer-id ID] [--section-index N]`：大稿分 section 概览（PR #87 新增）。
- `design-svgs | get-design-svgs <url|fileId layerId> [--source-layer-id ID]`：获取缓存 SVG HTML。
- `design-texts | get-design-texts <url|fileId layerId> [--source-layer-id ID]`：获取精确文本。
- `extract-svg <url|fileId layerId> [--background-color #fff]`：把图层导出为 SVG。
- `d2c [--d2c-url mastergo://getd2c/<contentId> | --content-id ID --document-id ID] [--out-dir DIR]`：获取 D2C 任务结果并落盘代码 / SVG / 图片。
- `c2d --file HTML (--short-link URL | --file-id ID [--layer-id ID]) [--confirm true]`：把本地 HTML 推回设计稿（写）。
- `meta --file-id ID --layer-id ID [--source-layer-id ID]`：获取站点 / 页面元信息。
- `component-doc <url>`：抓取组件文档页文本。
- `component-workflow --root PATH --file-id ID --layer-id ID [--source-layer-id ID]`：在 `<root>/.mastergo/` 生成组件工作流文档与组件 JSON。
- `fetch-docs <url...>`：legacy 入口，调用 `mastergo_fetch_docs.py`。
- `install | update [--skill-source git|npm] [--skill-local-path <path>] [--cli-only] [--skill-only]`：安装 / 更新全局 CLI 与 Skill。
- `uninstall [--cli-only] [--skill-only] [--confirm true]`：卸载全局 CLI 与 Skill。

## 当前核心能力

- DSL 拉取：`dsl` / `get-dsl` 支持 URL 或 `fileId layerId`，可选 `--simplify` 减少 token 消耗。
- D2C 落盘：`d2c` 支持 `mastergo://getd2c/<contentId>` 短链或 `content-id + document-id`，按 `frameType` 自动选择 `.vue` / `.html` 后缀；SVG / 图片资源落盘到 `asset/icons` / `asset/images`。
- C2D 写保护：`c2d` 默认预览；只有 `--confirm=true` 才真正 POST 到 `/mcp/c2d`；`MASTERGO_DISABLE_WRITE=true` 时直接禁用。
- 大稿工作流：`design-sections` 概览 → 按 `--section-index` 拉取每个 section → `design-svgs` / `design-texts` 补视觉与文本。
- 组件工作流：`component-workflow` 生成 `.mastergo/component-workflow.md` + 组件 JSON + SVG 图标。
- 安装：单一 `mastergo install` 命令同时安装全局 CLI 与 Skill。

## 已知限制

- 单文件实现：所有 CLI、HTTP 解析、DSL 处理都在 `bin/mastergo.js` 中；不引入 TypeScript / src 分层 / tsc 构建。如需大量新能力，请先评估是否需要拆分。
- C2D `layer_id`：只把 URL 中的 `layer_id` 视为图层 ID；禁止把 `pageid` / `page_id` 当作 `layerId`。
- D2C `contentId`：两种形态 ① D2C 任务运行 ID `mastergo://getd2c/<id>`；② `fileId` 拼接 DSL 展开节点路径（如 `<fileId>-<layerId>/<expandedNodeId>`）。file 链接当前 `layer_id` 拼接返回 10009 时，先 `mastergo dsl <file-link>` 获取展开节点路径再试。
- Python 脚本遗留：`analyze` 与 `fetch-docs` 通过 `python3` 调用 `skills/mastergo-cli/scripts/` 下的脚本，依赖 Python 3 环境；不需要 Python 时不要调用这两个命令。
- `--simplify` 的判定：`isIconLikeNode` 当前用类型白名单（PATH / VECTOR / SVG_ELLIPSE / SVG_RECTANGLE）+ 名称关键词（ic-、ic_、ico_、icon、图标）识别图标；容器型节点（`children.length > 0`）即使名字带 icon 关键词也不会被简化。
- HTTPS 资源降级：远程资源下载遇到 `EPROTO` / `wrong version number` 时自动回退 HTTP 一次；不会无限重试。

## 写操作保护

- 只有 `c2d` 是写命令；其余命令都是只读或本地落盘。
- 默认必须传 `--confirm=true` 才会真正 POST 到 MasterGo；缺确认时返回预览结构（`{ ok: false, preview: true, reason, action, payload }`）。
- 设置 `MASTERGO_DISABLE_WRITE=true` 可完全禁用写命令，返回 `{ ok: false, supported: false, reason: '写操作已被 MASTERGO_DISABLE_WRITE 禁用。' }`。

参考返回结构：

```json
{
  "ok": false,
  "preview": true,
  "reason": "写操作缺少确认。若要执行 c2d，需要传入 confirm: true。",
  "action": "c2d",
  "payload": { "fileId": "...", "layerId": "...", "file": "/abs/path/index.html" }
}
```

## 环境变量

```bash
export MASTERGO_TOKEN="mg_your_token_here"
export MASTERGO_ENDPOINT="https://mastergo.com"
# 兼容旧名
export MASTERGO_API_TOKEN="..."   # 等价于 MASTERGO_TOKEN
export MG_MCP_TOKEN="..."         # 等价于 MASTERGO_TOKEN
export API_BASE_URL="..."         # 等价于 MASTERGO_ENDPOINT

# 写操作保护
export MASTERGO_DISABLE_WRITE="true"   # 禁用 c2d

# DSL 规则
export RULES='["rule 1", "rule 2"]'    # JSON 数组，附加到 dsl 输出 rules
```

token 优先级：CLI `--token` > `MASTERGO_TOKEN` > `MASTERGO_API_TOKEN` > `MG_MCP_TOKEN`。

endpoint 优先级：CLI `--url` > `MASTERGO_ENDPOINT` > `API_BASE_URL`，默认 `https://mastergo.com`。

## 安装 / 更新 / 卸载

```bash
# 安装
npm i -g @cloudglab/mastergo-cli@latest
mastergo install            # 默认同时安装全局 CLI + Skill
mastergo install --cli-only # 只装 / 升级 CLI
mastergo install --skill-only

# 更新
mastergo update

# 卸载
mastergo uninstall --confirm true
mastergo uninstall --skill-only --confirm true
mastergo uninstall --cli-only --confirm true
```

Skill 来源支持：
- `mastergo install --skill-source git`：从 GitHub `cloudglab/mastergo-cli` 拉 Skill（默认）。
- `mastergo install --skill-source npm`：从当前已安装的 npm 包内 `skills/mastergo-cli/` 拉 Skill。
- `mastergo install --skill-local-path <path>`：使用本地 Skill 目录。

## 开发

```bash
npm install
npm run check    # node --check bin/mastergo.js，语法检查
npm run test     # node --test tests/*.test.js
npm run help     # node bin/mastergo.js help
npm run pack:dry-run   # npm pack --dry-run，看发布包内容
```

新增纯函数请同步在 `tests/` 下补单测；新增命令请同步更新 `SKILL.md` 的命令清单与 `references/cheatsheet.md`。

不要在未被明确要求时提交代码。