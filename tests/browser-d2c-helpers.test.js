import test from 'node:test';
import assert from 'node:assert/strict';
import { detectBrowserCodeType, sanitizeOutputName, ensureOutputExtension } from '../bin/mastergo.js';

test('detectBrowserCodeType: 根据 type 判断 vue', () => {
  assert.equal(detectBrowserCodeType({ type: 'vue', fileName: 'index.html', code: '' }), 'vue');
});

test('detectBrowserCodeType: 根据 fileName 判断 vue', () => {
  assert.equal(detectBrowserCodeType({ type: '', fileName: 'layout.vue', code: '' }), 'vue');
});

test('detectBrowserCodeType: 根据代码内容判断 vue', () => {
  assert.equal(detectBrowserCodeType({ type: '', fileName: 'layout', code: '<template><div /></template>' }), 'vue');
});

test('detectBrowserCodeType: 默认 html', () => {
  assert.equal(detectBrowserCodeType({ type: '', fileName: 'index', code: '<div></div>' }), 'html');
});

test('sanitizeOutputName: 清理路径和非法字符', () => {
  assert.equal(sanitizeOutputName('../a/b:c.vue'), 'a_b_c.vue');
});

test('ensureOutputExtension: 无后缀时补 vue', () => {
  assert.equal(ensureOutputExtension('layout', 'vue'), 'layout.vue');
});

test('ensureOutputExtension: 已有后缀时保持不变', () => {
  assert.equal(ensureOutputExtension('layout.vue', 'html'), 'layout.vue');
});
