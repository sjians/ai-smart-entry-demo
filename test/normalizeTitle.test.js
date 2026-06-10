import { describe, it, expect } from 'vitest';
import { normalizeTitle } from '../src/core/normalizeTitle.js';

describe('normalizeTitle · 职位归一化', () => {
  it('部门+职级组合：采购总监', () => {
    // 采购总监王明 —— 王 在 index 4
    expect(normalizeTitle('总监', '采购总监王明', 4)).toBe('采购总监');
  });
  it('单薄的「总」+ 完整部门职级 → 补全', () => {
    // 市场总监李雷 —— 李 在 index 4
    expect(normalizeTitle('总', '市场总监李雷', 4)).toBe('市场总监');
  });
  it('单薄的「总」+ 仅部门无职级 → 部门负责人', () => {
    // 项目张三 —— 张 在 index 2
    expect(normalizeTitle('总', '项目张三', 2)).toBe('项目负责人');
  });
  it('单薄的「总」且前文无部门 → 项目负责人', () => {
    expect(normalizeTitle('总', '王总', 0)).toBe('项目负责人');
  });
  it('完整职位且前文无部门 → 原样返回', () => {
    expect(normalizeTitle('总监', '张三', 0)).toBe('总监');
  });
  it('部门+经理组合', () => {
    // 销售经理赵六 —— 赵 在 index 4
    expect(normalizeTitle('经理', '销售经理赵六', 4)).toBe('销售经理');
  });
});
