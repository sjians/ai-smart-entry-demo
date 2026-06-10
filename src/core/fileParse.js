// ===== 文件解析纯函数（无 DOM / 无第三方依赖，便于单元测试）=====
// 用于「真实上传」路径：批量表格的表头→字段映射、行状态判定、文件类型识别。

/* 取扩展名（小写、无点） */
export function extOf(filename) {
  const m = String(filename || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

/* 文件类型识别：决定「上传文件解析」该如何读取内容 */
export function fileKind(filename) {
  const ext = extOf(filename);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'doc') return 'doc'; /* 旧版 Word 二进制，mammoth 不支持 → 提示用户另存为 docx */
  if (['txt', 'md', 'markdown', 'json', 'log', 'csv', 'tsv'].includes(ext)) return 'text';
  if (['xlsx', 'xls', 'xlsm'].includes(ext)) return 'sheet';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff'].includes(ext)) return 'image';
  return 'unknown';
}

/* 批量导入：表头同义词 → 内部字段 key */
const HEADER_SYNONYMS = {
  name: ['线索名称', '项目名称', '名称', '线索名', '线索', '项目', 'name'],
  company: ['公司', '客户', '业主', '客户名称', '公司名称', '单位', '客户/业主', '业主/客户', 'company', 'customer'],
  contact: ['联系人', '对接人', '联系人姓名', 'contact'],
  title: ['职位', '职务', '岗位', 'title'],
  budget: ['预算', '项目预算', '金额', '预算金额', 'budget'],
  industry: ['行业', '所属行业', 'industry'],
  level: ['级别', '线索级别', '等级', '线索等级', 'level'],
  timeline: ['时间计划', '时间', '计划', '时间计划是否明确', '是否有时间计划', 'timeline'],
  phone: ['电话', '联系电话', '手机', '手机号', '联系方式', '电话号码', 'phone'],
};

/* 把单个表头映射到字段 key（找不到返回 null） */
export function mapHeaderToKey(header) {
  const h = String(header == null ? '' : header).trim().replace(/\s+/g, '');
  if (!h) return null;
  const lower = h.toLowerCase();
  for (const [key, syns] of Object.entries(HEADER_SYNONYMS)) {
    if (key.toLowerCase() === lower) return key;
    for (const s of syns) {
      if (s.toLowerCase() === lower) return key;
    }
  }
  return null;
}

/* 批量导入：单行必填项完整度 → 状态标签 */
export function computeRowStatus(row) {
  const req = ['name', 'company', 'contact', 'title', 'budget', 'industry', 'level', 'timeline'];
  const miss = req.filter((k) => !row[k] || row[k] === '?').length;
  return miss === 0 ? 'ok' : miss <= 2 ? 'partial' : 'review';
}

/* 把表格解析出的原始行（键为表头）转成 IMPORT_DATA 行结构（含 status） */
export function rowsToImportData(rawRows) {
  if (!Array.isArray(rawRows)) return [];
  return rawRows
    .map((raw) => {
      const row = {};
      Object.keys(raw || {}).forEach((h) => {
        const key = mapHeaderToKey(h);
        if (key && row[key] === undefined) {
          const v = raw[h];
          row[key] = v == null ? '' : String(v).trim();
        }
      });
      const hasAny = Object.values(row).some((x) => x);
      if (!hasAny) return null;
      row.status = computeRowStatus(row);
      return row;
    })
    .filter(Boolean);
}

/* 生成批量导入模板的 CSV 文本（含表头 + 1 行示例） */
export function batchTemplateCsv() {
  const headers = ['线索名称', '公司', '联系人', '职位', '预算', '行业', '级别', '时间计划', '电话'];
  const sample = ['示例—智能制造改造项目', '示例集团', '张三', '采购总监', '800万', '制造业', 'B — 重点', '是', '13800000000'];
  return headers.join(',') + '\n' + sample.join(',') + '\n';
}
