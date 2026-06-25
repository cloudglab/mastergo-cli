# 典型场景命令组合

沉淀高频用户意图 → 命令组合，避免每次都从零拼参数。所有示例假设 `MASTERGO_TOKEN` 已导出。

## 1. 解析一个小稿的 DSL

```bash
mastergo dsl "https://mastergo.com/goto/LhGgBAK"
# token 太多 / 图标密集时：
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --simplify
# 直接传 fileId + layerId 也可以：
mastergo dsl 176452330285910 1:23
```

返回里如果 `componentDocumentLinks` 非空，继续抓每个组件文档：

```bash
mastergo component-doc "https://example.com/button.mdx"
```

## 2. 大稿 / 完整页面生成

先用 `design-sections` 拿概览，再分批拉每个 section，最后补视觉与文本：

```bash
# 1. 概览：返回所有 section 列表
mastergo design-sections "https://mastergo.com/goto/LhGgBAK"

# 2. 按 index 拉 3-5 个一批
mastergo design-sections "https://mastergo.com/goto/LhGgBAK" --section-index 0
mastergo design-sections "https://mastergo.com/goto/LhGgBAK" --section-index 1
mastergo design-sections "https://mastergo.com/goto/LhGgBAK" --section-index 2

# 3. 缓存 SVG
mastergo design-svgs "https://mastergo.com/goto/LhGgBAK"

# 4. 精确长文本
mastergo design-texts "https://mastergo.com/goto/LhGgBAK"

# 5. 接口不可用时退回 dsl
mastergo dsl "https://mastergo.com/goto/LhGgBAK"
```

## 3. 设计转代码（D2C）

从设计稿里的"D2C 任务"拿到 `mastergo://getd2c/<contentId>` 链接：

```bash
mastergo d2c \
  --d2c-url "mastergo://getd2c/176452330285910-2-2845" \
  --out-dir ./mastergo-output
```

没有短链、有 `contentId + documentId` 时：

```bash
mastergo d2c \
  --content-id 176452330285910-2-2845 \
  --document-id 176452330285910 \
  --out-dir ./mastergo-output
```

`fileId` + 展开节点路径形式的 contentId 也可：`mastergo d2c --content-id 176452330285910-1:23/expanded --document-id 176452330285910 --out-dir ./mastergo-output`。如果返回 10009，先用 `mastergo dsl <file-link>` 拿展开节点路径。

代码文件按 `frameType` 自动落 `.vue` 或 `.html`；SVG 资源到 `asset/icons/`、图片到 `asset/images/`。

## 4. 代码同步到设计稿（C2D）

先预览（不真正写入）：

```bash
mastergo c2d --file ./index.html --short-link "https://mastergo.com/file/176452330285910?layer_id=1:23"
# 返回：{"ok":false,"preview":true,"reason":"...","action":"c2d","payload":{...}}
```

确认预览无误后真正执行：

```bash
mastergo c2d --file ./index.html --short-link "https://mastergo.com/file/176452330285910?layer_id=1:23" --confirm true
```

CI / 自动化环境要禁用：

```bash
MASTERGO_DISABLE_WRITE=true mastergo c2d --file ./index.html --file-id 176452330285910 --layer-id 1:23
# 返回：{"ok":false,"supported":false,"reason":"写操作已被 MASTERGO_DISABLE_WRITE 禁用。"}
```

## 5. 提取图层 SVG

```bash
mastergo extract-svg "https://mastergo.com/file/176452330285910?layer_id=1:23" --background-color "#ffffff"
```

## 6. 站点 / 页面元信息

```bash
mastergo meta --file-id 176452330285910 --layer-id 1:23
mastergo meta --file-id 176452330285910 --layer-id 1:23 --source-layer-id 1:22
```

## 7. 组件开发工作流

```bash
mastergo component-workflow \
  --root "$PWD" \
  --file-id 176452330285910 \
  --layer-id 1:23
```

产物落在 `<root>/.mastergo/`：

- `component-workflow.md`：开发流程文档（首次拉取时写入）
- `<componentName>.json`：组件 spec
- `images/<id>-N.svg`：每个 icon 的 SVG 文件

## 8. 安装 / 升级 / 卸载

```bash
# 首次安装（同时装全局 CLI + Skill）
npm i -g @cloudglab/mastergo-cli@latest
mastergo install

# 升级
mastergo update
mastergo update --skill-only     # 只升级 Skill
mastergo update --cli-only       # 只升级 CLI

# 卸载（破坏性，必须 --confirm）
mastergo uninstall --confirm true
mastergo uninstall --skill-only --confirm true
mastergo uninstall --cli-only --confirm true
```

## 9. URL 解析降级

```bash
# mastergo://getd2c/ 短链 → d2c
mastergo d2c --d2c-url "mastergo://getd2c/176452330285910-2-2845" --out-dir .

# /goto/ 短链 → extractIdsFromUrl 内部 follow redirect → 拿 fileId / layerId
mastergo dsl "https://mastergo.com/goto/LhGgBAK"

# /file/ 直链 → 拿 fileId + layer_id
mastergo dsl "https://mastergo.com/file/176452330285910?layer_id=1:23"
```

## 10. Token / endpoint 覆盖

```bash
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --token "$CUSTOM_TOKEN"
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --url "https://staging.mastergo.com"
mastergo dsl "https://mastergo.com/goto/LhGgBAK" --rule "颜色必须使用 token，不允许直接写 #hex" --rule "..."
```

## 11. 离线 DSL 摘要（仅做人类阅读，不进代码生成）

```bash
mastergo analyze "https://mastergo.com/goto/LhGgBAK" --format tree
mastergo analyze "https://mastergo.com/goto/LhGgBAK" --format flat
```

依赖 Python 3，不需要分析时不要调用。

## 12. 自定义 DSL 规则（环境变量）

```bash
export RULES='["生成代码时按钮 height 必须 ≥ 32px","禁止使用 !important"]'
mastergo dsl "https://mastergo.com/goto/LhGgBAK"
```

`RULES` 与 `--rule` 会合并到返回的 `rules` 数组里；`--no-rule` 会清空内置规则，仅保留 CLI / 环境变量传入的。