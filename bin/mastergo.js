#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageName = '@cloudglab/mastergo-cli';
const packageVersion = '0.1.0';
const gitSkillSource = 'cloudglab/mastergo-cli';
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = resolve(rootDir, 'skills', 'mastergo-cli');
const scriptsDir = resolve(skillDir, 'scripts');
const referencesDir = resolve(skillDir, 'references');

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
    await installSkill(args);
    return;
  }

  if (command === 'dsl' || command === 'get-dsl') return getDsl(args);
  if (command === 'd2c') return getD2c(args);
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
  mastergo dsl|get-dsl <mastergo-url|fileId layerId> [--source-layer-id ID] [--rule RULE] [--no-rule]
  mastergo d2c (--d2c-url mastergo://getd2c/<contentId> | --content-id ID --document-id ID) [--out-dir DIR]
  mastergo c2d --file HTML (--short-link URL | --file-id ID [--layer-id ID])
  mastergo meta --file-id ID --layer-id ID [--source-layer-id ID]
  mastergo component-doc <url>
  mastergo component-workflow --root PATH --file-id ID --layer-id ID [--source-layer-id ID]
  mastergo fetch-docs <url...>
  mastergo install [--skill-source git|npm] [--skill-local-path <path>]
  mastergo update [--skill-source git|npm] [--skill-local-path <path>]
  mastergo version

Environment:
  MASTERGO_TOKEN / MASTERGO_API_TOKEN / MG_MCP_TOKEN     API token
  MASTERGO_ENDPOINT / API_BASE_URL                      API base URL
  RULES                                                 JSON array of extra DSL rules`);
}

async function getDsl(args) {
  const { options, positionals } = parseFlags(args);
  const ids = await resolveDesignIds({ options, positionals, requireLayerId: true });
  const response = await requestJson('/mcp/dsl', {
    fileId: normalizeFileId(ids.fileId),
    layerId: ids.layerId,
    sourceLayerId: ids.sourceLayerId,
  }, options);
  printJson({
    dsl: response,
    componentDocumentLinks: extractComponentDocumentLinks(response),
    rules: options['no-rule'] ? [] : buildDslRules(options),
  });
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

async function postC2d(args) {
  const { options, positionals } = parseFlags(args);
  const filePath = resolve(requireOption(options, 'file'));
  const ids = await resolveDesignIds({ options, positionals, requireLayerId: false });
  if (!ids.fileId) throw new Error('请传 --short-link，或至少传 --file-id（--layer-id 可选）');
  const data = readFileSync(filePath, 'utf8');
  const result = await requestJson('/mcp/c2d', {}, options, 'POST', {
    data,
    fileId: normalizeFileId(ids.fileId),
    layerId: ids.layerId || undefined,
  });
  printJson(result);
}

async function getMeta(args) {
  const { options } = parseFlags(args);
  const result = await requestJson('/mcp/meta', {
    fileId: normalizeFileId(requireOption(options, 'file-id')),
    layerId: requireOption(options, 'layer-id'),
    sourceLayerId: options['source-layer-id'],
  }, options);
  printJson({ result, rules: readReference('meta.md') });
}

async function getComponentDoc(args) {
  const { positionals } = parseFlags(args);
  const [url] = positionals;
  if (!url) throw new Error('component-doc 需要传入文档 URL');
  const response = await fetch(url, { headers: authHeaders({}, false) });
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
    const id = String(layer.id || 'layer').replaceAll('/', '&');
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

async function requestJson(path, params, options, method = 'GET', body) {
  const url = new URL(path, getBaseUrl(options));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      method,
      headers: authHeaders(options),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      const hint = path === '/mcp/d2c/events' && response.status === 404
        ? '提示：D2C contentId 是 D2C 任务运行 ID（形如 mastergo://getd2c/<contentId>），不是 fileId-layerId；请用 --d2c-url 或提供真实 contentId。'
        : '';
      throw new Error(hint ? `${text}\n${hint}` : (text || `请求失败: ${response.status} ${response.statusText}`));
    }
    try { return JSON.parse(text); } catch { return text; }
  } finally {
    clearTimeout(timeout);
  }
}

function authHeaders(options, requireToken = true) {
  const token = options.token || process.env.MASTERGO_TOKEN || process.env.MASTERGO_API_TOKEN || process.env.MG_MCP_TOKEN;
  if (requireToken && !token) throw new Error('缺少 token：请传 --token 或设置 MASTERGO_TOKEN');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { 'X-MG-UserAccessToken': token } : {}),
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
    if (key === 'no-rule') {
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
    return extractIdsFromUrl(shortLink, { requireLayerId });
  }

  const maybeUrl = positionals.find((value) => /^https?:\/\//.test(value));
  if (maybeUrl) {
    return extractIdsFromUrl(maybeUrl, { requireLayerId });
  }

  const fileId = options['file-id'] || options.fileId || positionals[0];
  const layerId = options['layer-id'] || options.layerId || positionals[1];
  const sourceLayerId = options['source-layer-id'] || options.sourceLayerId;
  if (requireLayerId && (!fileId || !layerId)) {
    throw new Error('请传 MasterGo URL，或同时传 fileId 和 layerId');
  }
  return { fileId, layerId, sourceLayerId };
}

async function extractIdsFromUrl(inputUrl, { requireLayerId }) {
  let targetUrl = inputUrl;
  if (inputUrl.includes('/goto/')) {
    const response = await fetch(inputUrl, { redirect: 'manual' });
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

function buildDslRules(options) {
  const envRules = parseJsonArray(process.env.RULES, 'RULES');
  const cliRules = Array.isArray(options.rule) ? options.rule : options.rule ? [options.rule] : [];
  return [
    'token filed must be generated as a variable (colors, shadows, fonts, etc.) and the token field must be displayed in the comment',
    `componentDocumentLinks is a list of frontend component documentation links used in the DSL layer, designed to help you understand how to use the components.\nWhen it exists and is not empty, you need to use mastergo component-doc in a for loop to get the URL content of all components in the list, understand how to use the components, and generate code using the components.`,
    ...envRules,
    ...cliRules,
  ];
}

function parseJsonArray(value, name) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error(`${name} 必须是 JSON 数组`);
  return parsed.map(String);
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
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

async function installSkill(args) {
  const { options } = parseFlags(args);
  const source = options['skill-source'] || 'git';
  if (source !== 'git' && source !== 'npm') throw new Error('--skill-source 只支持 git 或 npm');
  const target = options['skill-local-path'] ? resolve(options['skill-local-path']) : source === 'npm' ? rootDir : gitSkillSource;
  await run('npx', ['-y', 'skills', 'add', '-g', target]);
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

main(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
