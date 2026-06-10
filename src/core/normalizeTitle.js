// ===== 职位描述归一化 =====
// 把抽取到的原始职位（可能只是个单薄的「总」）结合联系人前文的部门词，
// 组合成更友好的完整职位，如「采购总监」「项目负责人」。纯函数，可单测。

/**
 * @param {string} rawTitle     抽取到的原始职位词
 * @param {string} text         原始描述全文
 * @param {number} contactStart 联系人姓名在 text 中的起始下标
 * @returns {string}            归一化后的职位
 */
export function normalizeTitle(rawTitle, text, contactStart) {
  /* 检查联系人前面是否有部门/职能词 — 如果有，组合成"采购总监"这类 */
  /* contactStart 是联系人姓名的起始位置；姓名长度1-2 */
  /* 在 contactStart 前面再看 2-4 字看有没有"采购/销售/技术/财务/市场/运营/人事"等 */
  const before = text.slice(Math.max(0, contactStart - 6), contactStart);
  const deptMatch = before.match(/(采购|销售|技术|财务|市场|运营|人事|生产|供应链|信息|研发|项目)(总监|经理|主管|主任|总裁|副总|副总裁|总经理)?$/);
  if (deptMatch) {
    /* 完整职位 = 部门 + 职级（如果原始 title 有具体职级用原始，否则用部门匹配里的职级） */
    const dept = deptMatch[1];
    let rank = rawTitle;
    /* 如果 rawTitle 是"总"（太单薄），尝试推断 — 因为"采购总监王总" 模式 rawTitle 其实拿到的就是末尾的"总" */
    if (rawTitle === '总') {
      /* 检查 contactStart 前的"采购总监"完整匹配 */
      const fullMatch = before.match(/(采购|销售|技术|财务|市场|运营|人事|生产|供应链|信息|研发|项目)(总监|经理|主管|总裁|副总|副总裁|总经理|主任)$/);
      if (fullMatch) { return fullMatch[0]; }
      /* 退而求其次，用"部门 + 负责人" */
      return dept + '负责人';
    }
    return dept + rank;
  }
  /* 如果原始 title 是单独的"总"，太单薄，转为"部门负责人"或"项目负责人" */
  if (rawTitle === '总') {
    return '项目负责人';
  }
  return rawTitle;
}
