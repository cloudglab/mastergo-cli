# D2C 调试经验

本文件记录 `mastergo d2c` 命令调试中得到的硬规则和坑，供以后复用。

## 硬规则

### 1. file 链接可以作为入口，但通常要补完整 `/` 链

后端 `/mcp/d2c/events` 只接受 D2C 系统能识别的 contentId。MasterGo file 链接里的 `fileId` 和 `layer_id` 是拼接入口，但**只拼单段 `fileId-layerId` 经常会被拒**（返回 `10009 未找到该 contentId 对应的数据`）。这不代表该链接不能获取 Vue/HTML 代码，而是 D2C contentId 需要使用当前链接在 DSL 中展开后的完整节点路径。

合法的 contentId 形态：

| 形态 | 例子 | 状态 |
|------|------|------|
| 单段 | `188180928866602-510-58405` | 10009 拒绝 |
| 完整 `/` 链 | `188180928866602-510-58405/510-56892` | 200 成功 |
| D2C 任务 URI | `mastergo://getd2c/176452330285910-2-2845` | 200 成功（用 `--d2c-url` 传） |

**推论**：用 MasterGo file 链接获取 D2C 代码时，不能只测 `fileId-layerId` 然后下结论。更准确的流程是：

1. 从链接提取 `fileId` 和当前 `layer_id`
2. 先尝试 `fileId-layerId`
3. 如果返回 10009，用 `mastergo dsl <file-link>` 查看当前 layer 在 DSL 中展开后的节点路径
4. 用 `fileId-完整节点路径` 拼出 contentId 再试 D2C

也就是说，**有些** file 链接可以这样获取 Vue/HTML 代码：先用它拿 DSL，再用 DSL 展开的完整节点路径补全 contentId。本次实测：链接 `https://pri.cloudglab.cn/file/188180928866602?...&layer_id=510:58405` 直接拼 `188180928866602-510-58405` 失败；DSL 展开后存在节点路径 `510:58405/510:56892`，拼成 `188180928866602-510-58405/510-56892` 后成功返回 Vue。

注意：这不是“换成子层获取”，也不是“原链接获取不到”。设计入口仍然是原 file 链接和原 `layer_id=510:58405`；`/510:56892` 只是这个入口在 DSL 展开后的内部节点路径片段，用来补全 D2C 后端需要的 contentId。

### 2. `payload.frameType` 标识返回代码类型

接口响应里 `payload.frameType` 会明确告诉调用方返回的是什么类型的代码：

- `frameType: "vue"` → `payload.code` 直接是 Vue SFC（`<template>...</template>` 片段）
- 其它（`html` / 缺省） → 当作 HTML 字符串处理

CLI 在 `bin/mastergo.js` 的 `detectD2cCodeExtension()` 中优先看 `frameType`，其次看代码文本（`<template` / `<script setup` / `</template>`），命中保存为 `.vue`，否则 `.html`。

### 3. DSL 不暴露 D2C contentId

实测递归遍历整棵 DSL（`dsl.styles / dsl.nodes / dsl.components` 及其所有子节点），**没有任何 `d2c / contentId / documentId / mastergo://getd2c / codeGen` 字段**。

所以 DSL 不会直接返回现成的 D2C contentId；有些场景下，DSL 会提供当前入口的展开节点路径，用来**补全某些 file 链接推导出的 D2C contentId**。这不是通用规则。`mastergo dsl` 和 `mastergo d2c` 是两条接口线，可以组合使用，但如果完整路径仍然返回 `10009`，应回退为“只能获取 DSL，不能自动推导 D2C”，并改用真实的 `mastergo://getd2c/<id>`。

## CLI 行为

- `mastergo d2c --d2c-url mastergo://getd2c/<contentId>`：自动拆出 `contentId` 和 `documentId`（documentId = contentId 第一段）
- `mastergo d2c --content-id <id> --document-id <doc>`：直接传值
- `mastergo d2c` 调用失败且状态码为 404 / 错误码 10009 时，CLI 输出友好提示，要求使用 D2C 任务 URI 或完整 layer 链
- 输出文件名里 `/` 会被替换为 `_`，避免污染输出目录，例如 `188180928866602-510-58405_510-56892.vue`

## 教训（自我提醒）

- **“用户提供” ≠ “我实测过”**：b5 摘要里把用户提供的 `188180928866602-510-58405/510-56892` 当成“已实测能跑通”，这是错的。
  - 这条 contentId 是用户给的形态描述，不是经过 `mastergo d2c` 真实验证的。
  - 后续在 b6 摘要里又把它当事实传播。
- **真正实测过的形态**：
  - `188180928866602-510-58405`（单段）：10009 失败
  - `188180928866602-510-58405/510-56892`（完整 `/` 链）：200 成功，返回 Vue SFC，`frameType=vue`
- 规则：写结论前先确认“这条结论是我自己跑出来的，还是从上下文推测的”。两者必须明确区分，不允许混淆。

## 验证方式

```bash
# 1) 单段（预期失败 10009）
node bin/mastergo.js d2c --content-id <fileId>-<layerId> --document-id <fileId> --out-dir /tmp/d2c

# 2) 完整 / 链（预期成功，codeType=vue）
node bin/mastergo.js d2c --content-id <fileId>-<layerId>/<subLayerId> --document-id <fileId> --out-dir /tmp/d2c
```

返回 JSON 里 `files.codeType` 会是 `vue` 或 `html`，`files.codeFileName` 对应 `.vue` 或 `.html` 后缀。
