// ===== 演示样本数据 =====
// AI_CHAT_EXAMPLES : 对话式录入「试试示例」气泡 —— 每个含描述文本 + 完整字段集（点选即填满右侧，无缺失）
// IMPORT_DATA      : 批量导入预览的样本行（含 ok / partial / review 三种识别状态，可点击补全）
//                    注意：IMPORT_DATA 在运行时会被清空（submitImportBatch 里 length=0），各模块共享同一引用。

export const AI_CHAT_EXAMPLES = [
  {
    label: '微信需求',
    text: '客户微信发来：我们鸿图智造集团有个电子设计集采项目，要采购一套面向物探产线的 EDA 协同平台，预算大概3亿元，电力行业，产品方向物探及智能化，项目在上海浦东，联系人林志远采购总监，电话13800000001，我们是战略支柱客户，投标截止2026-08-31，争取今年内完成招标',
    fields: { name: '鸿图智造—电子设计集采EDA协同平台', owner: '鸿图智造集团', industry: '电力', productCat: '物探及智能化', contact: '林志远', phone: '13800000001', budget: '30000万', custLevel: '战略支柱客户', level: 'A — 重点', address: '上海市浦东新区', country: '中国', region: '上海市/浦东新区', source: '销售自拓', desc: '采购面向物探产线的电子设计自动化（EDA）协同平台，覆盖原理图设计、仿真校验与版图协同', timeline: '是', bidDeadline: '2026-08-31', status: '已初步交流', isPrivate: '是', toOpportunity: '未完成' },
  },
  {
    label: '电话沟通',
    text: '刚跟东方汽车集团的信息化总监李梅通了电话，他们要做一套产线视觉质检 AI 系统，汽车制造业，预算1200万，希望今年Q3完成选型采购，联系电话13800000003，重要客户，投标截止2026-07-15，目前在技术调研阶段',
    fields: { name: '东方汽车—产线视觉质检AI系统', owner: '东方汽车集团', industry: '汽车', productCat: '智能制造', contact: '李梅', phone: '13800000003', budget: '1200万', custLevel: '重要客户', level: 'A — 重点', address: '天津市', country: '中国', region: '天津市', source: '销售自拓', desc: '采购产线视觉质检 AI 系统，用于整车与零部件产线的外观缺陷自动检测', timeline: '是', bidDeadline: '2026-07-15', status: '已初步交流', isPrivate: '是', toOpportunity: '未完成' },
  },
  {
    label: '招标线索',
    text: '收到招标信息：南方新能源储能并网检测系统采购，公告预算2000万，能源行业，产品方向储能/光伏，地址广州，投标截止2026-07-30，联系人陈工电话13800000005，需尽快确认技术方案',
    fields: { name: '南方新能源—储能并网检测系统', owner: '南方新能源', industry: '能源', productCat: '储能/光伏', contact: '陈工', phone: '13800000005', budget: '2000万', custLevel: '重要客户', level: 'A — 重点', address: '广州市', country: '中国', region: '广东省/广州市', source: '市场活动', desc: '储能并网检测系统采购，用于新型储能电站并网前性能与安全检测，需出具合规报告', timeline: '是', bidDeadline: '2026-07-30', status: '已初步交流', isPrivate: '是', toOpportunity: '未完成' },
  },
  {
    label: '转介绍',
    text: '合作伙伴介绍安泰科技的技术副总刘强，找智能风控数据中台方案，金融行业，预算8000万左右，希望年内启动立项，电话13800000004，战略支柱客户，投标截止2026-09-30，优先跟进',
    fields: { name: '安泰科技—智能风控数据中台', owner: '安泰科技', industry: '金融', productCat: '数据中台', contact: '刘强', phone: '13800000004', budget: '8000万', custLevel: '战略支柱客户', level: 'A — 重点', address: '北京市', country: '中国', region: '北京市', source: '合作伙伴', desc: '建设智能风控数据中台，整合多源数据用于实时风险识别与决策', timeline: '是', bidDeadline: '2026-09-30', status: '已初步交流', isPrivate: '是', toOpportunity: '未完成' },
  },
];

export const IMPORT_DATA = [
  { name: '蓝海新能源—供应链协同平台', company: '蓝海新能源', contact: '赵明', title: '采购总监', budget: '600万', industry: '汽车', level: 'A — 战略', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '长城银行—数字化转型项目', company: '长城银行', contact: '钱伟', title: '信息部主任', budget: '1200万', industry: '金融', level: 'A — 战略', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '优品集团—智能制造改造', company: '优品集团', contact: '孙强', title: 'IT负责人', budget: '400万', industry: '制造业', level: 'B — 重点', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '凉风电器—ERP升级', company: '凉风电器', contact: '周敏', title: '采购总监', budget: '350万', industry: '制造业', level: 'B — 重点', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '安泰保险—数据中台', company: '安泰保险', contact: '吴磊', title: '技术总监', budget: '800万', industry: '金融', level: 'A — 战略', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '晨曦集团—智能工厂', company: '晨曦集团', contact: '郑华', title: '制造总监', budget: '500万', industry: '制造业', level: 'A — 战略', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '华电电网—电网AI项目', company: '华电电网', contact: '冯军', title: '信息化部长', budget: '1500万', industry: '能源', level: 'A — 战略', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '骏马汽车—产线智能化', company: '骏马汽车', contact: '卫东', title: '采购经理', budget: '900万', industry: '汽车', level: 'B — 重点', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '海湾啤酒—数字营销平台', company: '海湾啤酒', contact: '蒋涛', title: '市场总监', budget: '200万', industry: '制造业', level: 'C — 普通', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '精工电子—自动化升级', company: '精工电子', contact: '何斌', title: '生产总监', budget: '2000万', industry: '制造业', level: 'A — 战略', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '长空航空—票务系统', company: '长空航空', contact: '沈航', title: '采购总监', budget: '1100万', industry: 'ICT', level: 'A — 战略', timeline: '是', budgetClear: '是', status: 'ok' },
  { name: '九州通信—云平台建设', company: '九州通信', contact: '韩磊', title: '技术副总', budget: '', industry: 'ICT', level: 'B — 重点', timeline: '是', budgetClear: '否', status: 'partial' },
];
