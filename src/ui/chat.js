// ===== 对话式录入 =====
// 左侧对话区的消息渲染、语音输入（演示）、发送解析、文档/图片 OCR（演示）。

import { d } from '../core/dom.js';
import { F } from '../data/fields.js';
import { smartExtract } from '../core/smartExtract.js';
import { state } from '../state.js';
import { renderField, setCodeBadge, updatePct, promptCompletion, resetForNewDoc } from './fields.js';
import { checkCrmMatch } from './crmMatch.js';

export function aiChatBubble(text, who) {
  const log = document.getElementById('aiChatLog'); if (!log) return;
  const row = d(''); row.style.cssText = 'display:flex;gap:8px;' + (who === 'user' ? 'flex-direction:row-reverse' : '');
  const av = d(''); av.style.cssText = 'width:26px;height:26px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;' + (who === 'user' ? 'background:#dfe7f0;color:#3a4658' : 'background:linear-gradient(135deg,#b08060,#9980b0);color:#fff');
  av.innerHTML = who === 'user' ? '<i class="ti ti-user"></i>' : '<i class="ti ti-sparkles"></i>';
  const bub = d(''); bub.style.cssText = 'max-width:80%;font-size:12.5px;line-height:1.6;padding:8px 11px;border-radius:10px;' + (who === 'user' ? 'background:#2563a8;color:#fff' : 'background:var(--bg2);color:var(--ink);border:0.5px solid var(--line)');
  bub.textContent = text;
  row.appendChild(av); row.appendChild(bub); log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}
export function aiChatBot(text) { aiChatBubble(text, 'bot'); }
export function aiChatUser(text) { aiChatBubble(text, 'user'); }

/* 在对话区插入一个可点击的操作按钮（如「查看刚导入的 N 条」）*/
export function aiChatActionButton(label, onClick) {
  const log = document.getElementById('aiChatLog'); if (!log) return;
  const row = d(''); row.style.cssText = 'display:flex;gap:8px;padding-left:34px';
  const btn = document.createElement('button'); btn.className = 'crm-btn primary'; btn.style.cssText = 'font-size:12px;padding:7px 14px;display:inline-flex;align-items:center;gap:6px';
  btn.innerHTML = '<i class="ti ti-list-details" style="font-size:14px"></i>' + label;
  btn.onclick = onClick;
  row.appendChild(btn); log.appendChild(row); log.scrollTop = log.scrollHeight;
}

/* 语音输入（演示）：点击开始"录音"，再点结束并把转写文本放入输入框 */
export function aiChatVoice() {
  const mic = document.getElementById('aiChatMic'); const inp = document.getElementById('aiChatInput');
  if (!mic || !inp) return;
  if (!state.aiChatRecording) {
    state.aiChatRecording = true;
    mic.style.background = '#c0392b'; mic.style.color = '#fff'; mic.innerHTML = '<i class="ti ti-microphone-2"></i>'; mic.title = '正在录音，点击结束';
    inp.placeholder = '正在听…说完点一下麦克风结束';
  } else {
    state.aiChatRecording = false;
    mic.style.background = ''; mic.style.color = ''; mic.innerHTML = '<i class="ti ti-microphone"></i>'; mic.title = '语音输入';
    mic.innerHTML = '<i class="ti ti-loader-2"></i>';
    setTimeout(() => {
      mic.innerHTML = '<i class="ti ti-microphone"></i>';
      /* 模拟语音转写结果填入输入框，让用户检查后发送 */
      const demo = '客户是天津钢铁集团，想上一套智能排产调度系统，制造业，预算1500万，联系人马总电话13800000006，重要客户，希望今年下半年启动';
      inp.value = demo; inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 160) + 'px'; inp.focus();
      inp.placeholder = '直接描述线索，或回答 AI 的问题…';
      aiChatBot('已转写语音内容到输入框，请检查后点发送。');
    }, 700);
  }
}

export function aiChatSend() {
  const inp = document.getElementById('aiChatInput'); if (!inp) return;
  const txt = inp.value.trim(); if (!txt) return;
  aiChatUser(txt); inp.value = ''; inp.style.height = 'auto';
  /* 直接提取并填到右侧字段，不啰嗦回话 */
  const ex = smartExtract(txt);
  let any = false;
  Object.keys(ex).forEach((k) => {
    if (k === '_codes') return;
    if (ex[k]) { F[k] = ex[k]; renderField(k, ex[k], 'ai'); any = true; }
  });
  if (ex._codes) { Object.keys(ex._codes).forEach((k) => { const info = ex._codes[k]; setCodeBadge(k, info.code, info.type, ex[k]); }); }
  updatePct(); checkCrmMatch(); promptCompletion();
  /* 仅在完全没识别到时给一句简短提示；识别到就静默填字段，用户有需要会继续说 */
  if (!any) { setTimeout(() => aiChatBot('这句没识别到明确字段，可换个说法，或直接在右侧填。'), 250); }
}

/* 把一组字段直接填入右侧表单（演示用：保证关键字段完整）*/
export function aiChatFillFields(obj) {
  Object.keys(obj).forEach((k) => {
    if (obj[k] === '' || obj[k] === undefined) return;
    F[k] = obj[k]; renderField(k, obj[k], 'ai');
  });
  updatePct(); checkCrmMatch(); promptCompletion();
}

export function aiChatDoc() {
  aiChatUser('[上传文件] 鸿图智造_电子设计集采_招标需求说明书.pdf');
  setTimeout(() => {
    aiChatBot('已识别并填入右侧字段，仅「投标截止日期」文档未写明（红框标出）。');
    resetForNewDoc(); /* 示例文档同样先清空，避免与上一条混在一起 */
    aiChatFillFields({
      name: '鸿图智造—电子设计集采EDA协同平台一期',
      owner: '鸿图智造集团',
      industry: '电力',
      productCat: '物探及智能化',
      contact: '林志远',
      phone: '13800000001',
      budget: '30000万',
      custLevel: '战略支柱客户',
      level: 'A — 重点',
      address: '上海市浦东新区',
      country: '中国',
      region: '上海市/浦东新区',
      source: '销售自拓',
      desc: '采购面向物探及智能化产线的电子设计自动化（EDA）协同平台，覆盖原理图设计、仿真校验与版图协同，要求与现有 PLM/ERP 打通',
      timeline: '是',
      status: '已初步交流',
      isPrivate: '是',
      toOpportunity: '未完成',
      /* bidDeadline 故意留空：文档未写明，需用户补 */
    });
  }, 600);
}

export function aiChatImage() {
  aiChatUser('[图片识别] 客户需求沟通截图.png');
  setTimeout(() => {
    aiChatBot('已识别并填入右侧字段，仅「投标截止日期」截图未提及（红框标出）。');
    resetForNewDoc(); /* 示例图片同样先清空，避免与上一条混在一起 */
    aiChatFillFields({
      name: '上海电力设计研究院—储能并网检测系统',
      owner: '上海电力设计研究院',
      industry: '能源',
      productCat: '储能/光伏',
      contact: '陈工',
      phone: '13800000005',
      budget: '3000万',
      custLevel: '重要客户',
      level: 'A — 重点',
      address: '上海市',
      country: '中国',
      region: '上海市',
      source: '市场活动',
      desc: '采购储能并网检测系统，用于新型储能电站并网前的性能与安全检测，需符合国标并出具检测报告',
      timeline: '是',
      status: '已初步交流',
      isPrivate: '是',
      toOpportunity: '未完成',
    });
  }, 600);
}
