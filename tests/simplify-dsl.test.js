import test from 'node:test';
import assert from 'node:assert/strict';
import { simplifyDsl, isIconLikeNode } from '../bin/mastergo.js';

test('simplifyDsl: 给 DSL 添加 _simplified 与 _simplificationStats 标记', () => {
  const dsl = { nodes: [] };
  const out = simplifyDsl(dsl);
  assert.equal(out._simplified, true);
  assert.ok(out._simplificationStats);
  assert.equal(out._simplificationStats.iconPlaceholders, 0);
  assert.equal(out._simplificationStats.pathsRemoved, 0);
});

test('simplifyDsl: 不修改原始 dsl（深克隆）', () => {
  const dsl = { nodes: [{ id: 'a', type: 'PATH', path: ['M0 0'] }] };
  simplifyDsl(dsl);
  // 原始对象应当保留 path 字段
  assert.equal(dsl.nodes[0].type, 'PATH');
  assert.deepEqual(dsl.nodes[0].path, ['M0 0']);
});

test('simplifyDsl: PATH 节点被替换为 ICON_PLACEHOLDER', () => {
  const dsl = {
    nodes: [
      { id: 'p1', type: 'PATH', name: 'arrow', path: ['M0 0', 'L10 10'] },
      { id: 'r1', type: 'RECTANGLE', name: 'box' },
    ],
  };
  const out = simplifyDsl(dsl);
  assert.equal(out.nodes[0].type, 'ICON_PLACEHOLDER');
  assert.equal(out.nodes[0]._isSimplified, true);
  assert.equal(out.nodes[0]._originalType, 'PATH');
  // 第二个不是图标，应保持原样
  assert.equal(out.nodes[1].type, 'RECTANGLE');
  assert.equal(out._simplificationStats.iconPlaceholders, 1);
  assert.equal(out._simplificationStats.pathsRemoved, 2);
});

test('simplifyDsl: VECTOR / SVG_ELLIPSE / SVG_RECTANGLE 都被视为图标', () => {
  const dsl = {
    nodes: [
      { id: 'v1', type: 'VECTOR', path: ['M0 0'] },
      { id: 'e1', type: 'SVG_ELLIPSE', path: [] },
      { id: 'r1', type: 'SVG_RECTANGLE', path: [] },
    ],
  };
  const out = simplifyDsl(dsl);
  assert.equal(out.nodes[0].type, 'ICON_PLACEHOLDER');
  assert.equal(out.nodes[1].type, 'ICON_PLACEHOLDER');
  assert.equal(out.nodes[2].type, 'ICON_PLACEHOLDER');
  assert.equal(out._simplificationStats.iconPlaceholders, 3);
});

test('simplifyDsl: 名字含 ic-/icon/图标的节点也视为图标', () => {
  const dsl = {
    nodes: [
      { id: 'n1', type: 'FRAME', name: 'ic-search' },
      { id: 'n2', type: 'GROUP', name: 'icon-close' },
      { id: 'n3', type: 'GROUP', name: '关闭按钮' },
    ],
  };
  const out = simplifyDsl(dsl);
  assert.equal(out.nodes[0].type, 'ICON_PLACEHOLDER');
  assert.equal(out.nodes[1].type, 'ICON_PLACEHOLDER');
  // '关闭按钮' 含 '按钮' 但不含 icon 关键字，应保留
  // 实际关键字列表：ic-, ic_, ico_, icon, 图标
  // '关闭按钮' 不含 '图标'，应保留原 type
  assert.equal(out.nodes[2].type, 'GROUP');
});

test('simplifyDsl: 有子节点的容器不会因名字含 icon 关键词就被替换', () => {
  const dsl = {
    nodes: [
      { id: 'parent', type: 'GROUP', name: 'icon-group', children: [{ id: 'c1', type: 'TEXT', name: 'label' }] },
    ],
  };
  const out = simplifyDsl(dsl);
  assert.equal(out.nodes[0].type, 'GROUP');
});

test('simplifyDsl: 递归处理嵌套 children', () => {
  const dsl = {
    nodes: [
      {
        id: 'root',
        type: 'FRAME',
        name: 'root',
        children: [
          { id: 'p1', type: 'PATH', path: ['M0 0'] },
          { id: 'normal', type: 'TEXT', name: 'hi' },
        ],
      },
    ],
  };
  const out = simplifyDsl(dsl);
  assert.equal(out.nodes[0].children[0].type, 'ICON_PLACEHOLDER');
  assert.equal(out.nodes[0].children[1].type, 'TEXT');
  assert.equal(out._simplificationStats.iconPlaceholders, 1);
});

test('isIconLikeNode: 单元判定', () => {
  assert.equal(isIconLikeNode({ type: 'PATH', path: ['M0 0'] }), true);
  assert.equal(isIconLikeNode({ type: 'TEXT' }), false);
  assert.equal(isIconLikeNode({ type: 'GROUP', name: 'ic-x', children: [] }), true);
  assert.equal(isIconLikeNode({ type: 'GROUP', name: 'ic-x', children: [{ id: 'a' }] }), false);
});

test('simplifyDsl: 处理 root 字段', () => {
  const dsl = {
    nodes: [],
    root: { id: 'r', type: 'PATH', name: 'ic-go', path: ['M1 1'] },
  };
  const out = simplifyDsl(dsl);
  assert.equal(out.root.type, 'ICON_PLACEHOLDER');
  assert.equal(out._simplificationStats.iconPlaceholders, 1);
});