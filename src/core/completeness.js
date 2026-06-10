// ===== 线索完整度计算 =====
// 统计 9 个关键字段的填充比例，返回 0–100 的整数百分比。纯函数，可单测。

const COMPLETENESS_KEYS = ['name', 'company', 'industry', 'track', 'contact', 'phone', 'source', 'level', 'budget'];

/**
 * @param {Record<string, any>} l 线索对象
 * @returns {number} 0–100 的完整度百分比
 */
export function embLeadCompleteness(l) {
  const filled = COMPLETENESS_KEYS.filter((k) => l[k] && String(l[k]).trim() && l[k] !== '—').length;
  return Math.round(filled / COMPLETENESS_KEYS.length * 100);
}
