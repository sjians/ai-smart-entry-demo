// ===== AI 智能录入主面板 =====
// 两列布局：左侧对话区（输入 / 语音 / + 导入菜单 / 示例气泡）+ 右侧字段卡（实时回填 + 保存）。

import { d } from '../core/dom.js';
import { F, FKEYS } from '../data/fields.js';
import { AI_CHAT_EXAMPLES } from '../data/examples.js';
import { state } from '../state.js';
import { mkFieldsCard, promptCompletion } from './fields.js';
import { embSaveFromAi } from './leads.js';
import { aiChatUser, aiChatFillFields, aiChatBot } from './chat.js';
import { buildPlusMenu, realVoice } from './realInput.js';
import { aiChatSubmit, resetAgentConversation } from '../agent/agentLoop.js';
import { renderAgentBadge } from '../agent/settingsModal.js';

export function openEmbAiPanel() {
  const existing = document.getElementById('embAiPanelBg'); if (existing) existing.remove();
  FKEYS.forEach((k) => (F[k] = ''));
  resetAgentConversation(); /* 每次打开面板 = 一段全新对话，清空 agent 记忆 */
  const bg = d('emb-panel-bg'); bg.id = 'embAiPanelBg';
  const panel = d('emb-panel'); panel.style.width = '1080px';
  const ph = d('emb-panel-head');
  ph.innerHTML = '<div class="emb-panel-title"><i class="ti ti-sparkles"></i>AI 智能录入</div>';
  const closeX = document.createElement('button'); closeX.className = 'emb-panel-close'; closeX.innerHTML = '<i class="ti ti-x"></i> 关闭'; closeX.onclick = closeEmbAiPanel;
  renderAgentBadge(ph); /* 顶部「真·AI / 规则引擎」状态徽标，点击打开 AI 设置 */
  ph.appendChild(closeX); panel.appendChild(ph);
  panel.style.height = '86vh'; panel.style.maxHeight = '760px';

  /* 两列布局：左对话区 + 右字段卡 */
  const bodyWrap = d('emb-panel-body'); bodyWrap.id = 'embPanelBody'; bodyWrap.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:row;gap:0;padding:0;overflow:hidden';

  /* 左：对话区 */
  const chatCol = d(''); chatCol.style.cssText = 'flex:0 0 46%;width:46%;display:flex;flex-direction:column;border-right:1px solid var(--line);background:var(--card);min-width:0;min-height:0';
  const chatLog = d(''); chatLog.id = 'aiChatLog'; chatLog.style.cssText = 'flex:1;overflow-y:auto;padding:16px 16px 8px;display:flex;flex-direction:column;gap:10px';
  chatCol.appendChild(chatLog);
  /* 输入行 */
  const inRow = d(''); inRow.style.cssText = 'border-top:1px solid var(--line);padding:12px;display:flex;gap:8px;align-items:flex-end;background:var(--bg2)';
  const ta = document.createElement('textarea'); ta.id = 'aiChatInput'; ta.rows = 4; ta.placeholder = '直接描述线索，或回答 AI 的问题…例如：业主鸿图智造集团，电子设计集采项目，预算3亿，电力行业，联系人林志远13800000001，战略支柱客户'; ta.style.cssText = 'flex:1;font-size:13px;padding:10px 12px;border:0.5px solid var(--line);border-radius:8px;font-family:inherit;outline:none;resize:none;min-height:84px;max-height:160px;line-height:1.6';
  ta.oninput = function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 160) + 'px'; };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiChatSubmit(); } };
  /* + 导入 与 发送 */
  const plusWrap = d(''); plusWrap.style.cssText = 'position:relative;flex-shrink:0';
  const plusBtn = document.createElement('button'); plusBtn.className = 'mic-btn'; plusBtn.style.cssText = 'width:36px;height:36px'; plusBtn.title = '上传文件 / 图片识别 / 批量 / 语音（真实或示例，二选一）'; plusBtn.innerHTML = '<i class="ti ti-plus"></i>';
  const menu = d(''); menu.id = 'aiChatImportMenu'; menu.style.cssText = 'display:none;position:absolute;bottom:42px;left:0;background:#fff;border:0.5px solid var(--line);border-radius:9px;box-shadow:0 8px 24px rgba(40,50,70,.16);padding:5px;z-index:20;min-width:170px';
  /* 真实 / 示例 二选一菜单（上传文件 · 图片OCR · 批量 · 语音）*/
  buildPlusMenu(menu, () => { menu.style.display = 'none'; });
  plusBtn.onclick = (e) => { e.stopPropagation(); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
  document.addEventListener('click', () => { const m = document.getElementById('aiChatImportMenu'); if (m) m.style.display = 'none'; });
  plusWrap.appendChild(plusBtn); plusWrap.appendChild(menu);
  /* 语音输入按钮 */
  const micBtn = document.createElement('button'); micBtn.className = 'mic-btn'; micBtn.id = 'aiChatMic'; micBtn.style.cssText = 'width:36px;height:36px;flex-shrink:0'; micBtn.title = '语音输入（说话实时转写，再点一下结束）'; micBtn.innerHTML = '<i class="ti ti-microphone"></i>'; micBtn.onclick = realVoice;
  const sendBtn = document.createElement('button'); sendBtn.className = 'mic-btn'; sendBtn.style.cssText = 'width:36px;height:36px;background:var(--clay);color:#fff;flex-shrink:0'; sendBtn.title = '发送'; sendBtn.innerHTML = '<i class="ti ti-send"></i>'; sendBtn.onclick = aiChatSubmit;
  inRow.appendChild(plusWrap); inRow.appendChild(ta); inRow.appendChild(micBtn); inRow.appendChild(sendBtn);
  chatCol.appendChild(inRow);
  /* 示例样本：放输入框下方，点选即填入并提取 */
  const exRow = d(''); exRow.style.cssText = 'padding:8px 12px 12px;background:var(--bg2);display:flex;flex-wrap:wrap;gap:6px;align-items:center';
  const exLbl = d(''); exLbl.style.cssText = 'font-size:11px;color:var(--ink3);margin-right:2px'; exLbl.textContent = '试试示例：'; exRow.appendChild(exLbl);
  AI_CHAT_EXAMPLES.forEach((exObj) => {
    const chip = document.createElement('button'); chip.className = 'mm-btn'; chip.style.cssText = 'font-size:11px;padding:4px 9px'; chip.innerHTML = '<i class="ti ti-quote" style="font-size:11px"></i>' + exObj.label;
    chip.onclick = () => {
      /* 把示例作为一条用户消息发出，AI 直接把完整字段填到右侧（无缺失）*/
      aiChatUser(exObj.text);
      aiChatFillFields(exObj.fields);
      aiChatBot('已识别并填入右侧全部关键字段，核对无误即可保存。');
    };
    exRow.appendChild(chip);
  });
  chatCol.appendChild(exRow);
  bodyWrap.appendChild(chatCol);

  /* 右：字段卡 + 保存 */
  const fieldCol = d(''); fieldCol.style.cssText = 'flex:1 1 0;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--bg2);overflow:hidden';
  fieldCol.id = 'aiFieldCol';
  bodyWrap.appendChild(fieldCol);

  panel.appendChild(bodyWrap);
  bg.appendChild(panel);
  document.querySelector('div[style*="position:relative"]').appendChild(bg);
  bg.onclick = (e) => { if (e.target === bg) closeEmbAiPanel(); };

  /* 字段卡渲染到右列（C 指向右列，使 renderField/字段回填作用其上）*/
  state.C = fieldCol;
  state.C.appendChild(mkFieldsCard());
  setTimeout(() => {
    promptCompletion();
    /* 让字段卡铺满右列：卡片 flex 撑高、字段滚动区自适应、底部条作为 flex 末项 */
    const fc = document.getElementById('fcCard'); if (fc) { fc.style.cssText = 'background:var(--card);border:none;border-radius:0;display:flex;flex-direction:column;flex:1 1 0;min-height:0;overflow:hidden'; }
    const fs = document.getElementById('fieldsScroll'); if (fs) { fs.style.height = 'auto'; fs.style.flex = '1 1 0'; fs.style.minHeight = '0'; fs.style.overflowY = 'scroll'; }
    const foot = document.getElementById('fcFoot');
    if (foot) { foot.style.position = 'static'; foot.style.flexShrink = '0'; const sb = foot.querySelector('.ab.primary'); if (sb) { sb.innerHTML = '<i class="ti ti-device-floppy" style="font-size:14px"></i> 保存线索'; sb.onclick = embSaveFromAi; } }
  }, 0);
  /* 不放开场白气泡，打开即干净对话区，用户直接描述或点示例 */
  setTimeout(() => { const i = document.getElementById('aiChatInput'); if (i) i.focus(); }, 50);
}

export function closeEmbAiPanel() {
  const m = document.getElementById('embAiPanelBg'); if (m) m.remove();
  state.C = state.C_MAIN;
  showLauncher();
}

/* 关闭后的启动卡 */
export function showLauncher() {
  state.C_MAIN.querySelectorAll('.app-launcher').forEach((e) => e.remove());
  const w = d('app-launcher');
  w.innerHTML = '<div class="al-card"><div class="al-ic"><i class="ti ti-sparkles"></i></div>' +
    '<div class="al-title">AI 智能录入</div>' +
    '<div class="al-sub">和 AI 对话录线索：可以一次说完，也可以让 AI 一项项问你。支持粘贴消息、上传文档 / 图片 / 名片、语音输入与批量导入。</div>' +
    '<button class="al-btn" onclick="openEmbAiPanel()"><i class="ti ti-arrow-right"></i>打开 AI 智能录入</button>' +
    (state.SAVED_LEADS.length ? '<div style="margin-top:14px"><button class="ab" onclick="openSavedLeads()">查看已保存的 ' + state.SAVED_LEADS.length + ' 条线索</button></div>' : '') +
    '</div>';
  state.C_MAIN.appendChild(w);
}
