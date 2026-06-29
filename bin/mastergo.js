#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promoteAgentFirstFields, summarizeList } from './list-summary.js';

const packageName = '@cloudglab/mastergo-cli';
const packageVersion = '1.0.0';
const gitSkillSource = 'cloudglab/mastergo-cli';
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = resolve(rootDir, 'skills', 'mastergo-cli');
const scriptsDir = resolve(skillDir, 'scripts');
const referencesDir = resolve(skillDir, 'references');
let proxyDispatcher;
let proxyDispatcherUrl;

const legacyCommands = new Map([
  ['analyze', 'mastergo_analyze.py'],
  ['fetch-docs', 'mastergo_fetch_docs.py'],
]);

async function main(argv) {
  const [command = 'help', ...args] = argv;

  if (command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(`mastergo-cli ${packageVersion}`);
    return;
  }

  if (command === 'install' || command === 'update') {
    await installSkill(args, command);
    return;
  }

  if (command === 'uninstall') {
    await uninstallSkill(args);
    return;
  }

  if (command === 'dsl' || command === 'get-dsl') return getDsl(args);
  if (command === 'design-sections' || command === 'get-design-sections') return getDesignSections(args);
  if (command === 'design-svgs' || command === 'get-design-svgs') return getDesignSvgs(args);
  if (command === 'design-texts' || command === 'get-design-texts') return getDesignTexts(args);
  if (command === 'extract-svg') return extractSvg(args);
  if (command === 'd2c') return getD2c(args);
  if (command === 'browser-d2c') return getBrowserD2c(args);
  if (command === 'c2d') return postC2d(args);
  if (command === 'meta') return getMeta(args);
  if (command === 'component-doc') return getComponentDoc(args);
  if (command === 'component-workflow') return getComponentWorkflow(args);

  const script = legacyCommands.get(command);
  if (!script) {
    throw new Error(`未知命令: ${command}. 运行 mastergo help 查看用法。`);
  }

  await runPython(resolve(scriptsDir, script), args);
}

function printHelp() {
  console.log(`${packageName}

Usage:
  mastergo analyze <mastergo-url> [--format tree|json|flat]
  mastergo dsl|get-dsl <mastergo-url|fileId layerId> [--source-layer-id ID] [--rule RULE] [--proxy URL] [--header "Key: Value"] [--format json|yaml|tree] [--no-rule] [--simplify]
  mastergo design-sections <mastergo-url|fileId layerId> [--source-layer-id ID] [--section-index N] [--format json|yaml|tree]
  mastergo design-svgs <mastergo-url|fileId layerId> [--source-layer-id ID] [--format json|yaml|tree]
  mastergo design-texts <mastergo-url|fileId layerId> [--source-layer-id ID] [--format json|yaml|tree]
  mastergo extract-svg <mastergo-url|fileId layerId> [--background-color #fff] [--format json|yaml|tree]
  mastergo d2c (--d2c-url mastergo://getd2c/<contentId> | --content-id ID --document-id ID) [--out-dir DIR]
  mastergo browser-d2c [--page-url URL] [--page-id N] [--out-dir DIR] [--chrome-debug-url URL]
  mastergo c2d --file HTML (--short-link URL | --file-id ID [--layer-id ID]) [--confirm true]
  mastergo meta --file-id ID --layer-id ID [--source-layer-id ID] [--format json|yaml|tree]
  mastergo component-doc <url>
  mastergo component-workflow --root PATH --file-id ID --layer-id ID [--source-layer-id ID]
  mastergo fetch-docs <url...>
  mastergo install [--skill-source git|npm] [--skill-local-path <path>] [--cli-only] [--skill-only]
  mastergo update [--skill-source git|npm] [--skill-local-path <path>] [--cli-only] [--skill-only]
  mastergo uninstall [--cli-only] [--skill-only] [--confirm true]
  mastergo version

Environment:
  MASTERGO_TOKEN / MASTERGO_API_TOKEN / MG_MCP_TOKEN     API token
  MASTERGO_ENDPOINT / API_BASE_URL                      API base URL
  MASTERGO_DISABLE_WRITE=true                            Disable all write commands (c2d)
  HTTPS_PROXY / https_proxy / HTTP_PROXY / http_proxy   HTTP(S) proxy URL
  CHROME_DEBUG_URL                                       Chrome DevTools endpoint, default http://127.0.0.1:9222
  DEFAULT_FORMAT                                         Default design-data format: json|yaml|tree
  RULES                                                 JSON array of extra DSL rules
`);
}

async function getDsl(args) {
  const { options, positionals } = parseFlags(args);
  const ids = await resolveDesignIds({ options, positionals, requireLayerId: true });
  const response = await requestJson('/mcp/dsl', {
    fileId: normalizeFileId(ids.fileId),
    layerId: ids.layerId,
    sourceLayerId: ids.sourceLayerId,
  }, options);
  const dsl = options.simplify ? simplifyDsl(response) : response;
  printData({
    dsl,
    componentDocumentLinks: extractComponentDocumentLinks(dsl),
    rules: options['no-rule'] ? [] : buildDslRules(options),
  }, options.format);
}

async function getDesignSections(args) {
  const { options, positionals } = parseFlags(args);
  const ids = await resolveDesignIds({ options, positionals, requireLayerId: true });
  const result = await requestJson('/mcp/design-sections', {
    fileId: normalizeFileId(ids.fileId),
    layerId: ids.sourceLayerId || ids.layerId,
    sectionIndex: options['section-index'],
  }, options, 'GET', undefined, { timeoutMs: 120000 });
  printData(withProcessedListSummary({ result, rules: buildDesignSectionsRules() }, result?.sections || result), options.format);
}

async function getDesignSvgs(args) {
  const { options, positionals } = parseFlags(args);
  const ids = await resolveDesignIds({ options, positionals, requireLayerId: true });
  const result = await requestJson('/mcp/design-svgs', {
    fileId: normalizeFileId(ids.fileId),
    layerId: ids.sourceLayerId || ids.layerId,
  }, options, 'GET', undefined, { timeoutMs: 120000 });
  printData(withProcessedListSummary({ result }, result?.svgs || result), options.format);
}

async function getDesignTexts(args) {
  const { options, positionals } = parseFlags(args);
  const ids = await resolveDesignIds({ options, positionals, requireLayerId: true });
  const result = await requestJson('/mcp/design-texts', {
    fileId: normalizeFileId(ids.fileId),
    layerId: ids.sourceLayerId || ids.layerId,
  }, options, 'GET', undefined, { timeoutMs: 120000 });
  printData(withProcessedListSummary({ result }, result?.texts || result), options.format);
}

async function extractSvg(args) {
  const { options, positionals } = parseFlags(args);
  const ids = await resolveDesignIds({ options, positionals, requireLayerId: true });
  const result = await requestJson('/mcp/extract-svg', {
    fileId: normalizeFileId(ids.fileId),
    layerId: ids.layerId,
    backgroundColor: options['background-color'],
  }, options);
  printData({ result }, options.format);
}

async function getD2c(args) {
  const { options } = parseFlags(args);
  const ids = resolveD2cIds(options);
  const data = await requestJson('/mcp/d2c/events', ids, options);
  const payload = extractD2cPayload(data);
  const finalContentId = payload.contentId || ids.contentId;
  const saveResult = await saveD2c({
    data,
    outDir: options['out-dir'],
    contentId: finalContentId,
    code: payload.code,
    frameType: payload.frameType,
    resourcePath: payload.resourcePath,
    svg: payload.svg,
    image: payload.image,
  });
  printJson({ result: data, files: saveResult });
}

async function getBrowserD2c(args) {
  const { options } = parseFlags(args);
  const pageUrl = options['page-url'] || options.pageUrl;
  const pageId = options['page-id'] || options.pageId;
  const outDir = options['out-dir'];
  const debugUrl = options['chrome-debug-url'] || process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';
  const page = await resolveChromePage({ debugUrl, pageUrl, pageId });
  const evaluation = await chromeRuntimeEvaluate({
    debugUrl,
    page,
    expression: `(() => {
      if (!window.mg || !window.mg.codegen) {
        return { ok: false, reason: '当前页面不存在 mg.codegen，无法走浏览器辅助 D2C。' };
      }
      const selection = window.mg.document?.currentPage?.selection || [];
      if (!selection.length) {
        return { ok: false, reason: '当前页面没有选中任何图层。' };
      }
      const node = selection[0];
      return Promise.resolve(window.mg.codegen.getCode(node.id))
        .then((result) => ({
          ok: true,
          pageTitle: document.title,
          selection: { id: node.id, name: node.name, type: node.type, width: node.width, height: node.height },
          result,
        }))
        .catch((error) => ({
          ok: false,
          reason: String(error),
          selection: { id: node.id, name: node.name, type: node.type },
        }));
    })()`,
  });

  const payload = evaluation?.result?.value ?? evaluation?.result;
  if (!payload?.ok) {
    printJson({
      ok: false,
      source: 'browser-d2c',
      page: { id: page.id, title: page.title, url: page.url },
      selection: payload?.selection || null,
      reason: payload?.reason || '浏览器辅助 D2C 失败。',
    });
    return;
  }

  const files = await saveBrowserD2c({
    outDir,
    selection: payload.selection,
    codeResult: payload.result || {},
  });

  printJson({
    ok: true,
    source: 'browser-d2c',
    page: { id: page.id, title: page.title, url: page.url },
    selection: payload.selection,
    files,
    preview: {
      fileName: payload.result?.fileName || '',
      type: payload.result?.type || '',
      importType: payload.result?.importType || '',
      staticsCount: Array.isArray(payload.result?.statics) ? payload.result.statics.length : 0,
    },
  });
}

async function postC2d(args) {
  const { options, positionals } = parseFlags(args);
  const filePath = resolve(requireOption(options, 'file'));
  const ids = await resolveDesignIds({ options, positionals, requireLayerId: false });
  if (!ids.fileId) throw new Error('请传 --short-link，或至少传 --file-id（--layer-id 可选）');

  // 写保护：参考 design.md §7.2。先检查 DISABLE_WRITE，再检查 confirm。
  if (process.env.MASTERGO_DISABLE_WRITE === 'true') {
    printJson({
      ok: false,
      supported: false,
      reason: '写操作已被 MASTERGO_DISABLE_WRITE 禁用。',
    });
    return;
  }
  if (!parseConfirm(options.confirm)) {
    printJson({
      ok: false,
      preview: true,
      reason: '写操作缺少确认。若要执行 c2d，需要传入 confirm: true。',
      action: 'c2d',
      payload: {
        fileId: normalizeFileId(ids.fileId),
        layerId: ids.layerId || undefined,
        file: filePath,
      },
    });
    return;
  }

  const data = readFileSync(filePath, 'utf8');
  const result = await requestJson('/mcp/c2d', {}, options, 'POST', {
    data,
    fileId: normalizeFileId(ids.fileId),
    layerId: ids.layerId || undefined,
  });
  printJson(result);
}

function parseConfirm(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

async function getMeta(args) {
  const { options } = parseFlags(args);
  const result = await requestJson('/mcp/meta', {
    fileId: normalizeFileId(requireOption(options, 'file-id')),
    layerId: requireOption(options, 'layer-id'),
    sourceLayerId: options['source-layer-id'],
  }, options);
  printData({ result, rules: readReference('meta.md') }, options.format);
}

async function getComponentDoc(args) {
  const { options, positionals } = parseFlags(args);
  const [url] = positionals;
  if (!url) throw new Error('component-doc 需要传入文档 URL');
  const response = await fetchWithProxy(url, { headers: authHeaders({}, false) }, options);
  if (!response.ok) {
    printJson({ error: 'Failed to get component documentation', message: `${response.status} ${response.statusText}` });
    return;
  }
  console.log(await response.text());
}

async function getComponentWorkflow(args) {
  const { options } = parseFlags(args);
  const rootPath = resolve(requireOption(options, 'root'));
  const data = await requestJson('/mcp/style', {
    fileId: normalizeFileId(requireOption(options, 'file-id')),
    layerId: requireOption(options, 'layer-id'),
    sourceLayerId: options['source-layer-id'],
  }, options);
  const jsonData = Array.isArray(data) ? data : [data];
  const component = jsonData[0];
  if (!component) throw new Error('组件样式接口返回为空');

  const baseDir = resolve(rootPath, '.mastergo');
  const imageDir = resolve(baseDir, 'images');
  if (!existsSync(imageDir)) mkdirSync(imageDir, { recursive: true });

  walkLayer(component, (layer) => {
    if (!Array.isArray(layer.path) || layer.path.length === 0) return;
    layer.imageUrls = [];
    const id = String(layer.id || 'layer').replaceAll('/', '&').replaceAll(':', '_');
    layer.path.forEach((svgPath, index) => {
      const filePath = resolve(imageDir, `${id}-${index}.svg`);
      if (!existsSync(filePath)) {
        writeFileSync(filePath, `<svg width="100%" height="100%" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">\n  <path d="${svgPath}" fill="currentColor"/>\n</svg>`, 'utf8');
      }
      layer.imageUrls.push(filePath);
    });
    delete layer.path;
  });

  const workflowFilePath = resolve(baseDir, 'component-workflow.md');
  if (!existsSync(workflowFilePath)) {
    writeFileSync(workflowFilePath, readReference('component-workflow.md'), 'utf8');
  }

  const componentName = component.name || 'component';
  const componentJsonPath = resolve(baseDir, `${componentName}.json`);
  writeFileSync(componentJsonPath, JSON.stringify(component), 'utf8');
  printJson({
    files: { workflow: workflowFilePath, componentSpec: componentJsonPath },
    message: 'Component development files successfully created',
    rules: [
      `Follow the component workflow process defined in file://${workflowFilePath} for structured development. This workflow contains a lot of content, you'll need to read it in multiple sessions.`,
      `Implement the component according to the specifications in file://${componentJsonPath}, ensuring all properties and states are properly handled.`,
    ],
  });
}

async function requestJson(path, params, options, method = 'GET', body, requestOptions = {}) {
  const url = new URL(path, getBaseUrl(options));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestOptions.timeoutMs || 30000);
  try {
    const response = await fetchWithProxy(url, {
      method,
      headers: authHeaders(options),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }, options);
    const text = await response.text();
    if (!response.ok) {
      const hint = buildRequestHint(path, response.status);
      throw new Error(hint ? `${text}\n${hint}` : (text || `请求失败: ${response.status} ${response.statusText}`));
    }
    try { return JSON.parse(text); } catch { return text; }
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithProxy(input, init = {}, options = {}) {
  const proxyUrl = getProxyUrl(options);
  if (!proxyUrl) return fetch(input, init);
  const dispatcher = await getProxyDispatcher(proxyUrl);
  return fetch(input, { ...init, dispatcher });
}

function getProxyUrl(options = {}) {
  return options.proxy || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || '';
}

async function getProxyDispatcher(proxyUrl) {
  if (proxyDispatcher && proxyDispatcherUrl === proxyUrl) return proxyDispatcher;
  const { ProxyAgent } = await import('undici');
  proxyDispatcher = new ProxyAgent(proxyUrl);
  proxyDispatcherUrl = proxyUrl;
  return proxyDispatcher;
}

function authHeaders(options, requireToken = true) {
  const token = options.token || process.env.MASTERGO_TOKEN || process.env.MASTERGO_API_TOKEN || process.env.MG_MCP_TOKEN;
  if (requireToken && !token) throw new Error('缺少 token：请传 --token 或设置 MASTERGO_TOKEN');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { 'X-MG-UserAccessToken': token } : {}),
    ...parseHeaderMap(options.header),
  };
}

function getBaseUrl(options) {
  const raw = options.url || process.env.MASTERGO_ENDPOINT || process.env.API_BASE_URL || 'https://mastergo.com';
  const url = new URL(raw);
  return `${url.protocol}//${url.host}`;
}

function parseFlags(args) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const [key, inlineValue] = arg.slice(2).split('=');
    if (key === 'no-rule' || key === 'simplify') {
      options[key] = true;
      continue;
    }
    const value = inlineValue ?? args[index + 1];
    if (options[key] === undefined) {
      options[key] = value;
    } else if (Array.isArray(options[key])) {
      options[key].push(value);
    } else {
      options[key] = [options[key], value];
    }
    if (inlineValue === undefined) index += 1;
  }
  return { options, positionals };
}

function requireOption(options, key) {
  if (!options[key]) throw new Error(`缺少参数 --${key}`);
  return options[key];
}

async function resolveDesignIds({ options, positionals, requireLayerId }) {
  const shortLink = options['short-link'] || options.shortLink;
  if (shortLink) {
    return extractIdsFromUrl(shortLink, { requireLayerId, options });
  }

  const maybeUrl = positionals.find((value) => /^https?:\/\//.test(value));
  if (maybeUrl) {
    return extractIdsFromUrl(maybeUrl, { requireLayerId, options });
  }

  const fileId = options['file-id'] || options.fileId || positionals[0];
  const layerId = options['layer-id'] || options.layerId || positionals[1];
  const sourceLayerId = options['source-layer-id'] || options.sourceLayerId;
  if (requireLayerId && (!fileId || !layerId)) {
    throw new Error('请传 MasterGo URL，或同时传 fileId 和 layerId');
  }
  return { fileId, layerId, sourceLayerId };
}

async function extractIdsFromUrl(inputUrl, { requireLayerId, options = {} }) {
  let targetUrl = inputUrl;
  if (inputUrl.includes('/goto/')) {
    const response = await fetchWithProxy(inputUrl, { redirect: 'manual' }, options);
    const redirectUrl = response.headers.get('location');
    if (!redirectUrl) throw new Error('No redirect URL found for short link');
    targetUrl = new URL(redirectUrl, inputUrl).href;
  }

  const url = new URL(targetUrl);
  const fileId = url.pathname.split('/').find((segment) => /^\d+$/.test(segment));
  const layerId = url.searchParams.get('layer_id') || undefined;
  const sourceLayerId = url.searchParams.get('source_layer_id') || undefined;

  if (!fileId) throw new Error('Could not extract fileId from URL');
  if (requireLayerId && !layerId) throw new Error('Could not extract layerId from URL');
  return { fileId, layerId, sourceLayerId };
}

function normalizeFileId(fileId) {
  return String(fileId || '').replace(/^file\//, '');
}

function extractComponentDocumentLinks(dsl) {
  const documentLinks = new Set();
  const traverse = (node) => {
    const link = node?.componentInfo?.componentSetDocumentLink?.[0];
    if (link) documentLinks.add(link);
    node?.children?.forEach?.(traverse);
  };
  dsl?.nodes?.forEach?.(traverse);
  return Array.from(documentLinks);
}

function simplifyDsl(dsl) {
  const stats = { iconPlaceholders: 0, pathsRemoved: 0 };
  const cloned = cloneJson(dsl);
  if (Array.isArray(cloned?.nodes)) cloned.nodes = simplifyDslNodes(cloned.nodes, stats);
  if (cloned?.root && typeof cloned.root === 'object') cloned.root = simplifyDslNode(cloned.root, stats);
  if (cloned && typeof cloned === 'object') {
    cloned._simplified = true;
    cloned._simplificationStats = stats;
  }
  return cloned;
}

function simplifyDslNodes(nodes, stats) {
  return nodes.map((node) => simplifyDslNode(node, stats));
}

function simplifyDslNode(node, stats) {
  if (!node || typeof node !== 'object') return node;
  if (isIconLikeNode(node)) return createIconPlaceholder(node, stats);
  if (Array.isArray(node.children)) node.children = simplifyDslNodes(node.children, stats);
  return node;
}

function isIconLikeNode(node) {
  const type = String(node.type || '').toUpperCase();
  const name = String(node.name || '').toLowerCase();
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const iconTypes = new Set(['PATH', 'VECTOR', 'SVG_ELLIPSE', 'SVG_RECTANGLE']);
  if (iconTypes.has(type)) return true;
  if (Array.isArray(node.path) && node.path.length > 0) return true;
  return !hasChildren && ['ic-', 'ic_', 'ico_', 'icon', '图标'].some((keyword) => name.includes(keyword));
}

function createIconPlaceholder(node, stats) {
  stats.iconPlaceholders += 1;
  if (Array.isArray(node.path)) stats.pathsRemoved += node.path.length;
  const placeholder = pickDefined({
    type: 'ICON_PLACEHOLDER',
    id: node.id,
    name: node.name || 'icon',
    layout: node.layout,
    layoutStyle: node.layoutStyle,
    fill: node.fill,
    strokeColor: node.strokeColor,
    borderRadius: node.borderRadius,
    componentInfo: node.componentInfo,
    _originalType: node.type,
    _isSimplified: true,
  });
  return placeholder;
}

function pickDefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function cloneJson(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function buildDslRules(options) {
  const envRules = parseJsonArray(process.env.RULES, 'RULES');
  const cliRules = Array.isArray(options.rule) ? options.rule : options.rule ? [options.rule] : [];
  return [
    '[FALLBACK] Use dsl/get-dsl only when design-sections/get-design-sections is unavailable or returns an error. Prefer the section-by-section workflow for all designs.',
    'token filed must be generated as a variable (colors, shadows, fonts, etc.) and the token field must be displayed in the comment',
    "Background colors come from the node's fillStyleId — look it up in the DSL styles map. Do NOT invent background gradients or colors. If a node has no fill style, leave its background transparent.",
    `componentDocumentLinks is a list of frontend component documentation links used in the DSL layer, designed to help you understand how to use the components.\nWhen it exists and is not empty, you need to use mastergo component-doc in a for loop to get the URL content of all components in the list, understand how to use the components, and generate code using the components.`,
    ...envRules,
    ...cliRules,
  ];
}

function buildDesignSectionsRules() {
  return [
    '## MasterGo Design DSL - Section-by-Section Workflow',
    'Step 0: Get layout overview first. Call design-sections WITHOUT --section-index. The response contains sections with nodeCount, totalSections, totalNodes, and may include rootMetadata and splitContainers.',
    "Use rootMetadata, when present, as the page frame's width, height, name, type, fill, and styles. Use splitContainers to understand split layout direction, item spacing, and padding.",
    'Step 1: Fetch every section DSL. For i = 0 to totalSections-1, call design-sections with --section-index i. You MUST fetch all sections and must not skip section indexes.',
    'Fetch section details in batches of 3-5 calls at a time. Do NOT request all sections simultaneously, because too many concurrent requests can time out.',
    'Step 2: After all sections are fetched, call BOTH design-svgs and design-texts with the same fileId/layerId.',
    'SVG data keys use S{sectionIndex}:{namedAncestor}|{ancestorId}. Match by S{sectionIndex}, insert the returned svgHtml directly, and do NOT construct your own SVG.',
    'Text data keys use T{sectionIndex}|{nodeId}. Look up each key and insert the returned text verbatim. Do NOT paraphrase, translate, summarize, or invent text.',
    'Step 3: Generate a single complete HTML file containing all sections in order. Token fields must become CSS variables with comments indicating the token name.',
    'If componentDocumentLinks exists, call component-doc for every linked document before generating component code.',
    'Tool selection: design-sections is the PRIMARY tool. dsl/get-dsl is a FALLBACK only when design-sections is unavailable or fails. Never call both design-sections and dsl/extract-svg just to verify the same design.',
    'Text fidelity: render all nodes, including every tab, button, and text element. Do not duplicate text from one node to another.',
    "Background and color: use the DSL styles map plus each node's fillStyleId/strokeStyleId. Do NOT invent gradients, colors, or decorations. Transparent/empty fills should remain transparent or inherit from parent.",
    'Anti-hallucination: never fabricate SVG path data, icon shapes, backgrounds, gradients, or decorative details that are not present in the returned design data.',
  ];
}

function buildRequestHint(path, status) {
  if (path === '/mcp/d2c/events' && status === 404) {
    return '提示：D2C contentId 是 D2C 任务运行 ID（形如 mastergo://getd2c/<contentId>），不是 fileId-layerId；请用 --d2c-url 或提供真实 contentId。';
  }
  if (status === 404 && ['/mcp/design-sections', '/mcp/design-svgs', '/mcp/design-texts'].includes(path)) {
    return `提示：${path} 接口不可用，请确认后端 frontend-mcp-server 已更新到支持 design sections/svg/text 的版本。`;
  }
  return '';
}

function parseJsonArray(value, name) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error(`${name} 必须是 JSON 数组`);
  return parsed.map(String);
}

async function resolveChromePage({ debugUrl, pageUrl, pageId }) {
  try {
    const pages = await chromeJson(`${debugUrl}/json/list`);
    if (pageId !== undefined && pageId !== null && pageId !== '') {
      const index = Number(pageId);
      if (!Number.isInteger(index) || index < 1 || index > pages.length) {
        throw new Error(`--page-id 超出范围，当前共有 ${pages.length} 个页面`);
      }
      return normalizeChromePage(pages[index - 1], index);
    }

    if (pageUrl) {
      const matched = pages.find((page) => String(page.url || '').includes(String(pageUrl)));
      if (!matched) throw new Error(`未找到 URL 匹配 ${pageUrl} 的 Chrome 页面`);
      return normalizeChromePage(matched, pages.indexOf(matched) + 1);
    }

    const filePage = pages.find((page) => String(page.url || '').includes('/file/'));
    if (filePage) return normalizeChromePage(filePage, pages.indexOf(filePage) + 1);
  } catch {
    return resolveChromePageViaBrowserSocket({ debugUrl, pageUrl, pageId });
  }

  throw new Error('未找到可用的 MasterGo 页面。请传 --page-url 或 --page-id。');
}

function normalizeChromePage(page, index) {
  return {
    index,
    id: page.id,
    title: page.title || '',
    url: page.url || '',
    webSocketDebuggerUrl: page.webSocketDebuggerUrl || '',
  };
}

async function chromeJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Chrome DevTools 请求失败: ${response.status} ${response.statusText}`);
  return response.json();
}

async function chromeRuntimeEvaluate({ debugUrl, page, expression }) {
  const version = await resolveChromeVersion(debugUrl);
  if (page.targetId) {
    return chromeBrowserSessionCommand(version.webSocketDebuggerUrl, page.targetId, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
  }

  const socketUrl = page.webSocketDebuggerUrl || version.webSocketDebuggerUrl;
  if (!socketUrl) throw new Error('Chrome DevTools 未返回 webSocketDebuggerUrl');
  const socket = new WebSocket(socketUrl);
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      rejectPromise(new Error('Chrome Runtime.evaluate 超时'));
    }, 15000);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression,
          awaitPromise: true,
          returnByValue: true,
        },
      }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        socket.close();
        if (message.error) {
          rejectPromise(new Error(message.error.message || 'Chrome Runtime.evaluate 失败'));
          return;
        }
        if (message.result?.exceptionDetails) {
          rejectPromise(new Error(message.result.exceptionDetails.text || 'Chrome Runtime.evaluate 抛异常'));
          return;
        }
        resolvePromise(message.result);
      } catch (error) {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        rejectPromise(error);
      }
    });

    socket.addEventListener('error', () => {
      clearTimeout(timer);
      rejectPromise(new Error('Chrome DevTools WebSocket 连接失败'));
    });
  });
}

async function resolveChromeVersion(debugUrl) {
  try {
    return await chromeJson(`${debugUrl}/json/version`);
  } catch (error) {
    const wsUrl = await readChromeBrowserWebSocketUrl(debugUrl);
    return { webSocketDebuggerUrl: wsUrl };
  }
}

async function readChromeBrowserWebSocketUrl(debugUrl) {
  const activePortPath = resolve(process.env.HOME || '', 'Library/Application Support/Google/Chrome/DevToolsActivePort');
  if (!existsSync(activePortPath)) {
    throw new Error(`Chrome DevTools 请求失败，且未找到 ${activePortPath}`);
  }
  const lines = readFileSync(activePortPath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error('Chrome DevTools ActivePort 内容不完整');
  }
  const browserPath = lines[1];
  const base = new URL(debugUrl);
  return `ws://${base.hostname}:${lines[0]}${browserPath}`;
}

async function resolveChromePageViaBrowserSocket({ debugUrl, pageUrl, pageId }) {
  const browserSocketUrl = await readChromeBrowserWebSocketUrl(debugUrl);
  const targets = await chromeBrowserCommand(browserSocketUrl, 'Target.getTargets', {});
  const pages = (targets?.targetInfos || [])
    .filter((target) => target.type === 'page')
    .map((target, index) => ({
      index: index + 1,
      id: target.targetId,
      targetId: target.targetId,
      title: target.title || '',
      url: target.url || '',
      attached: target.attached,
    }));

  if (pageId !== undefined && pageId !== null && pageId !== '') {
    const index = Number(pageId);
    if (!Number.isInteger(index) || index < 1 || index > pages.length) {
      throw new Error(`--page-id 超出范围，当前共有 ${pages.length} 个页面`);
    }
    return pages[index - 1];
  }

  if (pageUrl) {
    const matched = pages.find((page) => String(page.url || '').includes(String(pageUrl)));
    if (!matched) throw new Error(`未找到 URL 匹配 ${pageUrl} 的 Chrome 页面`);
    return matched;
  }

  const filePage = pages.find((page) => String(page.url || '').includes('/file/'));
  if (filePage) return filePage;
  throw new Error('未找到可用的 MasterGo 页面。请传 --page-url 或 --page-id。');
}

async function chromeBrowserCommand(browserSocketUrl, method, params) {
  const socket = new WebSocket(browserSocketUrl);
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      rejectPromise(new Error(`Chrome ${method} 超时`));
    }, 15000);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ id: 1, method, params }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        socket.close();
        if (message.error) {
          rejectPromise(new Error(message.error.message || `Chrome ${method} 失败`));
          return;
        }
        resolvePromise(message.result);
      } catch (error) {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        rejectPromise(error);
      }
    });

    socket.addEventListener('error', () => {
      clearTimeout(timer);
      rejectPromise(new Error(`Chrome ${method} websocket 连接失败`));
    });
  });
}

async function chromeBrowserSessionCommand(browserSocketUrl, targetId, method, params) {
  const socket = new WebSocket(browserSocketUrl);
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      rejectPromise(new Error(`Chrome ${method} session 超时`));
    }, 15000);

    let sessionId = null;
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Target.attachToTarget',
        params: { targetId, flatten: true },
      }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.id === 1) {
          if (message.error) {
            clearTimeout(timer);
            socket.close();
            rejectPromise(new Error(message.error.message || 'Target.attachToTarget 失败'));
            return;
          }
          sessionId = message.result?.sessionId;
          socket.send(JSON.stringify({
            id: 2,
            sessionId,
            method,
            params,
          }));
          return;
        }

        if (message.id === 2) {
          clearTimeout(timer);
          const result = message.result;
          if (sessionId) {
            socket.send(JSON.stringify({
              id: 3,
              sessionId,
              method: 'Target.detachFromTarget',
              params: { sessionId },
            }));
          }
          socket.close();
          if (result?.exceptionDetails) {
            rejectPromise(new Error(result.exceptionDetails.text || `${method} 抛异常`));
            return;
          }
          resolvePromise(result);
        }
      } catch (error) {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        rejectPromise(error);
      }
    });

    socket.addEventListener('error', () => {
      clearTimeout(timer);
      rejectPromise(new Error(`Chrome ${method} session websocket 连接失败`));
    });
  });
}

function extractD2cPayload(d2c) {
  const data = d2c?.data;
  const firstItem = Array.isArray(data) ? data[0] : undefined;
  const payload = firstItem?.payload ?? d2c?.payload ?? d2c?.data?.payload ?? firstItem?.payload?.payload ?? data?.payload ?? {};
  return {
    contentId: String(firstItem?.contentId ?? payload?.contentId ?? d2c?.contentId ?? ''),
    frameType: String(payload?.frameType ?? firstItem?.frameType ?? d2c?.frameType ?? ''),
    code: String(payload?.code ?? payload?.html ?? payload?.content ?? d2c?.code ?? ''),
    resourcePath: pickFirstWithContent([payload?.resourcePath, d2c?.resourcePath, firstItem?.resourcePath]),
    image: pickFirstWithContent([payload?.image, firstItem?.image]),
    svg: pickFirstWithContent([payload?.svg, firstItem?.svg]),
  };
}

async function saveD2c({ outDir, contentId, code, frameType, resourcePath, svg, image }) {
  const targetDir = outDir ? resolve(outDir) : process.cwd();
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const codeExtension = detectD2cCodeExtension({ code, frameType });
  const safeContentId = String(contentId || 'index').replace(/[/\\]/g, '_').replace(/^\.+/, '');
  const codeFileName = `${safeContentId}${codeExtension}`;
  const codePath = resolve(targetDir, codeFileName);
  if (hasContent(code)) writeFileSync(codePath, code, 'utf8');

  const resourcePathMap = parseResourcePath(resourcePath);
  ensureDir(resolve(targetDir, resourcePathMap.image));
  ensureDir(resolve(targetDir, resourcePathMap.svg));
  const [svgWrite, imageWrite] = await Promise.all([
    writeResource(svg, targetDir, resourcePathMap.svg, 'svg'),
    writeResource(image, targetDir, resourcePathMap.image, 'png'),
  ]);

  return {
    targetDir,
    codeFileName,
    codePath,
    codeType: codeExtension.slice(1),
    svgCount: svgWrite.savedCount,
    imageCount: imageWrite.savedCount,
    resourcePathMap,
  };
}

function detectD2cCodeExtension({ code, frameType }) {
  const typeText = String(frameType || '').toLowerCase();
  const codeText = String(code || '').trimStart().toLowerCase();
  if (typeText.includes('vue')) return '.vue';
  if (codeText.startsWith('<template') || codeText.includes('<script setup') || codeText.includes('</template>')) return '.vue';
  return '.html';
}

function detectBrowserCodeType(codeResult) {
  const typeText = String(codeResult.type || '').toLowerCase();
  const fileName = String(codeResult.fileName || '').toLowerCase();
  const codeText = String(codeResult.code || '').trimStart().toLowerCase();
  if (typeText.includes('vue')) return 'vue';
  if (fileName.endsWith('.vue')) return 'vue';
  if (codeText.startsWith('<template') || codeText.includes('<script setup') || codeText.includes('</template>')) return 'vue';
  return 'html';
}

function sanitizeOutputName(name) {
  return String(name || 'index')
    .replace(/[/\\]/g, '_')
    .replace(/^\.+/, '')
    .replace(/^_+/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureOutputExtension(fileName, codeType) {
  if (/\.[a-zA-Z0-9]+$/.test(fileName)) return fileName;
  return `${fileName}.${codeType === 'vue' ? 'vue' : 'html'}`;
}

function parseResourcePath(resourcePath) {
  const map = { image: 'asset/images', svg: 'asset/icons' };
  if (!hasContent(resourcePath)) return map;
  try {
    const parsed = typeof resourcePath === 'string' ? JSON.parse(resourcePath) : resourcePath;
    if (parsed.image) map.image = cleanRelativePath(parsed.image);
    if (parsed.svg) map.svg = cleanRelativePath(parsed.svg);
  } catch {
    return map;
  }
  return map;
}

async function saveBrowserD2c({ outDir, selection, codeResult }) {
  const targetDir = outDir ? resolve(outDir) : process.cwd();
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

  const codeType = detectBrowserCodeType(codeResult);
  const suggestedName = codeResult.fileName || selection?.id || 'index';
  const fileName = ensureOutputExtension(sanitizeOutputName(suggestedName), codeType);
  const codePath = resolve(targetDir, fileName);
  writeFileSync(codePath, String(codeResult.code || ''), 'utf8');

  const staticDir = resolve(targetDir, 'static');
  if (!existsSync(staticDir)) mkdirSync(staticDir, { recursive: true });

  let staticCount = 0;
  for (const item of Array.isArray(codeResult.statics) ? codeResult.statics : []) {
    const candidateName = item.path ? item.path.split('/').pop() : item.componentName || `static_${staticCount + 1}.svg`;
    const staticPath = resolve(staticDir, sanitizeOutputName(candidateName));
    writeFileSync(staticPath, String(item.content || ''), 'utf8');
    staticCount += 1;
  }

  return {
    targetDir,
    codeFileName: fileName,
    codePath,
    codeType,
    staticDir,
    staticCount,
  };
}

async function writeResource(resData, targetDir, folderName, ext) {
  if (!hasContent(resData)) return { savedCount: 0, attemptedCount: 0, errorCount: 0 };
  let parsed;
  try {
    parsed = typeof resData === 'string' ? JSON.parse(resData) : resData;
  } catch {
    return { savedCount: 0, attemptedCount: 0, errorCount: 1 };
  }
  if (!parsed || typeof parsed !== 'object') return { savedCount: 0, attemptedCount: 0, errorCount: 1 };

  const keys = Object.keys(parsed);
  ensureDir(resolve(targetDir, folderName));
  let savedCount = 0;
  let errorCount = 0;

  await Promise.all(Object.entries(parsed).map(async ([key, value]) => {
    const match = String(key).match(/(.+)\.([a-zA-Z0-9]+)$/);
    const safeKey = (match ? match[1] : key).replace(/[^a-zA-Z0-9_-]/g, '_');
    const finalExt = match ? match[2] : ext;
    const filePath = resolve(targetDir, folderName, `${safeKey}.${finalExt}`);
    try {
      if (typeof value === 'string' && value.startsWith('http')) {
        const buffer = await fetchBinaryWithFallback(value);
        await writeFile(filePath, buffer);
        savedCount += 1;
        return;
      }
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        const parts = value.split(';base64,');
        if (parts.length === 2) {
          await writeFile(filePath, parts[1], 'base64');
          savedCount += 1;
        }
        return;
      }
      const dataToWrite = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '');
      const encoding = ['png', 'jpg', 'jpeg'].includes(finalExt) ? 'base64' : 'utf8';
      await writeFile(filePath, dataToWrite, encoding);
      savedCount += 1;
    } catch {
      errorCount += 1;
    }
  }));

  return { savedCount, attemptedCount: keys.length, errorCount };
}

async function fetchBinaryWithFallback(url) {
  try {
    return await fetchBinary(url);
  } catch (error) {
    const message = String(error?.message ?? '');
    const isWrongSsl = message.includes('EPROTO') || message.includes('wrong version number');
    if (isWrongSsl && url.startsWith('https://')) return fetchBinary(url.replace(/^https:\/\//, 'http://'));
    throw error;
  }
}

async function fetchBinary(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`资源下载失败: ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

function resolveD2cIds(options) {
  if (options['d2c-url']) {
    const match = String(options['d2c-url']).match(/mastergo:\/\/getd2c\/([^/?#]+)/i);
    if (!match) throw new Error('--d2c-url 必须是形如 mastergo://getd2c/<contentId> 的链接');
    const contentId = match[1];
    const firstSegment = contentId.split('-')[0];
    return { contentId, documentId: options['document-id'] || firstSegment };
  }
  const contentId = requireOption(options, 'content-id');
  const documentId = requireOption(options, 'document-id');
  return { contentId, documentId };
}

function pickFirstWithContent(values) {
  return values.find(hasContent);
}

function hasContent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function cleanRelativePath(value) {
  return String(value).replace(/^(\.\/|\/)/, '').replace(/\/+/g, '/').replace(/\/+$/, '');
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function walkLayer(layer, visitor) {
  visitor(layer);
  layer?.children?.forEach?.((child) => {
    walkLayer(child, visitor);
  });
}

function readReference(fileName) {
  return readFileSync(resolve(referencesDir, fileName), 'utf8');
}

function printJson(data) {
  const value = promoteAgentFirstFields(data);
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

function printData(data, format) {
  console.log(formatOutput(promoteAgentFirstFields(data), format));
}

function withProcessedListSummary(data, items) {
  const list = normalizeListItems(items);
  return promoteAgentFirstFields({
    summary: summarizeList(list, buildListSummaryOptions(data, list)),
    ...data,
    meta: { ...(isPlainObject(data.meta) ? data.meta : {}), processed: true },
  });
}

function buildListSummaryOptions(data, items) {
  if (Array.isArray(data?.result?.sections) || Array.isArray(items)) {
    return { sortKey: 'name', topN: 3, groupKey: 'type' };
  }
  if (Array.isArray(data?.result?.svgs) || Array.isArray(data?.result)) {
    return { sortKey: 'name', topN: 3 };
  }
  if (isPlainObject(data?.result?.texts) || isPlainObject(data?.result)) {
    return { sortKey: 'name', topN: 3 };
  }
  return { sortKey: 'name', topN: 3 };
}

function normalizeListItems(value) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value?.sections)) return Object.values(value.sections);
  if (Array.isArray(value?.sections)) return value.sections;
  if (Array.isArray(value?.svgs)) return value.svgs;
  if (isPlainObject(value?.svgs)) return Object.entries(value.svgs).map(([id, item]) => ({ id, ...(isPlainObject(item) ? item : { value: item }) }));
  if (Array.isArray(value?.texts)) return value.texts;
  if (isPlainObject(value?.texts)) return Object.entries(value.texts).map(([id, item]) => ({ id, ...(isPlainObject(item) ? item : { value: item }) }));
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.list)) return value.list;
  return isPlainObject(value) ? Object.values(value) : [];
}

const FORMAT_VALUES = new Set(['json', 'yaml', 'tree']);

function normalizeFormat(format) {
  if (typeof format !== 'string') return null;
  const value = format.trim().toLowerCase();
  return FORMAT_VALUES.has(value) ? value : null;
}

function resolveFormat(format) {
  return normalizeFormat(format) || normalizeFormat(process.env.DEFAULT_FORMAT) || 'json';
}

function formatOutput(data, format) {
  const resolved = resolveFormat(format);
  if (resolved === 'yaml') return toYaml(data);
  if (resolved === 'tree') return toTree(data);
  return JSON.stringify(data);
}

function toYaml(data) {
  return renderYaml(data, 0);
}

function renderYaml(value, depth) {
  const pad = '  '.repeat(depth);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (isPlainObject(item) || Array.isArray(item)) {
          return `${pad}-\n${indent(renderYaml(item, depth + 1), depth + 1)}`;
        }
        return `${pad}- ${renderYaml(item, 0)}`;
      })
      .join('\n');
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, entryValue]) => {
        if (isPlainObject(entryValue) || Array.isArray(entryValue)) {
          return `${pad}${key}:\n${indent(renderYaml(entryValue, depth + 1), depth + 1)}`;
        }
        return `${pad}${key}: ${renderYaml(entryValue, 0)}`;
      })
      .join('\n');
  }
  return JSON.stringify(value);
}

function indent(text, depth) {
  const pad = '  '.repeat(depth);
  return String(text)
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toTree(data) {
  if (!isPlainObject(data)) return JSON.stringify(data);
  if (isPlainObject(data.dsl) && Array.isArray(data.dsl.nodes)) return wrappedDslToTree(data);
  if (Array.isArray(data.nodes)) return renderDslBody(data, []).join('\n');
  if (Array.isArray(data.sections)) return sectionListToTree(data);
  if (Array.isArray(data.svgs)) return svgListToTree(data);
  if (isPlainObject(data.svgs) || isPlainObject(data.texts)) return kvMapToTree(data);
  return JSON.stringify(data);
}

function wrappedDslToTree(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'dsl') continue;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  renderDslBody(obj.dsl, lines);
  return lines.join('\n');
}

function renderDslBody(dsl, lines) {
  lines.push('globalVars:');
  if (isPlainObject(dsl.styles)) {
    for (const [key, value] of Object.entries(dsl.styles)) {
      lines.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }
  if (dsl.components !== undefined) {
    lines.push(`components: ${JSON.stringify(dsl.components)}`);
  }
  for (const [key, value] of Object.entries(dsl)) {
    if (key === 'styles' || key === 'nodes' || key === 'components') continue;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push('tree:');
  for (const node of dsl.nodes || []) {
    renderNode(node, 1, lines);
  }
  return lines;
}

function sectionListToTree(obj) {
  const lines = [];
  const sections = Array.isArray(obj.sections) ? obj.sections : [];
  const reservedKeys = new Set(['type', 'id', 'name', 'nodeCount', 'x', 'y', 'width', 'height', 'layoutStyle']);
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'sections') continue;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push('sections:');
  sections.forEach((section, index) => {
    const ls = section.layoutStyle || {};
    const width = section.width ?? ls.width;
    const height = section.height ?? ls.height;
    const x = section.x ?? ls.relativeX;
    const y = section.y ?? ls.relativeY;
    const extras = [];
    pushIf(extras, 'nodeCount', section.nodeCount);
    lines.push(`  [${index}] ${section.type || '?'} ${section.id || '?'} ${quote(section.name)} ${fmtNum(width)}x${fmtNum(height)} @${fmtNum(x)},${fmtNum(y)}${extras.length ? ` ${extras.join(' ')}` : ''}`);
    for (const [key, value] of Object.entries(section)) {
      if (reservedKeys.has(key) || value === undefined) continue;
      lines.push(`    ${key}=${JSON.stringify(value)}`);
    }
  });
  return lines.join('\n');
}

function svgListToTree(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'svgs') continue;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  const svgs = Array.isArray(obj.svgs) ? obj.svgs : [];
  if (svgs.length === 0) {
    lines.push('svgs: []');
    return lines.join('\n');
  }
  lines.push('svgs:');
  svgs.forEach((entry, index) => {
    lines.push(`  [${index}] ${quote(entry.name)} (${entry.id || '?'})`);
    const svg = entry.svg;
    if (typeof svg === 'string' && !svg.includes('\n')) {
      lines.push(`    ${svg}`);
    } else if (typeof svg === 'string') {
      for (const line of svg.split('\n')) lines.push(`    ${line}`);
    } else {
      lines.push(`    ${JSON.stringify(svg)}`);
    }
  });
  return lines.join('\n');
}

function kvMapToTree(obj) {
  const lines = [];
  const mapKey = isPlainObject(obj.svgs) ? 'svgs' : isPlainObject(obj.texts) ? 'texts' : null;
  for (const [key, value] of Object.entries(obj)) {
    if (key === mapKey) continue;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  if (mapKey) {
    const map = obj[mapKey];
    const entries = Object.entries(map);
    if (entries.length === 0) {
      lines.push(`${mapKey}: {}`);
    } else {
      lines.push(`${mapKey}:`);
      for (const [key, value] of entries) renderKvEntry(key, value, '  ', lines);
    }
  }
  return lines.join('\n');
}

function renderKvEntry(key, value, pad, lines) {
  if (typeof value === 'string' && !value.includes('\n')) {
    lines.push(`${pad}${key}: ${value}`);
    return;
  }
  lines.push(`${pad}${key}:`);
  const valuePad = `${pad}  `;
  if (typeof value === 'string') {
    for (const line of value.split('\n')) lines.push(`${valuePad}${line}`);
  } else {
    lines.push(`${valuePad}${JSON.stringify(value)}`);
  }
}

function renderNode(node, depth, lines) {
  const pad = '  '.repeat(depth);
  const layoutStyle = node.layoutStyle || {};
  const reservedLayoutKeys = new Set(['width', 'height', 'relativeX', 'relativeY']);
  const reservedNodeKeys = new Set(['type', 'id', 'name', 'layoutStyle', 'fill', 'strokeColor', 'strokeType', 'strokeAlign', 'strokeWidth', 'componentId', 'componentInfo', 'flexContainerInfo', 'text', 'textColor', 'children']);
  const extras = [];
  for (const [key, value] of Object.entries(layoutStyle)) {
    if (reservedLayoutKeys.has(key) || value === undefined || value === null) continue;
    extras.push(`${key}=${value}`);
  }
  pushIf(extras, 'fill', node.fill);
  if (node.strokeColor) {
    extras.push(`stroke=${node.strokeColor}${node.strokeWidth ? `/${node.strokeWidth}` : ''}`);
  } else if (node.strokeWidth) {
    pushIf(extras, 'strokeWidth', node.strokeWidth);
  }
  pushIf(extras, 'strokeType', node.strokeType);
  pushIf(extras, 'strokeAlign', node.strokeAlign);
  pushIf(extras, 'component', node.componentId);
  lines.push(`${pad}${node.type || '?'} ${node.id || '?'} ${quote(node.name)} ${fmtNum(layoutStyle.width)}x${fmtNum(layoutStyle.height)} @${fmtNum(layoutStyle.relativeX)},${fmtNum(layoutStyle.relativeY)}${extras.length ? ` ${extras.join(' ')}` : ''}`);

  const componentInfo = node.componentInfo;
  if (isPlainObject(componentInfo)) {
    const properties = componentInfo.properties;
    if (isPlainObject(properties)) {
      for (const [key, value] of Object.entries(properties)) {
        lines.push(`${pad}  prop ${key}=${JSON.stringify(value)}`);
      }
    }
    for (const [key, value] of Object.entries(componentInfo)) {
      if (key === 'properties' || value === undefined) continue;
      lines.push(`${pad}  ${key}=${JSON.stringify(value)}`);
    }
  }

  if (node.flexContainerInfo !== undefined) {
    lines.push(`${pad}  flex ${JSON.stringify(node.flexContainerInfo)}`);
  }

  if (Array.isArray(node.text)) {
    for (const textNode of node.text) {
      const raw = textNode?.text;
      const content = typeof raw === 'string' ? raw : JSON.stringify(raw);
      lines.push(`${pad}  text ${quote(content)}${textNode?.font ? ` font=${textNode.font}` : ''}`);
    }
  }

  if (node.textColor !== undefined) {
    lines.push(`${pad}  textColor ${JSON.stringify(node.textColor)}`);
  }

  for (const [key, value] of Object.entries(node)) {
    if (reservedNodeKeys.has(key) || value === undefined) continue;
    lines.push(`${pad}  ${key}=${JSON.stringify(value)}`);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) renderNode(child, depth + 1, lines);
  }
}

function parseHeaderMap(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const headers = {};
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const separatorIndex = item.indexOf(':');
    if (separatorIndex <= 0) continue;
    const key = item.slice(0, separatorIndex).trim();
    const headerValue = item.slice(separatorIndex + 1).trim();
    if (!key) continue;
    headers[key] = headerValue;
  }
  return headers;
}

function pushIf(arr, label, value) {
  if (value !== undefined && value !== null && value !== '') arr.push(`${label}=${value}`);
}

function fmtNum(value) {
  return value === undefined || value === null ? '?' : String(value);
}

function quote(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function installSkill(args, kind) {
  const { options } = parseFlags(args);
  const source = options['skill-source'] || 'git';
  if (source !== 'git' && source !== 'npm') throw new Error('--skill-source 只支持 git 或 npm');
  const skillOnly = parseFlagTrue(options['skill-only']);
  const cliOnly = parseFlagTrue(options['cli-only']);

  if (!skillOnly) {
    if (kind === 'update') {
      await run('npm', ['install', '-g', `${packageName}@latest`]);
    } else {
      await run('npm', ['install', '-g', packageName]);
    }
  }

  if (!cliOnly) {
    const target = options['skill-local-path']
      ? resolve(options['skill-local-path'])
      : source === 'npm' ? rootDir : gitSkillSource;
    await run('npx', ['-y', 'skills', 'add', '-g', target]);
  }
}

async function uninstallSkill(args) {
  const { options } = parseFlags(args);
  const skillOnly = parseFlagTrue(options['skill-only']);
  const cliOnly = parseFlagTrue(options['cli-only']);
  if (!parseConfirm(options.confirm)) {
    printJson({
      ok: false,
      preview: true,
      reason: '卸载是破坏性操作，未传 --confirm=true；如要执行 uninstall，请显式确认。',
      action: 'uninstall',
      payload: { skillOnly, cliOnly },
    });
    return;
  }

  if (!skillOnly) {
    await run('npx', ['-y', 'skills', 'remove', 'mastergo-cli', '--yes']);
  }
  if (!cliOnly) {
    await run('npm', ['uninstall', '-g', packageName]);
  }
}

function parseFlagTrue(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

async function runPython(scriptPath, args) {
  try {
    await run('python3', [scriptPath, ...args]);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      await run('python', [scriptPath, ...args]);
      return;
    }
    throw error;
  }
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${command} ${args.join(' ')} 执行失败，退出码 ${String(code)}`));
    });
  });
}

// 仅在作为 CLI 主入口运行时执行 main()；被测试文件 import 时不会触发 CLI 启动。
const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}

// 导出供单测使用的纯函数；不影响 CLI 运行。
export {
  parseFlags,
  extractIdsFromUrl,
  simplifyDsl,
  simplifyDslNode,
  simplifyDslNodes,
  isIconLikeNode,
  normalizeFileId,
  cloneJson,
  formatOutput,
  detectBrowserCodeType,
  sanitizeOutputName,
  ensureOutputExtension,
};
