// ===== CRM 匹配 / AI 创建实体 =====
// 比对业主/联系人是否已存在于 CRM 客户库；未匹配时可「AI 创建」新客户 / 联系人并关联到本线索。

import { d, esc } from '../core/dom.js';
import { F, FL, FGROUPS } from '../data/fields.js';
import { CRM_CUSTOMERS, CRM_CONTACTS } from '../data/crm.js';
import { smartExtract } from '../core/smartExtract.js';
import { renderField, updatePct } from './fields.js';
import { showHint } from './leads.js';

/* ── CRM 自动匹配：比对业主/联系人是否已存在 ── */
export function checkCrmMatch() {
  if (F.owner) {
    const matched = CRM_CUSTOMERS.includes(F.owner);
    setMatchBadge('owner', matched, F.owner, '客户');
  }
  if (F.contact) {
    /* 在该业主名下查联系人 */
    let found = false;
    if (F.owner && CRM_CONTACTS[F.owner]) { found = CRM_CONTACTS[F.owner].includes(F.contact); }
    setMatchBadge('contact', found, F.contact, '联系人');
  }
}

export function setMatchBadge(key, matched, value, entityLabel) {
  const item = document.getElementById('fgi-' + key); if (!item) return;
  const old = item.querySelector('.match-badge'); if (old) old.remove();
  const badge = document.createElement('div'); badge.className = 'match-badge';
  if (matched) {
    badge.classList.add('matched');
    badge.innerHTML = '<i class="ti ti-circle-check"></i>CRM 已存在';
  } else {
    badge.classList.add('unmatched');
    badge.innerHTML = '<i class="ti ti-alert-circle"></i>未匹配到 · <span class="create-link">AI 创建' + entityLabel + '</span>';
    badge.querySelector('.create-link').onclick = (ev) => { ev.stopPropagation(); openCreateEntity(entityLabel, value); };
  }
  item.appendChild(badge);
}

/* ── AI 辅助创建新实体（粘贴一段话解析生成客户/联系人） ── */
export function openCreateEntity(entityLabel, prefillName) {
  const existing = document.getElementById('createEntityModal'); if (existing) existing.remove();
  const bg = d('import-bg'); bg.id = 'createEntityModal'; bg.style.zIndex = 1200; bg.classList.add('open');
  const m = document.createElement('div'); m.className = 'lvl-modal-content'; m.style.width = '480px';
  const isCust = entityLabel === '客户';
  m.innerHTML = `
    <div class="lvl-modal-h"><i class="ti ti-sparkles"></i>AI 创建新${entityLabel}</div>
    <div class="lvl-modal-sub">粘贴一段描述，AI 自动解析并生成${entityLabel}信息，无需跳转客户关系模块</div>
    <textarea id="ceInput" style="width:100%;min-height:80px;font-size:13px;padding:10px 12px;border:0.5px solid var(--line);border-radius:8px;font-family:inherit;color:var(--ink);background:var(--bg2);outline:none;resize:none" placeholder="例如：${isCust ? '鸿图智造集团，电力行业，总部上海，年营收80亿，国企' : '林志远，鸿图智造集团采购总监，电话13800000001，主要负责物探设备采购'}">${esc(prefillName || '')}</textarea>
    <div id="ceResult" style="margin-top:12px"></div>
    <div class="im-acts"><button class="ab" onclick="closeCreateEntity()">取消</button><button class="ab primary" id="ceParseBtn"><i class="ti ti-bolt" style="font-size:12px"></i> AI 解析生成</button></div>`;
  bg.appendChild(m);
  document.querySelector('div[style*="position:relative"]').appendChild(bg);
  bg.onclick = (ev) => { if (ev.target === bg) closeCreateEntity(); };
  document.getElementById('ceParseBtn').onclick = () => parseNewEntity(entityLabel);
  /* 打开即用本线索已识别字段自动解析展示（无需再点一次）*/
  setTimeout(() => parseNewEntity(entityLabel), 0);
}

export function parseNewEntity(entityLabel) {
  const inp = document.getElementById('ceInput'); if (!inp || !inp.value.trim()) return;
  const txt = inp.value.trim();
  const btn = document.getElementById('ceParseBtn'); if (btn) btn.textContent = '解析中…';
  setTimeout(() => {
    const ex = smartExtract(txt);
    const result = document.getElementById('ceResult');
    let fields = [];
    /* 客户与联系人都与图1 基本信息字段对齐：展示该线索所有已识别字段（有值的都带出），顺序同基本信息 */
    const order = FGROUPS[0].keys;
    order.forEach((k) => {
      if (k === 'followup') return; /* 跟进与创建客户/联系人无关 */
      let v = F[k] && String(F[k]).trim() ? F[k] : '';
      if (k === 'owner' && ex.owner) v = ex.owner;
      if (k === 'contact' && ex.contact) v = ex.contact;
      if (k === 'phone' && ex.phone) v = ex.phone;
      if (k === 'industry' && !v && ex.industry) v = ex.industry;
      if (k === 'address' && !v && ex.address) v = ex.address;
      if (v) fields.push([FL[k], v]);
    });
    if (entityLabel === '联系人' && ex.title) { fields.splice(2, 0, ['职位', ex.title]); }
    if (!fields.length) { fields = entityLabel === '客户' ? [['客户名称', ex.owner || '—']] : [['姓名', ex.contact || '—']]; }
    let html = '<div style="background:var(--sage-lt);border:0.5px solid var(--sage);border-radius:8px;padding:12px 14px;max-height:260px;overflow-y:auto"><div style="font-size:11px;color:var(--sage-dk);font-weight:600;margin-bottom:8px"><i class="ti ti-circle-check" style="font-size:12px"></i> AI 已解析出以下信息（与本线索基本信息字段对齐）</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    fields.forEach(([l, v]) => { html += '<div><span style="font-size:10px;color:var(--ink3)">' + esc(l) + '</span><div style="font-size:12px;color:var(--ink);font-weight:500">' + esc(v) + '</div></div>'; });
    html += '</div></div>';
    result.innerHTML = html;
    if (btn) {
      btn.textContent = ''; btn.innerHTML = '<i class="ti ti-check" style="font-size:12px"></i> 确认创建'; btn.onclick = () => {
        if (entityLabel === '客户') { const co = ex.owner || F.owner; if (co) { if (!CRM_CUSTOMERS.includes(co)) CRM_CUSTOMERS.push(co); F.owner = co; renderField('owner', co, 'ai'); setMatchBadge('owner', true, co, '客户'); } }
        if (entityLabel === '联系人') { const nm = ex.contact || F.contact; const co = ex.owner || F.owner; if (nm) { if (co) { if (!CRM_CONTACTS[co]) CRM_CONTACTS[co] = []; CRM_CONTACTS[co].push(nm); } F.contact = nm; renderField('contact', nm, 'ai'); } if (ex.phone) { F.phone = ex.phone; renderField('phone', ex.phone, 'ai'); } setMatchBadge('contact', true, nm, '联系人'); }
        updatePct(); closeCreateEntity();
        showHint(entityLabel + '「' + (ex.owner || F.owner || ex.contact || F.contact) + '」已创建并关联到本线索');
      };
    }
  }, 700);
}

export function closeCreateEntity() { const m = document.getElementById('createEntityModal'); if (m) m.remove(); }
