# 工程设计对齐文档

本文档提炼 `@cloudglab/mastergo-cli` 当前应遵循的工程约定，并对齐到 `zentao-cli/design.md` 的文档职责边界。目标不是把 `mastergo-cli` 强行改造成 TypeScript 多目录大工程，而是在保持“单文件 JavaScript CLI + skill 包”定位不变的前提下，把安装、文档、测试、发布和上游同步规则写清楚。

## 1. 文档定位

### 1.1 文档职责边界

- `README.md` / `README.zh-CN.md`：面向最终用户，只保留长期稳定的项目说明、安装方式、环境变量、命令示例、场景用法、MCP 配置和能力边界。
- `AGENTS.md`：面向维护者和 Agent，记录实现结构、写保护、上游同步规则、安装/卸载细节、已知限制和开发要求。
- `CHANGELOG.md`：记录版本变化、修复项、能力新增、兼容性调整和发布信息。
- `design.md`：记录工程约定、目录职责、脚本边界、上游同步策略和测试发布流程。

### 1.2 README 禁止事项

- 不要把“这版补了什么”“本次修复了什么”“版本回顾”“发版摘要”写进 README。
- 这类内容只能写进 `CHANGELOG.md`、GitHub Release notes、commit message 或 PR。
- README 里允许保留“核心能力”“典型用法”“已知限制”“命令示例”这类长期有效内容。

## 2. 项目定位

`@cloudglab/mastergo-cli` 是面向 MasterGo 设计平台的命令行 + AI skill 工具包。它服务三类使用者：

- 终端用户：直接执行 `mastergo dsl`、`mastergo d2c`、`mastergo c2d` 等命令。
- Agent / Skill：通过本地 CLI 子命令串联设计稿解析、D2C、组件文档与工作流生成。
- 脚本 / CI：使用 `npx -y @cloudglab/mastergo-cli@latest ...` 作为临时入口。

本项目当前刻意保持轻量：

- 单入口文件：`bin/mastergo.js`
- 无 TypeScript 构建链
- 无 `src/` 多层目录
- 只在 `skills/mastergo-cli/` 维护需要随 npm 包发布的 skill 资料

这不是欠债，而是当前设计选择。若后续能力继续膨胀到单文件难以维护，再评估是否拆成 `src/` 结构。

## 3. 目录职责

推荐按当前实际结构理解职责：

```text
.
├── AGENTS.md
├── CHANGELOG.md
├── README.md
├── README.zh-CN.md
├── design.md
├── bin/
│   └── mastergo.js
├── skills/
│   └── mastergo-cli/
│       ├── SKILL.md
│       ├── references/
│       └── scripts/
├── tests/
│   └── *.test.js
└── package.json
```

职责约定：

- `bin/mastergo.js`：CLI 主入口、命令分发、参数解析、HTTP 调用、写保护、资源落盘和安装/卸载逻辑。
- `skills/mastergo-cli/SKILL.md`：skill 主入口，负责告诉 Agent 该优先走哪些 CLI 命令。
- `skills/mastergo-cli/references/`：按主题组织的补充说明，例如 DSL、D2C、meta、多页面工作流。
- `skills/mastergo-cli/scripts/`：仅保留 legacy Python 脚本或离线辅助工具。
- `tests/*.test.js`：覆盖纯函数和关键参数解析逻辑，避免引入必须联网的脆弱测试。

## 4. CLI 架构约定

### 4.1 命令分层

`mastergo-cli` 当前命令可分成三类：

- 设计数据读取：
  `dsl`、`design-sections`、`design-svgs`、`design-texts`、`extract-svg`、`meta`
- 设计与代码互转：
  `d2c`、`c2d`
- 安装与维护：
  `install`、`update`、`uninstall`、`version`、`help`

### 4.2 section-first 原则

完整页面或大稿实现时：

1. 优先 `design-sections`
2. 再 `design-svgs`
3. 再 `design-texts`
4. 只有接口不可用或失败时，才退回 `dsl`

这条规则必须同时体现在：

- CLI 帮助文案
- README
- `SKILL.md`
- `AGENTS.md`

### 4.3 写保护原则

- 当前唯一远端写命令是 `c2d`
- 默认必须显式传 `--confirm true`
- `MASTERGO_DISABLE_WRITE=true` 时必须直接拒绝执行
- 拒绝执行时返回结构化 preview，而不是沉默失败

## 5. 上游同步策略

`mastergo-cli` 的源码参照上游是：

- `/Users/lixiaoming/Desktop/desktop/opensource/mastergo-magic-mcp`

同步原则：

1. 先确认上游最近更新的是“接口能力”“输出协议”“文档规则”还是“仅构建工具”。
2. 只回灌与 CLI/skill 用户面直接相关的能力；不要盲目照抄上游 MCP 服务的构建体系。
3. 当前项目是单文件 JS CLI，因此：
   - 可以吸收新的接口参数、HTTP header、输出格式、设计规则
   - 不需要照搬上游的 TypeScript、esbuild、eslint、MCP server 框架
4. 每次同步后：
   - 更新 `CHANGELOG.md`
   - 必要时更新 README / SKILL / references
   - 至少补纯函数单测

### 5.1 当前已知需要对齐的上游能力

相对于 `mastergo-magic-mcp@189a1d0` 之后的更新，当前项目需要关注这些用户面变化：

- design-data 工具新增默认输出格式能力：`json | yaml | tree`
- 支持 `--header "Key: Value"` 透传自定义 HTTP 请求头
- `getMeta`、`getDsl`、`getDesignSections`、`getDesignSvgs`、`getDesignTexts`、`extractSvg` 都应支持格式化输出
- README 与提示词中对 section bbox / rootContainer / absolute positioning 的说明更明确

## 6. 测试与脚本

### 6.1 当前脚本基线

`package.json` 里至少应维持：

```json
{
  "scripts": {
    "check": "node --check bin/mastergo.js",
    "help": "node bin/mastergo.js help",
    "test": "node --test tests/*.test.js",
    "pack:dry-run": "npm pack --dry-run"
  }
}
```

### 6.2 测试原则

- 优先测纯函数，不测必须联网的真实请求。
- 参数解析、URL 提取、DSL 简化、输出格式化等逻辑必须可单测。
- 若引入新的 CLI 纯函数能力，例如格式选择、header 解析、tree/yaml 输出，应补对应测试。

## 7. 发布要求

- 发正式版本前，同步更新：
  - `package.json`
  - `bin/mastergo.js` 中的版本号常量
  - `CHANGELOG.md`
- README 不写本次发版摘要。
- 发布前至少执行：
  - `npm run check`
  - `npm run test`
  - `npm run pack:dry-run`

## 8. 维护要求

- 修改 CLI 用户面能力时，README 与 `README.zh-CN.md` 必须同步。
- 修改 Agent 路由或使用原则时，`AGENTS.md` 与 `SKILL.md` 必须同步。
- 修改 section-first 或 D2C/C2D 关键流程时，相关 `references/*.md` 必须同步。
- 不要在没有必要的情况下把上游 MCP 服务内部实现细节完整搬进本项目；只吸收对 CLI/skill 用户真正有价值的部分。
