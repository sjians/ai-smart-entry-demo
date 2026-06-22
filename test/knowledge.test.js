// RAG 知识库：纯函数 + 失败兜底（关键词检索）。全程不触网（fetch 被打桩）。
import { describe, it, expect, beforeEach } from 'vitest';
import { cosineSim, tokenize, lexicalScore, chunkText, retrieve, _resetForTest } from '../src/agent/knowledge.js';

describe('RAG 纯函数', () => {
  it('cosineSim：同向=1，正交=0，长度不一致=0', () => {
    expect(cosineSim([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosineSim([1, 2, 3], [2, 4, 6])).toBeCloseTo(1); // 同向不同模
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSim([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSim([0, 0], [0, 0])).toBe(0);
  });

  it('tokenize：中文双字 + 拉丁词', () => {
    const t = tokenize('储能EDA平台');
    expect(t).toContain('eda');
    expect(t).toContain('储能');
    expect(t).toContain('平台');
  });

  it('lexicalScore：命中越多分越高，不相关≈0', () => {
    expect(lexicalScore('储能并网检测', '储能并网检测系统：用于新型储能电站')).toBeGreaterThan(0.4);
    expect(lexicalScore('储能并网检测', '智能风控平台：反欺诈与信用风控')).toBeLessThan(0.2);
    expect(lexicalScore('', '任意文本')).toBe(0);
  });

  it('chunkText：空串=[]，长文切多块且各块非空', () => {
    expect(chunkText('')).toEqual([]);
    const long = '这是第一句话。这是第二句话。这是第三句话。'.repeat(20);
    const cks = chunkText(long, 100, 20);
    expect(cks.length).toBeGreaterThan(1);
    cks.forEach((c) => { expect(c.trim().length).toBeGreaterThan(0); });
  });
});

describe('retrieve 关键词检索：真实问法命中正确片段', () => {
  beforeEach(() => { _resetForTest(); });

  it('储能并网检测 → 命中储能相关片段', async () => {
    const hits = await retrieve('客户要做储能并网检测', 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].how).toBe('lexical');
    expect(hits.some((h) => /储能/.test(h.title + h.text))).toBe(true);
  });

  it('折扣权限（口语问法）→ 命中报价折扣政策', async () => {
    const hits = await retrieve('我们给客户的折扣最多能到多少', 3);
    expect(hits.some((h) => h.id === 'pol-discount')).toBe(true);
  });

  it('视觉质检 → 命中视觉质检相关', async () => {
    const hits = await retrieve('汽车产线想上视觉质检', 3);
    expect(hits.some((h) => /视觉质检/.test(h.title + h.text))).toBe(true);
  });

  it('空查询 → 空结果', async () => {
    expect(await retrieve('   ', 3)).toEqual([]);
  });
});
