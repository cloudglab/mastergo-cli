import test from 'node:test';
import assert from 'node:assert/strict';
import { extractIdsFromUrl, normalizeFileId } from '../bin/mastergo.js';

// 注意：extractIdsFromUrl 会对 /goto/ 短链发起网络请求做手动重定向解析。
// 这里只测不需要网络跳转的 file 链接 + search param 解析逻辑。

test('extractIdsFromUrl: 从 file 路径提取 fileId', async () => {
  const url = 'https://mastergo.com/file/176452330285910?layer_id=1:23&source_layer_id=2:34';
  const ids = await extractIdsFromUrl(url, { requireLayerId: false });
  assert.equal(ids.fileId, '176452330285910');
  assert.equal(ids.layerId, '1:23');
  assert.equal(ids.sourceLayerId, '2:34');
});

test('extractIdsFromUrl: requireLayerId=true 且无 layer_id 时抛错', async () => {
  const url = 'https://mastergo.com/file/176452330285910';
  await assert.rejects(
    () => extractIdsFromUrl(url, { requireLayerId: true }),
    /Could not extract layerId/,
  );
});

test('extractIdsFromUrl: 找不到纯数字 fileId 时抛错', async () => {
  const url = 'https://mastergo.com/file/?layer_id=1:23';
  await assert.rejects(
    () => extractIdsFromUrl(url, { requireLayerId: false }),
    /Could not extract fileId/,
  );
});

test('extractIdsFromUrl: layer_id 缺省时返回 undefined', async () => {
  const url = 'https://mastergo.com/file/176452330285910';
  const ids = await extractIdsFromUrl(url, { requireLayerId: false });
  assert.equal(ids.fileId, '176452330285910');
  assert.equal(ids.layerId, undefined);
  assert.equal(ids.sourceLayerId, undefined);
});

test('normalizeFileId: 去掉 file/ 前缀', () => {
  assert.equal(normalizeFileId('file/12345'), '12345');
  assert.equal(normalizeFileId('12345'), '12345');
  assert.equal(normalizeFileId(''), '');
  assert.equal(normalizeFileId(undefined), '');
});