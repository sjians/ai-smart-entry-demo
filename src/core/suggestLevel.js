// ===== 线索级别自动建议 =====
// 依据「项目预算」字符串 + 自由文本里的关键词（战略支柱 / 重点客户 等），
// 推断 S/A/B/C 级别。纯函数，无副作用，便于单元测试。

/**
 * @param {string} budgetStr 规范化后的预算文本，如 "30000万" / "3亿元"
 * @param {string} [text]    原始描述文本，用于关键词加权
 * @returns {string|null}    'S — 战略级' | 'A — 重点' | 'B — 跟进' | 'C — 普通'，无预算时返回 null
 */
export function suggestLevel(budgetStr, text) {
  if (!budgetStr) return null;
  const m = budgetStr.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  let num = parseFloat(m[1]);
  if (/亿/.test(budgetStr)) num = num * 10000;
  const isStrategic = /战略[级大]?客户|战略支柱|标杆[项目客户]?|旗舰|S\s*级|行业头部|龙头/.test(text || '');
  const isKey = /重点[项目客户]?|重要客户|A\s*级/.test(text || '');
  if (num >= 5000 && isStrategic) return 'S — 战略级';
  if (num >= 5000) return 'A — 重点';
  if (num >= 1000) return 'A — 重点';
  if (num >= 100) return 'B — 跟进';
  if (isStrategic) return 'S — 战略级';
  if (isKey) return 'A — 重点';
  return 'C — 普通';
}
