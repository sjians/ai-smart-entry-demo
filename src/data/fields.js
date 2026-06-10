// ===== 字段定义 =====
// F   : 字段值（运行时状态，可变；在各模块间共享同一引用）
// FL  : 字段中文标签
// FI  : 字段图标（Tabler Icons class）
// FGROUPS : 字段分组（基本信息）
// SELS    : 下拉字段的可选项

/* 基本信息 + 卖方信息 + 跟进 */
export const F = {
  /* 基本信息 */
  name: '', owner: '', contact: '', phone: '', custLevel: '', budget: '', bidDeadline: '', address: '', country: '', region: '', industry: '', productCat: '', level: '', desc: '', timeline: '', isPrivate: '', toOpportunity: '', status: '',
  /* 卖方信息 */
  salesEntity: '', salesManager: '',
  /* 跟进 */
  followup: '',
};

export const FKEYS = Object.keys(F);

export const FL = {
  name: '线索名称', owner: '业主/客户', contact: '联系人', phone: '联系电话', custLevel: '客户等级', budget: '项目预算', bidDeadline: '投标截止日期', address: '项目地址', country: '国家', region: '所属区划', industry: '行业', productCat: '线索涉及产品分类', level: '线索级别', desc: '线索描述', timeline: '时间计划是否明确', isPrivate: '是否私有线索', toOpportunity: '是否生成商机', status: '线索状态',
  salesEntity: '销售主体', salesManager: '客户经理',
  followup: '下次跟进',
};

export const FI = {
  name: 'ti-tag', owner: 'ti-building', contact: 'ti-user', phone: 'ti-phone', custLevel: 'ti-award', budget: 'ti-coin', bidDeadline: 'ti-calendar-due', address: 'ti-map-pin', country: 'ti-world', region: 'ti-map-2', industry: 'ti-category', productCat: 'ti-box', level: 'ti-star', desc: 'ti-file-text', timeline: 'ti-calendar', isPrivate: 'ti-lock', toOpportunity: 'ti-target-arrow', status: 'ti-progress',
  salesEntity: 'ti-briefcase', salesManager: 'ti-user-star',
  followup: 'ti-clock',
};

/* 字段分组：仅保留基本信息（含买方关键字段 + 跟进），删除卖方信息分组 */
export const FGROUPS = [
  { name: '基本信息', icon: 'ti-info-circle', keys: ['name', 'owner', 'contact', 'phone', 'custLevel', 'budget', 'bidDeadline', 'address', 'country', 'region', 'industry', 'productCat', 'level', 'desc', 'timeline', 'isPrivate', 'toOpportunity', 'status', 'followup'] },
];

export const SELS = {
  industry: ['电力', '制造业', 'ICT', '金融', '零售', '医疗', '政府', '能源', '汽车', '房地产', '物探'],
  level: ['S — 战略级', 'A — 重点', 'B — 跟进', 'C — 普通'],
  custLevel: ['战略支柱客户', '重要客户', '普通客户', '潜在客户'],
  timeline: ['是', '否'],
  isPrivate: ['是', '否'],
  toOpportunity: ['已完成', '未完成'],
  country: ['中国', '美国', '德国', '日本', '新加坡', '其他'],
  status: ['待跟进', '已初步交流', '方案沟通中', '商务谈判', '已生成商机', '已关闭'],
  followup: ['今天', '明天', '本周五', '下周一', '下周三', '两周后', '一个月后'],
};

/* 多轮交互补全：关键字段清单（与字段卡真实字段一一对应，key 必须存在于 F/FL 中） */
export const KEY_FIELDS = [
  ['name', '线索名称'], ['owner', '业主/客户'], ['contact', '联系人'], ['phone', '联系电话'],
  ['budget', '项目预算'], ['industry', '行业'], ['productCat', '产品分类'], ['level', '线索级别'],
  ['desc', '线索描述'], ['bidDeadline', '投标截止日期'], ['custLevel', '客户等级'], ['timeline', '时间计划'],
];

/* AI 一项项追问的顺序（演示用） */
export const AI_CHAT_ASK = [
  ['owner', '客户/业主公司名'], ['name', '线索名称（或要做的项目）'], ['industry', '客户行业'], ['productCat', '客户赛道/产品方向'],
  ['contact', '联系人'], ['phone', '联系电话'], ['budget', '项目预算'], ['level', '线索级别'],
];
