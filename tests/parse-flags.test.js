import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags } from '../bin/mastergo.js';

test('parseFlags: 把 --key value 解析成 options', () => {
  const { options, positionals } = parseFlags(['--file', 'a.html', '--token', 'tk']);
  assert.equal(options.file, 'a.html');
  assert.equal(options.token, 'tk');
  assert.deepEqual(positionals, []);
});

test('parseFlags: 把 --key=value 解析成 inline value', () => {
  const { options } = parseFlags(['--file=a.html', '--layer-id=1:23']);
  assert.equal(options.file, 'a.html');
  assert.equal(options['layer-id'], '1:23');
});

test('parseFlags: 收集 positionals', () => {
  const { positionals } = parseFlags(['https://mastergo.com/goto/abc', '--token', 'tk']);
  assert.deepEqual(positionals, ['https://mastergo.com/goto/abc']);
});

test('parseFlags: --no-rule / --simplify 是 boolean flag', () => {
  const { options } = parseFlags(['--no-rule', '--simplify']);
  assert.equal(options['no-rule'], true);
  assert.equal(options.simplify, true);
});

test('parseFlags: --confirm 接受 =true 形式', () => {
  const { options } = parseFlags(['--confirm=true']);
  assert.equal(options.confirm, 'true');
});

test('parseFlags: --confirm 接受下一个参数作为值', () => {
  const { options } = parseFlags(['--confirm', 'true']);
  assert.equal(options.confirm, 'true');
});

test('parseFlags: 同一 key 重复时退化为数组', () => {
  const { options } = parseFlags(['--rule', 'r1', '--rule', 'r2']);
  assert.deepEqual(options.rule, ['r1', 'r2']);
});

test('parseFlags: 同一 key 用 = 与分隔混合时也是数组', () => {
  const { options } = parseFlags(['--rule=r1', '--rule', 'r2']);
  assert.deepEqual(options.rule, ['r1', 'r2']);
});

test('parseFlags: 解析 --format=value', () => {
  const { options } = parseFlags(['--format=tree']);
  assert.equal(options.format, 'tree');
});

test('parseFlags: 解析 --header value', () => {
  const { options } = parseFlags(['--header', 'x-tenant-id: demo']);
  assert.equal(options.header, 'x-tenant-id: demo');
});

test('parseFlags: 重复 --header 时收集为数组', () => {
  const { options } = parseFlags(['--header', 'x-a: 1', '--header=x-b: 2']);
  assert.deepEqual(options.header, ['x-a: 1', 'x-b: 2']);
});

test('parseFlags: 空 args 返回空对象和数组', () => {
  const { options, positionals } = parseFlags([]);
  assert.deepEqual(options, {});
  assert.deepEqual(positionals, []);
});

test('parseFlags: 不以 -- 开头的 token 视为 positional', () => {
  const { positionals, options } = parseFlags(['positional1', 'positional2', '--flag', 'val']);
  assert.deepEqual(positionals, ['positional1', 'positional2']);
  assert.equal(options.flag, 'val');
});
