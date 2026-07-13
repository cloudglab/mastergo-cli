import test from 'node:test';
import assert from 'node:assert/strict';
import { formatOutput } from '../bin/mastergo.js';

test('formatOutput: 默认输出 compact json', () => {
  const out = formatOutput({ a: 1 });
  assert.equal(out, '{"a":1}');
});

test('formatOutput: yaml 模式输出键值', () => {
  const out = formatOutput({ a: 1, b: 'x' }, 'yaml');
  assert.match(out, /a: 1/);
  assert.match(out, /b: "x"/);
});

test('formatOutput: tree 模式支持 wrapped dsl', () => {
  const out = formatOutput({
    dsl: {
      styles: { s1: { color: '#fff' } },
      nodes: [{ id: '1:1', type: 'FRAME', name: 'Page', layoutStyle: { width: 100, height: 200, relativeX: 0, relativeY: 0 } }],
    },
    rules: ['r1'],
  }, 'tree');
  assert.match(out, /globalVars:/);
  assert.match(out, /tree:/);
  assert.match(out, /FRAME 1:1 "Page" 100x200 @0,0/);
});

test('formatOutput: tree 模式支持 section list', () => {
  const out = formatOutput({
    totalSections: 1,
    sections: [{ id: 's1', type: 'FRAME', name: 'Section', x: 0, y: 10, width: 20, height: 30, nodeCount: 5 }],
  }, 'tree');
  assert.match(out, /sections:/);
  assert.match(out, /\[0\] FRAME s1 "Section" 20x30 @0,10 nodeCount=5/);
});

test('formatOutput: 非法 format 回退 json', () => {
  const out = formatOutput({ a: 1 }, 'invalid');
  assert.equal(out, '{"a":1}');
});
