import { describe, it, expect } from 'vitest';
import { embLeadCompleteness } from '../src/core/completeness.js';

describe('embLeadCompleteness · 完整度百分比', () => {
  const full = { name: '某线索', company: '某公司', industry: '电力', track: '物探', contact: '林志远', phone: '13800000001', source: '销售自拓', level: 'A', budget: '3亿元' };

  it('9 项全填 → 100%', () => {
    expect(embLeadCompleteness(full)).toBe(100);
  });
  it('空对象 → 0%', () => {
    expect(embLeadCompleteness({})).toBe(0);
  });
  it('占位符「—」不计入', () => {
    expect(embLeadCompleteness({ name: '某线索', company: '—', industry: '—' })).toBe(11); // 1/9
  });
  it('5/9 → 56%（四舍五入）', () => {
    expect(embLeadCompleteness({ name: 'a', company: 'b', industry: 'c', track: 'd', contact: 'e' })).toBe(56);
  });
  it('空白字符串不计入', () => {
    expect(embLeadCompleteness({ name: '   ', company: 'b' })).toBe(11); // 仅 company 计入
  });
});
