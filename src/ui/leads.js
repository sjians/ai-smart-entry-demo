// ===== 线索保存 / Toast / 提示条 / 已保存列表 =====
// 独立化适配层：替换原嵌入式 CRM 宿主依赖，把 AI 录入结果保存在本地会话内。

import { d, esc } from '../core/dom.js';
import { F, FKEYS } from '../data/fields.js';
import { embLeadCompleteness } from '../core/completeness.js';
import { state } from '../state.js';
import { renderField, updatePct, promptCompletion } from './fields.js';
import { aiChatBot, aiChatActionButton } from './chat.js';

/* ===== 独立化适配层（替换原嵌入式 CRM 宿主依赖） ===== */
export function submitLead() { embSaveFromAi(); }

/* 缺失关键字段时刷新「快速补全」条（独立版无 qfBar，恒早退；保留以兼容原逻辑） */
export function refreshQuickFill() {
  const qf = document.getElementById('qfBar'); if (!qf) return;
  const critical = ['industry', 'timeline', 'budget', 'followup'];
  const miss = critical.filter((k) => !F[k]);
  if (!miss.length) { qf.remove(); return; }
  qf.remove();
}

/* 在字段卡上方插入一条临时提示，5 秒后自动消失 */
export function showHint(msg) {
  const el = d('hint-strip'); el.innerHTML = `<i class="ti ti-info-circle"></i>${esc(msg)}`;
  const fc = document.getElementById('fcCard'); if (fc) state.C.insertBefore(el, fc); else state.C.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/* 浮动 Toast */
export function showToast(msg) {
  const old = document.getElementById('stdToast'); if (old) old.remove();
  const t = d('std-toast'); t.id = 'stdToast';
  t.innerHTML = '<i class="ti ti-circle-check"></i>' + esc(msg);
  state.C_MAIN.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2600);
}

/* AI 录入后保存：写入本地已保存列表，清空表单准备下一条，保留对话历史 */
export function embSaveFromAi() {
  const pick = (k) => F[k] && String(F[k]).trim() ? String(F[k]).trim() : '';
  const company = pick('owner');
  const name = pick('name') || (company ? company + '—新线索' : '');
  if (!company && !name) { showToast('请先描述线索或填写客户 / 线索名称'); return; }
  const nl = {
    name: name || '未命名线索',
    company: company || '—', customer: company || '—',
    track: pick('productCat') || '—', industry: pick('industry') || '—',
    contact: pick('contact') || '—', phone: pick('phone') || '—', owner: '凌杰',
    source: pick('source') || '销售自拓', level: pick('level') ? pick('level').charAt(0) : 'B',
    status: '草稿', budget: pick('budget') || '—',
    custLevel: pick('custLevel') || '—', bidDeadline: pick('bidDeadline') || '—',
    created: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  nl.pct = embLeadCompleteness(nl);
  state.SAVED_LEADS.unshift(nl);
  FKEYS.forEach((k) => { F[k] = ''; renderField(k, '', 'manual'); });
  document.querySelectorAll('.match-badge,.code-badge').forEach((e) => e.remove());
  updatePct(); promptCompletion();
  aiChatBot('线索「' + nl.name + '」已保存（本次已保存 ' + state.SAVED_LEADS.length + ' 条）。右侧表单已清空，可继续录入下一条线索。');
  aiChatActionButton('查看已保存的 ' + state.SAVED_LEADS.length + ' 条线索', openSavedLeads);
  showToast('线索已保存');
}

/* 已保存线索预览 */
export function openSavedLeads() {
  const existing = document.getElementById('savedLeadsBg'); if (existing) existing.remove();
  const bg = d('emb-panel-bg'); bg.id = 'savedLeadsBg'; bg.style.cssText = 'position:absolute;inset:0;background:rgba(40,46,58,.45);display:flex;align-items:center;justify-content:center;z-index:1300;padding:24px';
  const panel = d('emb-panel'); panel.style.width = '1000px'; panel.style.maxHeight = '86%';
  const ph = d('emb-panel-head');
  ph.innerHTML = '<div class="emb-panel-title"><i class="ti ti-list-details"></i>已保存的线索</div><div class="emb-panel-sub">本次会话通过 AI 智能录入保存的线索</div>';
  const cx = document.createElement('button'); cx.className = 'emb-panel-close'; cx.innerHTML = '<i class="ti ti-x"></i> 关闭'; cx.onclick = () => bg.remove();
  ph.appendChild(cx); panel.appendChild(ph);
  const body = d('emb-panel-body');
  if (!state.SAVED_LEADS.length) { body.innerHTML = '<div style="padding:48px;text-align:center;color:var(--ink3);font-size:13px">还没有保存任何线索</div>'; }
  else {
    const cols = ['线索名称', '客户 / 业主', '联系人', '电话', '行业', '预算', '级别', '完整度'];
    const tpl = '1.8fr 1.4fr .8fr 1fr .8fr .9fr .6fr .8fr';
    const table = d('crm-table'); table.style.overflowX = 'auto';
    const thead = d('crm-thead'); thead.style.gridTemplateColumns = tpl;
    cols.forEach((h) => { const th = d('crm-th'); th.textContent = h; thead.appendChild(th); });
    table.appendChild(thead);
    state.SAVED_LEADS.forEach((l) => {
      const tr = d('crm-trow'); tr.style.gridTemplateColumns = tpl;
      [l.name, l.company, l.contact, l.phone, l.industry, l.budget, l.level, l.pct + '%'].forEach((v) => { const td = d('crm-td'); td.textContent = v; tr.appendChild(td); });
      table.appendChild(tr);
    });
    body.appendChild(table);
  }
  panel.appendChild(body); bg.appendChild(panel);
  state.C_MAIN.appendChild(bg);
  bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
}
