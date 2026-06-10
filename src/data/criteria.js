// ===== 线索级别判定标准（采用 S/A/B/C，与真实系统对齐） =====

export const LEVEL_CRITERIA = {
  'S — 战略级': { desc: '预算 ≥5000万 且 行业头部 / 战略支柱客户', color: 'var(--lav)', bg: 'var(--lav-lt)', fg: 'var(--lav-dk)' },
  'A — 重点': { desc: '预算 1000–5000万 或 重要客户', color: 'var(--slate)', bg: 'var(--slate-lt)', fg: 'var(--slate-dk)' },
  'B — 跟进': { desc: '预算 100–1000万 或 有明确采购意向', color: 'var(--sand)', bg: 'var(--sand-lt)', fg: 'var(--sand-dk)' },
  'C — 普通': { desc: '预算 <100万 或 资格未充分确认', color: 'var(--ink3)', bg: 'var(--bg)', fg: 'var(--ink2)' },
};

/* 「线索分级标准」全屏说明用的完整文案 */
export const FULL_LEVEL_CRITERIA = [
  { lvl: 'S', name: 'S 级 · 战略级客户', desc: '预算 ≥5000万 <strong>且</strong> 行业头部 / 战略支柱客户。投入最高级销售资源，由销售总监亲自跟进，目标：建立长期战略合作。' },
  { lvl: 'A', name: 'A 级 · 重点客户', desc: '预算 1000–5000万 <strong>或</strong> 重要客户。投入资深销售资源，重点攻坚，定制化方案。' },
  { lvl: 'B', name: 'B 级 · 跟进客户', desc: '预算 100–1000万 <strong>或</strong> 有明确采购意向。常规销售跟进，标准化方案。' },
  { lvl: 'C', name: 'C 级 · 普通客户', desc: '预算 <100万 <strong>或</strong> 资格未充分确认（预算/时间/决策人不明）。批量化运营，初次接触阶段。' },
];
