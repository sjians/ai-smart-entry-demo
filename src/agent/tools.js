// ===== 手搓 Agent · 工具层（function-calling） =====
// 大模型不直接写 DOM —— 它只能「调用工具」，由这里的执行器去真正操作右侧字段卡 / CRM / 保存。
// 这正是 agent 的关键：模型负责「决定做什么」，工具负责「真的去做」，两者解耦。
//
// 工具清单：
//   fill_lead_fields  填/改右侧线索字段（核心，可一次填多个；支持编码→显示值徽标）
//   get_form_state    读当前表单：已填、缺哪些关键项、业主/联系人是否命中 CRM
//   save_lead         保存当前线索（仅当用户明确说"保存"才用——保存是带后果的动作）

import { F, FKEYS, FL, SELS, KEY_FIELDS } from '../data/fields.js';
import { INDUSTRY_CODE_MAP, CUSTLEVEL_CODE_MAP } from '../data/codeMaps.js';
import { CRM_CUSTOMERS, CRM_CONTACTS } from '../data/crm.js';
import { renderField, updatePct, promptCompletion, setCodeBadge } from '../ui/fields.js';
import { checkCrmMatch } from '../ui/crmMatch.js';
import { embSaveFromAi } from '../ui/leads.js';

/* 下拉值容错：把模型可能给出的简写归一到合法选项。例：level 给 'A' → 'A — 重点' */
function coerceSelValue(key, value) {
  const opts = SELS[key];
  if (!opts) return value;
  const v = String(value).trim();
  if (opts.includes(v)) return v;
  // 单字母/前缀匹配（线索级别 S/A/B/C、客户等级等）
  const hit = opts.find((o) => o === v || o.startsWith(v) || o.split(/[\s—-]/)[0] === v);
  if (hit) return hit;
  // 关键词包含（行业「电力公司」→「电力」）
  const loose = opts.find((o) => v.includes(o) || o.includes(v));
  return loose || v; // 实在匹配不上就原样填，至少用户能看到
}

/* ===== 工具规格（OpenAI function-calling 形状）===== */
// fields 属性按真实字段动态生成：下拉字段带 enum（把合法值直接喂给模型，比只写在 system 里更可靠）。
function buildFieldsProperties() {
  const props = {};
  FKEYS.forEach((k) => {
    const p = { type: 'string', description: FL[k] };
    if (SELS[k]) p.enum = SELS[k];
    props[k] = p;
  });
  return props;
}

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fill_lead_fields',
      description:
        '把从用户话里识别到的线索信息填入右侧表单。可一次填多个字段。只填明确出现或能合理推断的字段，' +
        '不要臆造。预算统一写成「3000万」或「3亿元」这种。线索级别按分级标准推断。' +
        '若用户输入里出现行业编码(01–11)或客户等级编码(A–D)，在 fields 里填转换后的显示值，并在 codes 里附上原始编码。',
      parameters: {
        type: 'object',
        properties: {
          fields: { type: 'object', description: '字段键值对，键必须是给定字段之一', properties: buildFieldsProperties(), additionalProperties: false },
          codes: {
            type: 'object',
            description: '可选。识别到的原始编码，用于在字段旁显示来源徽标',
            properties: {
              industry: { type: 'string', description: '行业编码，如 01' },
              custLevel: { type: 'string', description: '客户等级编码，A/B/C/D' },
            },
            additionalProperties: false,
          },
        },
        required: ['fields'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_form_state',
      description: '读取当前右侧表单：已填字段、还缺哪些关键字段、业主/联系人是否已在 CRM。用于决定下一步该追问什么。',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_lead',
      description: '保存当前线索到列表。仅当用户明确表示要保存（如「保存」「存一下」「提交」）时才调用，不要自作主张保存。',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
];

/* ===== 执行器 ===== */
function execFillFields(args) {
  const fields = (args && args.fields) || {};
  const codes = (args && args.codes) || {};
  const filled = [];
  const ignored = [];

  Object.keys(fields).forEach((k) => {
    if (!FKEYS.includes(k)) { ignored.push(k); return; }
    let v = fields[k];
    if (v === null || v === undefined) return;
    v = String(v).trim();
    if (!v) return;
    if (SELS[k]) v = coerceSelValue(k, v);
    F[k] = v;
    renderField(k, v, 'ai');
    filled.push([FL[k], v]);
  });

  // 编码徽标（紫色「编码 → 显示值」标记），保留原型的「系统对接数据」体验
  if (codes.industry && INDUSTRY_CODE_MAP[codes.industry]) {
    const disp = INDUSTRY_CODE_MAP[codes.industry];
    if (!F.industry) { F.industry = disp; renderField('industry', disp, 'ai'); }
    setCodeBadge('industry', codes.industry, '行业编码', F.industry);
  }
  if (codes.custLevel && CUSTLEVEL_CODE_MAP[codes.custLevel]) {
    const disp = CUSTLEVEL_CODE_MAP[codes.custLevel];
    if (!F.custLevel) { F.custLevel = disp; renderField('custLevel', disp, 'ai'); }
    setCodeBadge('custLevel', codes.custLevel, '客户等级编码', F.custLevel);
  }

  updatePct();
  checkCrmMatch();
  promptCompletion();

  const missing = KEY_FIELDS.filter(([k]) => !F[k]).map(([, label]) => label);
  return { ok: true, filled: filled.map(([l, v]) => `${l}=${v}`), ignoredKeys: ignored, missingRequired: missing };
}

function execGetFormState() {
  const filled = {};
  FKEYS.forEach((k) => { if (F[k]) filled[FL[k]] = F[k]; });
  const missing = KEY_FIELDS.filter(([k]) => !F[k]).map(([, label]) => label);
  const ownerInCrm = !!(F.owner && CRM_CUSTOMERS.includes(F.owner));
  const contactInCrm = !!(F.owner && F.contact && CRM_CONTACTS[F.owner] && CRM_CONTACTS[F.owner].includes(F.contact));
  return {
    filled,
    missingRequired: missing,
    crm: {
      ownerInCrm,
      contactInCrm,
      hint: F.owner && !ownerInCrm ? '业主未在 CRM，可提示用户点字段旁「AI 创建客户」' : '',
    },
  };
}

function execSaveLead() {
  const hasContent = !!(F.owner || F.name);
  if (!hasContent) return { ok: false, reason: '当前没有可保存的线索（业主/线索名称都为空）' };
  embSaveFromAi(); // 内部会写入列表、清空表单、弹 Toast、在对话区追加「查看已保存」按钮
  return { ok: true, note: '已保存并清空表单，准备录下一条' };
}

/* 工具分发：返回值会被 JSON 序列化塞回对话，供模型继续推理 */
export function runTool(name, args) {
  try {
    if (name === 'fill_lead_fields') return execFillFields(args);
    if (name === 'get_form_state') return execGetFormState();
    if (name === 'save_lead') return execSaveLead();
    return { ok: false, error: '未知工具：' + name };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}
