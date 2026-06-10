import { describe, it, expect } from 'vitest';
import { suggestLevel } from '../src/core/suggestLevel.js';

describe('suggestLevel · 按预算+关键词判级', () => {
  it('≥5000万 且 战略关键词 → S', () => {
    expect(suggestLevel('30000万', '战略支柱客户')).toBe('S — 战略级');
    expect(suggestLevel('8000万', '行业头部')).toBe('S — 战略级');
  });
  it('≥5000万 无战略关键词 → A', () => {
    expect(suggestLevel('6000万', '普通项目')).toBe('A — 重点');
  });
  it('1000–5000万 → A', () => {
    expect(suggestLevel('1200万', '')).toBe('A — 重点');
    expect(suggestLevel('4999万', '')).toBe('A — 重点');
  });
  it('100–1000万 → B', () => {
    expect(suggestLevel('600万', '')).toBe('B — 跟进');
    expect(suggestLevel('100万', '')).toBe('B — 跟进');
  });
  it('<100万 → C', () => {
    expect(suggestLevel('50万', '')).toBe('C — 普通');
  });
  it('亿元单位换算正确', () => {
    expect(suggestLevel('3亿元', '重点客户')).toBe('A — 重点');
    expect(suggestLevel('1亿', '战略支柱')).toBe('S — 战略级');
  });
  it('预算档未命中但命中战略关键词 → S（兜底）', () => {
    expect(suggestLevel('80万', '战略支柱客户')).toBe('S — 战略级');
  });
  it('预算档未命中且命中重点关键词 → A（兜底）', () => {
    expect(suggestLevel('80万', '重要客户')).toBe('A — 重点');
  });
  it('空/非法预算返回 null', () => {
    expect(suggestLevel('', 'x')).toBeNull();
    expect(suggestLevel('面议', 'x')).toBeNull();
    expect(suggestLevel(undefined, 'x')).toBeNull();
  });
});
