// ===== 抽取引擎 =====
// 从一段自由文本中识别线索字段。严格原则：只填明确识别到的字段，未明确识别一律留空。
// 纯函数（不触碰 DOM），返回一个字段对象（可能含 _codes 编码来源信息），便于单元测试。

import { INDUSTRY_CODE_MAP, CUSTLEVEL_CODE_MAP } from '../data/codeMaps.js';
import { suggestLevel } from './suggestLevel.js';
import { normalizeTitle } from './normalizeTitle.js';

/* ── 结构化「标签：值」解析辅助（OCR 截图 / 表单 / 发票 / CRM 详情页常见）── */
const LABELS_ALL = ['项目编号', '项目名称', '线索名称', '商机名称', '需求名称', '客户名称', '采购方', '购买方', '销售方', '业主单位', '业主', '甲方', '客户编码', '客户经理', '商务经理', '联系人', '对接人', '联系电话', '联系方式', '电话', '手机', '项目预算', '预算', '合同金额', '价税合计', '金额', '所属行业', '行业', '项目地址', '项目地', '地址', '投标截止日期', '投标截止', '开标日期', '开标时间', '截止日期', '产品分类', '规格型号', '单位', '数量', '单价', '税率', '税额', '创建时间', '更新时间', '项目状态', '预计签约日期', '备注', '发票号码', '开票日期', '名称'];

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* 取某个标签后面的值：值延伸到「下一个已知标签」或「连续 2+ 空格」或文本结尾为止 */
function labeledValue(text, labels) {
  const stop = LABELS_ALL.map(escRe).join('|');
  for (const lab of labels) {
    const re = new RegExp(escRe(lab) + '(?:\\s*[（(][^）)]{0,8}[）)])?\\s*[：:]\\s*([\\s\\S]*?)(?=\\s{2,}|\\s*(?:' + stop + ')(?:\\s*[（(][^）)]{0,8}[）)])?\\s*[：:]|$)');
    const m = text.match(re);
    if (m && typeof m[1] === 'string') {
      const v = m[1].trim().replace(/\s+/g, ' ');
      if (v && !/^[-—－·\s]*$/.test(v)) return v;
    }
  }
  return null;
}

/* 公司名截断到第一个机构后缀，去掉尾随的税号/编码等噪声 */
function trimToCompany(s) {
  const m = s.match(/^[\s\S]*?(股份有限公司|有限公司|有限责任公司|公司|集团|研究院|设计院|银行|学院|大学|医院|工厂|厂|中心)/);
  return (m ? m[0] : s).trim();
}

/* 线索名称清洗：去掉发票行项目前缀「*类别*」、首部标点，限长 */
function cleanLeadName(s) {
  return s.replace(/^\*[^*]*\*/, '').replace(/^[\s：:．。]+/, '').trim().slice(0, 30);
}

/**
 * @param {string} raw 原始描述文本
 * @returns {Record<string, any>} 识别出的字段集合；编码来源记录在 r._codes
 */
export function smartExtract(raw) {
  const text = raw; const r = {};
  /* 严格原则：只填明确识别到的字段，未明确识别一律留空 */

  /* === 1. 业主/公司名识别 === */
  let companyName = null;
  const knownCo = ['鸿图智造', '东方汽车', '华能能源', '南方制造', '星辰科技', '蓝海新能源', '长城银行', '优品', '凉风电器', '安泰科技', '安泰', '晨曦', '华电电网', '骏马汽车', '海湾啤酒', '精工电子', '长空航空', '九州通信', '天津钢铁', '宝钢'];
  for (const co of knownCo) { if (text.includes(co)) { companyName = co; break; } }
  if (!companyName) {
    const co1 = text.match(/([一-龥]{2,8}?)(股份有限公司|有限公司|集团股份|科技集团|集团|股份|公司|分公司|设计院|研究院)/);
    if (co1) {
      let prefix = co1[1];
      const parts = prefix.split(/[了的跟和与给接待在到，、。是业主有个我们咱们]/);
      prefix = parts[parts.length - 1] || prefix;
      if (prefix.length >= 2) companyName = prefix + co1[2];
    }
  }
  if (!companyName) {
    const co2 = text.match(/(北京|上海|广州|深圳|杭州|南京|苏州|成都|武汉|西安|天津|青岛|大连|宁波)\s*([一-龥]{0,4}?)(钢铁|制造|科技|电子|集团|银行|医院|设计院)/);
    if (co2) { companyName = co2[0]; }
  }
  if (companyName) {
    r.owner = companyName;
    /* 线索名称：从文本中提取项目名/采购意向 */
    const projectMatch = text.match(/(?:采购|做|上线|建设|引入|集采)\s*(?:一套|一个|个)?\s*([一-龥A-Za-z]{2,15}?)(系统|平台|项目|方案|软件|设备|工具|产品|中台|集采|采购)/);
    if (projectMatch) {
      let proj = projectMatch[1].replace(/^(一套|一个|个)/, '');
      r.name = companyName + proj + (projectMatch[2] === '采购' || projectMatch[2] === '集采' ? projectMatch[2] : projectMatch[2]);
    }
  }

  /* === 2. 联系人 & 职位识别 === */
  const surnames = new Set(['李', '王', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡', '余', '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈', '姚', '卢', '姜', '崔', '钟', '谭', '陆', '汪', '范', '金', '石', '廖', '贾', '夏', '韦', '付', '方', '白', '邹', '孟', '熊', '秦', '邱', '江', '尹', '薛', '闫', '段', '雷', '侯', '龙', '史', '陶', '黎', '贺', '顾', '毛', '郝', '龚', '邵', '万', '钱', '戴', '严', '欧', '莫', '孔', '向', '常']);

  let bestContact = null;
  const nameStopper = /[通说找对给和与跟带让叫请约见聊谈了的是在会要将，。、；：！？\s（）()]/;
  const titleChars = /[总监理裁长事经管主任副]/;

  function readName(startIdx) {
    if (startIdx >= text.length) return null;
    const first = text[startIdx];
    if (!surnames.has(first)) return null;
    let name = first;
    for (let i = startIdx + 1; i < startIdx + 4 && i < text.length; i++) {
      const c = text[i];
      if (!/[一-龥]/.test(c)) break;
      if (nameStopper.test(c)) break;
      if (titleChars.test(c)) break;
      name += c;
    }
    return name;
  }

  const titleThenName = /(采购|销售|技术|财务|市场|运营|人事|信息化?|供应链|研发|生产|项目)?\s*(总裁|董事长|总经理|副总裁|副总经理|总监|副总|经理|主管|主任|负责人)\s*([一-龥])/g;
  let tm;
  while ((tm = titleThenName.exec(text)) !== null) {
    const nameStart = tm.index + tm[0].length - 1;
    const fullName = readName(nameStart);
    if (fullName && fullName.length >= 2) {
      const dept = tm[1] || '';
      let rank = tm[2];
      let fullTitle = rank;
      if (dept && !rank.includes(dept)) fullTitle = dept + rank;
      bestContact = { name: fullName, title: fullTitle, start: nameStart, preformatted: true };
      break;
    }
  }
  if (!bestContact) {
    const titleSuffix = /(总裁|董事长|总经理|副总裁|副总经理|总监|副总|经理|主管|主任|总)/g;
    let m;
    while ((m = titleSuffix.exec(text)) !== null) {
      const idx = m.index; const titleWord = m[0];
      if (idx < 1) continue;
      let collected = '';
      for (let i = idx - 1; i >= Math.max(0, idx - 5); i--) {
        const c = text[i];
        if (!/[一-龥]/.test(c)) break;
        if (nameStopper.test(c)) break;
        collected = c + collected;
      }
      if (!collected) continue;
      let name = null;
      for (let j = 0; j < collected.length; j++) { if (surnames.has(collected[j])) { name = collected.slice(j); if (name.length > 3) name = name.slice(0, 3); break; } }
      if (!name || !surnames.has(name[0])) continue;
      if (companyName && companyName.includes(name)) continue;
      bestContact = { name: name, title: titleWord, start: idx - name.length };
      break;
    }
  }
  /* 兜底：直接出现的"联系人XXX"或裸姓名（如"联系人林志远"、"需求联系人林志远"） */
  if (!bestContact) {
    const cm = text.match(/(?:联系人|对接人|找)\s*([一-龥]{2,3})(?![一-龥])/);
    if (cm && surnames.has(cm[1][0])) bestContact = { name: cm[1], title: '', start: text.indexOf(cm[1]), preformatted: true };
  }
  if (bestContact) { r.contact = bestContact.name; if (bestContact.title) r.title = bestContact.preformatted ? bestContact.title : normalizeTitle(bestContact.title, text, bestContact.start); }

  /* === 3. 联系电话 === */
  /* 用前后「非数字」边界，避免把发票号/订单号等长数字串里的 11 位误当手机号 */
  const phoneMatch = text.match(/(?:电话|手机|联系方式|tel|Tel)?\s*[:：]?\s*(?<!\d)(1[3-9]\d{9})(?!\d)/);
  if (phoneMatch) r.phone = phoneMatch[1];

  /* === 4. 预算（支持万/亿，输出规范化） === */
  const bm = text.match(/(\d+(?:[,，]\d{3})*(?:\.\d+)?)\s*(亿元|亿|万元|万|百万|千万|w|W)/);
  if (bm) {
    let numStr = bm[1].replace(/[,，]/g, '');
    let num = parseFloat(numStr); const unit = bm[2];
    if (unit === '百万') num = num * 100;
    else if (unit === '千万') num = num * 1000;
    else if (unit === '亿' || unit === '亿元') num = num * 10000;
    r.budget = num >= 10000 ? (num / 10000) + '亿元' : num + '万元';
  }

  /* === 5. 行业（支持编码转换 + 关键词，垂直行业优先） === */
  /* 编码引用：识别"行业编码01"/"行业:01"/"行业01" → 转换为显示值 */
  const indCodeMatch = text.match(/行业(?:编码|代码|代号)?\s*[:：]?\s*(\d{2})/);
  if (indCodeMatch && INDUSTRY_CODE_MAP[indCodeMatch[1]]) {
    r.industry = INDUSTRY_CODE_MAP[indCodeMatch[1]];
    r._codes = r._codes || {}; r._codes.industry = { code: indCodeMatch[1], type: '行业编码' };
  } else {
    const indMap = { '电力': ['电力', '电网', '发电', '输配电'], '金融': ['金融', '银行', '保险', '证券', '风控'], '能源': ['能源', '石化', '石油', '煤炭', '燃气'], '汽车': ['汽车', '整车', '车企', '汽车零部件'], '医疗': ['医疗', '医院', '医药', '制药'], '制造业': ['制造业', '智能制造', '工厂', '工业制造', '钢铁', '产线'], '物探': ['物探', '地球物理', '勘探'], '零售': ['零售', '商超', '电商', '门店'], '政府': ['政府', '政务', '公检法', '机关', '事业单位'], 'ICT': ['ICT', '信息化', '信息技术', '互联网', '软件', 'IT平台', '云平台', '数字化'] };
    for (const [ind, kws] of Object.entries(indMap)) { if (kws.some((k) => text.includes(k))) { r.industry = ind; break; } }
  }

  /* === 6. 产品分类 === */
  const prodMatch = text.match(/(物探设备|物探及智能化|智能化设备|供应链系统|供应链平台|ERP|数据中台|风控系统|视觉质检|AI平台|数字孪生|云平台)/);
  if (prodMatch) r.productCat = prodMatch[1];

  /* === 7. 项目地址 === */
  const addrMatch = text.match(/(北京|上海|广州|深圳|杭州|南京|苏州|成都|武汉|西安|天津|青岛|大连|宁波|重庆)(市)?/);
  if (addrMatch) r.address = addrMatch[0].endsWith('市') ? addrMatch[0] : addrMatch[0] + '市';

  /* === 8. 时间计划 === */
  if (/(年内|今年|明年|本季度|Q[1-4]|上半年|下半年|年底|\d+月底?)\s*(之?前)?\s*(采购|完成|上线|交付|决策|启动|进入|选型|招标|要|需要|希望|计划)/.test(text)) r.timeline = '是';
  else if (/(希望|要求|计划|准备|争取)\s*(在)?\s*(年内|今年|明年|Q[1-4]|\d+月|年底|上半年|下半年)\s*(之?前)?\s*(上线|完成|交付|采购|招标|启动)/.test(text)) r.timeline = '是';

  /* === 9. 客户等级（支持编码 A/B/C/D 转换） === */
  const clCodeMatch = text.match(/客户等级\s*[:：]?\s*([A-D])\b/);
  if (clCodeMatch && CUSTLEVEL_CODE_MAP[clCodeMatch[1]]) {
    r.custLevel = CUSTLEVEL_CODE_MAP[clCodeMatch[1]];
    r._codes = r._codes || {}; r._codes.custLevel = { code: clCodeMatch[1], type: '客户等级编码' };
  } else if (/战略支柱客户|战略支柱/.test(text)) r.custLevel = '战略支柱客户';
  else if (/重要客户/.test(text)) r.custLevel = '重要客户';
  else if (/潜在客户/.test(text)) r.custLevel = '潜在客户';

  /* === 10. 线索级别（S/A/B/C，按预算+关键词） === */
  if (/战略支柱|战略级|S\s*级|行业头部/.test(text)) {
    r.level = 'S — 战略级';
  } else if (/重点客户|重要客户|A\s*级/.test(text)) {
    r.level = 'A — 重点';
  } else if (r.budget) {
    const suggested = suggestLevel(r.budget, text);
    if (suggested) r.level = suggested;
  }

  /* === 11. 线索描述（提取采购/需求核心短语，精确锚定避免吃前缀） === */
  let descVal = null;
  const descPatterns = [
    /电子设计集采/,
    /(物探设备|供应链系统|供应链平台|视觉质检系统|数据中台|风控系统|ERP系统|物探及智能化)(定向采购|集中采购|集采|采购|升级改造|升级|改造)/,
    /(物探设备|供应链|视觉质检|数据中台|风控|ERP)[一-龥]{0,3}(定向采购|集中采购|集采)/,
    /(定向采购|集中采购|集采)/,
    /(数字化|智能化)(改造|升级|转型)项目?/,
    /采购(一套|一个)?[一-龥]{2,8}(系统|平台|设备|方案|中台)/,
    /(物探设备|供应链系统|视觉质检系统|数据中台|风控系统|ERP系统|设备|系统|平台|方案)(的)?(采购|升级|改造)需求/,
  ];
  for (const p of descPatterns) { const mm = text.match(p); if (mm) { descVal = mm[0].slice(0, 16); break; } }
  if (descVal) r.desc = descVal;

  /* === 12. 国家（默认中国，识别明确国名） === */
  const countryMatch = text.match(/(中国|美国|德国|日本|新加坡|英国|法国|韩国)/);
  if (countryMatch) r.country = countryMatch[1];
  else if (r.owner || r.address) r.country = '中国'; /* 有业主/地址时默认中国 */

  /* === 13. 所属区划（从地址推断省市） === */
  if (r.address) {
    const regionMap = { '上海市': '上海市/上海城区', '北京市': '北京市/北京城区', '广州市': '广东省/广州市', '深圳市': '广东省/深圳市', '杭州市': '浙江省/杭州市', '南京市': '江苏省/南京市', '成都市': '四川省/成都市', '武汉市': '湖北省/武汉市', '天津市': '天津市/天津城区', '西安市': '陕西省/西安市', '重庆市': '重庆市/重庆城区' };
    if (regionMap[r.address]) r.region = regionMap[r.address];
  }

  /* === 14. 投标截止日期（识别"X月X日开标""截止X月""下个月开标"等） === */
  const bidMatch = text.match(/(\d{1,2}月\d{1,2}日|\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}日?)\s*(开标|截止|投标)/);
  if (bidMatch) r.bidDeadline = bidMatch[1];
  else if (/下个?月\s*(开标|截止|投标)/.test(text)) r.bidDeadline = '下月（待定）';

  /* === 15. 线索状态（按沟通进度推断初始状态） === */
  if (/已初步交流|初步沟通|聊过|通过话/.test(text)) r.status = '已初步交流';
  else if (/方案沟通|方案对接|做方案|POC|演示/.test(text)) r.status = '方案沟通中';
  else if (/商务谈判|谈价|报价/.test(text)) r.status = '商务谈判';
  else if (r.owner || r.contact) r.status = '待跟进'; /* 有基本信息默认待跟进 */

  /* === 16. 是否生成商机（新建线索默认未完成） === */
  if (r.owner || r.name) r.toOpportunity = '未完成';

  /* === 17. 是否私有线索（新录入的默认为是，即归属当前销售） === */
  if (r.owner || r.name) r.isPrivate = '是';

  /* === 18. 结构化「标签：值」解析（OCR 截图 / 表单 / 发票 / CRM 详情页），优先级高于上面的启发式猜测 === */
  const Lname = labeledValue(text, ['线索名称', '商机名称', '需求名称', '项目名称']);
  if (Lname) { const nm = cleanLeadName(Lname); if (nm) r.name = nm; }

  const Lowner = labeledValue(text, ['采购方', '购买方', '客户名称', '业主单位', '业主', '甲方']);
  if (Lowner) r.owner = trimToCompany(Lowner);

  const Lcontact = labeledValue(text, ['联系人', '对接人']);
  if (Lcontact && /^[一-龥]{2,4}$/.test(Lcontact)) r.contact = Lcontact;

  const Lphone = labeledValue(text, ['联系电话', '联系方式', '手机', '电话']);
  if (Lphone) { const pm = Lphone.match(/(?<!\d)(1[3-9]\d{9})(?!\d)/); if (pm) r.phone = pm[1]; }

  const Lmgr = labeledValue(text, ['客户经理']);
  if (Lmgr && /^[一-龥]{2,4}$/.test(Lmgr)) r.salesManager = Lmgr;

  const Lindustry = labeledValue(text, ['所属行业', '行业']);
  if (Lindustry) {
    const indMap2 = { '电力': ['电力', '电网'], '金融': ['金融', '银行', '保险', '证券'], '能源': ['能源', '石化', '石油', '新能源', '储能', '光伏', '燃气'], '汽车': ['汽车', '整车', '车企'], '医疗': ['医疗', '医院', '医药', '制药'], '制造业': ['制造', '钢铁', '产线', '工厂'], '物探': ['物探', '勘探'], '零售': ['零售', '商超', '电商', '门店'], '政府': ['政府', '政务', '机关'], 'ICT': ['ICT', '信息化', '软件', '互联网', '数字化', '通信', '云'] };
    for (const [ind, kws] of Object.entries(indMap2)) { if (kws.some((k) => Lindustry.includes(k))) { r.industry = ind; break; } }
  }

  const Laddr = labeledValue(text, ['项目地址', '项目地', '地址']);
  if (Laddr) {
    const parts = Laddr.split(/[\/／]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      if (/^(中国|美国|德国|日本|新加坡|英国|法国|韩国)$/.test(parts[0])) r.country = parts[0];
      const tail = parts[parts.length - 1];
      const cityM = tail.match(/[一-龥]{2,}?(市|区|县)/);
      r.address = cityM ? cityM[0] : tail;
      const region = parts.filter((p) => /省|市|区|自治区/.test(p)).join('/');
      if (region) r.region = region;
    }
  }

  const Lbid = labeledValue(text, ['投标截止日期', '投标截止', '开标日期', '开标时间', '截止日期']);
  if (Lbid) {
    const dm = Lbid.match(/(\d{4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})/);
    if (dm) r.bidDeadline = dm[1] + '-' + String(dm[2]).padStart(2, '0') + '-' + String(dm[3]).padStart(2, '0');
    else { const dm2 = Lbid.match(/\d{1,2}月\d{1,2}日/); if (dm2) r.bidDeadline = dm2[0]; }
  }

  const Lbudget = labeledValue(text, ['项目预算', '预算', '合同金额']);
  if (Lbudget) {
    const bm2 = Lbudget.match(/(\d+(?:[,，]\d{3})*(?:\.\d+)?)\s*(亿元|亿|万元|万|百万|千万)/);
    if (bm2) { let n = parseFloat(bm2[1].replace(/[,，]/g, '')); const u = bm2[2]; if (u === '百万') n *= 100; else if (u === '千万') n *= 1000; else if (u === '亿' || u === '亿元') n *= 10000; r.budget = n >= 10000 ? (n / 10000) + '亿元' : n + '万元'; }
  }

  const Lprod = labeledValue(text, ['产品分类']);
  if (Lprod) r.productCat = Lprod.slice(0, 20);

  /* 结构化解析补齐后，重算依赖字段（国家 / 区划 / 状态 / 是否商机 / 是否私有） */
  if (!r.country && (r.owner || r.address)) r.country = '中国';
  if (!r.region && r.address) {
    const regionMap2 = { '上海市': '上海市/上海城区', '北京市': '北京市/北京城区', '广州市': '广东省/广州市', '深圳市': '广东省/深圳市', '杭州市': '浙江省/杭州市', '南京市': '江苏省/南京市', '成都市': '四川省/成都市', '武汉市': '湖北省/武汉市', '天津市': '天津市/天津城区', '西安市': '陕西省/西安市', '重庆市': '重庆市/重庆城区' };
    if (regionMap2[r.address]) r.region = regionMap2[r.address];
  }
  if (!r.status && (r.owner || r.contact)) r.status = '待跟进';
  if ((r.owner || r.name) && !r.toOpportunity) r.toOpportunity = '未完成';
  if ((r.owner || r.name) && !r.isPrivate) r.isPrivate = '是';

  return r;
}
