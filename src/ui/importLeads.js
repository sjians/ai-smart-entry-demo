// ===== 批量导入数据与行编辑 =====
// 上传 → 进度 → 预览（可逐行补全缺失字段）→ 批量保存到列表。

import { d, esc } from '../core/dom.js';
import { IMPORT_DATA } from '../data/examples.js';
import { embLeadCompleteness } from '../core/completeness.js';
import { state } from '../state.js';
import { showToast, openSavedLeads } from './leads.js';
import { openEmbAiPanel } from './panel.js';
import { aiChatBot, aiChatActionButton } from './chat.js';

export function openImport() { const bg = document.getElementById('importBg'); bg.style.zIndex = 900; bg.classList.add('open'); }
export function closeImport() { document.getElementById('importBg').classList.remove('open'); document.getElementById('progWrap').style.display = 'none'; document.getElementById('progFill').style.width = '0%'; }

export function openImportRowEdit(dataIdx) {
  const row = IMPORT_DATA[dataIdx]; if (!row) return;
  const existing = document.getElementById('embRowEditModal'); if (existing) existing.remove();
  const bg = d('emb-panel-bg'); bg.id = 'embRowEditModal'; bg.style.zIndex = 960;
  const m = d('emb-panel'); m.style.width = '560px'; m.style.maxHeight = '85%';
  const ph = d('emb-panel-head');
  ph.innerHTML = '<div class="emb-panel-title"><i class="ti ti-pencil"></i>补全线索 #' + (dataIdx + 1) + ' · ' + esc(row.name || row.company) + '</div><div class="emb-panel-sub">' + (row.status === 'review' ? '该条信息较少，请确认/补充关键字段' : '补充缺失字段后状态将更新为已识别') + '</div>';
  const cx = document.createElement('button'); cx.className = 'emb-panel-close'; cx.innerHTML = '<i class="ti ti-x"></i> 关闭'; cx.onclick = () => bg.remove();
  ph.appendChild(cx); m.appendChild(ph);
  const body = d('emb-panel-body'); body.style.padding = '18px 20px';
  const grid = d(''); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px';
  const fields = [['name', '线索名称', 'text'], ['company', '公司', 'text'], ['contact', '联系人', 'text'], ['title', '职位', 'text'], ['budget', '预算', 'text'], ['industry', '行业', 'sel:制造业,ICT,金融,能源,汽车,医疗,政府,零售'], ['level', '线索级别', 'sel:A — 战略,B — 重点,C — 普通'], ['timeline', '时间计划', 'sel:是,否']];
  const inputs = {};
  fields.forEach(([k, label, type]) => {
    const isMissing = !row[k] || row[k] === '?';
    const w = d(''); w.innerHTML = '<label style="font-size:10px;color:' + (isMissing ? '#c0392b' : '#8794a4') + ';font-weight:500;text-transform:uppercase;letter-spacing:.4px">' + label + (isMissing ? ' · 缺失' : '') + '</label>';
    let el;
    if (type.startsWith('sel:')) {
      el = document.createElement('select'); const opts = type.slice(4).split(',');
      const o0 = document.createElement('option'); o0.value = ''; o0.textContent = '— 请选择 —'; el.appendChild(o0);
      opts.forEach((v) => { const o = document.createElement('option'); o.value = v; o.textContent = v; if (row[k] === v) o.selected = true; el.appendChild(o); });
    } else { el = document.createElement('input'); el.type = 'text'; el.value = (row[k] && row[k] !== '?') ? row[k] : ''; el.placeholder = '输入' + label; }
    el.style.cssText = 'width:100%;margin-top:4px;font-size:13px;padding:7px 10px;border:1px solid ' + (isMissing ? '#e09b9b' : '#d4d9e0') + ';border-radius:6px;font-family:inherit;outline:none;box-sizing:border-box';
    inputs[k] = el; w.appendChild(el); grid.appendChild(w);
  });
  body.appendChild(grid);
  const foot = d(''); foot.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
  const cancel = document.createElement('button'); cancel.className = 'crm-btn'; cancel.textContent = '取消'; cancel.onclick = () => bg.remove();
  const save = document.createElement('button'); save.className = 'crm-btn primary'; save.innerHTML = '<i class="ti ti-check" style="font-size:13px"></i> 保存补全';
  save.onclick = () => {
    Object.keys(inputs).forEach((k) => { row[k] = inputs[k].value.trim(); });
    const req = ['name', 'company', 'contact', 'title', 'budget', 'industry', 'level', 'timeline'];
    const miss = req.filter((k) => !row[k] || row[k] === '?');
    row.status = miss.length === 0 ? 'ok' : miss.length <= 2 ? 'partial' : 'review';
    bg.remove();
    renderEmbImportPreview();   /* 重渲染预览，状态标签随之更新 */
    showToast('已补全线索 #' + (dataIdx + 1) + '，状态已更新');
  };
  foot.appendChild(cancel); foot.appendChild(save); body.appendChild(foot);
  m.appendChild(body); bg.appendChild(m);
  const wrap = document.querySelector('div[style*="position:relative"]') || state.C; wrap.appendChild(bg);
  bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
}

export function mkStatusBadge(status) {
  if (status === 'ok') return '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:6px;background:var(--sage-lt);color:var(--sage-dk);font-weight:500"><i class="ti ti-check" style="font-size:10px"></i>已识别</span>';
  if (status === 'partial') return '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:6px;background:var(--sand-lt);color:var(--sand-dk);font-weight:500"><i class="ti ti-alert-triangle" style="font-size:10px"></i>部分缺失</span>';
  if (status === 'review') return '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:6px;background:var(--blush-lt);color:var(--blush-dk);font-weight:500"><i class="ti ti-eye" style="font-size:10px"></i>需确认</span>';
  return '';
}

/* 批量导入：进度 → 预览（独立版，盖在 AI 面板之上） */
export function runImport() {
  const pw = document.getElementById('progWrap'); const pf = document.getElementById('progFill');
  if (pw) pw.style.display = 'block'; let w = 0;
  const t = setInterval(() => {
    w += Math.random() * 15 + 8; if (w >= 100) {
      w = 100; clearInterval(t);
      setTimeout(() => { closeImport(); renderEmbImportPreview(); }, 400);
    }
    if (pf) pf.style.width = Math.round(w) + '%';
  }, 220);
}

export function renderEmbImportPreview() {
  const oldPv = document.getElementById('embImportBg'); if (oldPv) oldPv.remove();
  const bg = d('emb-panel-bg'); bg.id = 'embImportBg'; bg.style.cssText = 'position:absolute;inset:0;background:rgba(40,46,58,.45);display:flex;align-items:center;justify-content:center;z-index:820;padding:24px';
  const panel = d('emb-panel'); panel.style.width = '1100px'; panel.style.maxHeight = '90%';
  const ph = d('emb-panel-head');
  ph.innerHTML = '<div class="emb-panel-title"><i class="ti ti-database-import"></i>批量导入预览</div><div class="emb-panel-sub">AI 已完成字段映射，请确认后保存到列表</div>';
  const closeX = document.createElement('button'); closeX.className = 'emb-panel-close'; closeX.innerHTML = '<i class="ti ti-x"></i> 取消'; closeX.onclick = () => { bg.remove(); };
  ph.appendChild(closeX); panel.appendChild(ph);
  const body = d('emb-panel-body');
  const okN = IMPORT_DATA.filter((x) => x.status === 'ok').length;
  const fixN = IMPORT_DATA.filter((x) => x.status === 'partial' || x.status === 'review').length;
  const stat = d(''); stat.style.cssText = 'font-size:12px;color:#54606f;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap';
  stat.innerHTML = '共 ' + IMPORT_DATA.length + ' 条，其中 AI 识别完整 ' + okN + ' 条' + (fixN ? '<span style="color:#b8860b">· ' + fixN + ' 条需补全，点带「部分缺失 / 需确认」标签的行即可补充</span>' : ''); body.appendChild(stat);
  const cols = ['线索名称', '公司', '联系人', '职位', '预算', '行业', '级别', '状态'];
  const tpl = '1.6fr 1.2fr .8fr .9fr .8fr .8fr .9fr .9fr';
  const table = d('crm-table'); table.style.overflowX = 'auto';
  const thead = d('crm-thead'); thead.style.gridTemplateColumns = tpl;
  cols.forEach((h) => { const th = d('crm-th'); th.textContent = h; thead.appendChild(th); });
  table.appendChild(thead);
  IMPORT_DATA.forEach((row, ri) => {
    const tr = d('crm-trow'); tr.style.gridTemplateColumns = tpl;
    const needsFix = row.status === 'partial' || row.status === 'review';
    if (needsFix) { tr.style.cursor = 'pointer'; tr.title = '点击补全缺失字段'; tr.onmouseover = () => tr.style.background = '#fff8ef'; tr.onmouseout = () => tr.style.background = ''; }
    [row.name, row.company, row.contact || '—', row.title || '—', row.budget || '—', row.industry || '—', (row.level || '—'), ''].forEach((v, i) => {
      const td = d('crm-td');
      if (i === 7) { td.innerHTML = mkStatusBadge(row.status); }
      else td.textContent = v;
      tr.appendChild(td);
    });
    if (needsFix) tr.onclick = () => openImportRowEdit(ri);
    table.appendChild(tr);
  });
  body.appendChild(table);
  const foot = d(''); foot.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:16px';
  const cancel = document.createElement('button'); cancel.className = 'crm-btn'; cancel.textContent = '取消'; cancel.onclick = () => { bg.remove(); };
  const save = document.createElement('button'); save.className = 'crm-btn primary'; save.innerHTML = '<i class="ti ti-device-floppy" style="font-size:13px"></i> 保存到列表（' + IMPORT_DATA.length + ' 条）';
  save.onclick = () => { bg.remove(); submitImportBatch(); };
  foot.appendChild(cancel); foot.appendChild(save); body.appendChild(foot);
  panel.appendChild(body); bg.appendChild(panel);
  state.C_MAIN.appendChild(bg);
  bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
}

export function submitImportBatch() {
  const submitted = IMPORT_DATA.slice();
  if (!submitted.length) { showToast('当前没有可提交的线索'); return; }
  submitted.forEach((s) => {
    const nl = {
      name: s.name, company: s.company, customer: s.company,
      track: s.industry || '—', industry: s.industry || '—',
      contact: s.contact || '—', phone: s.phone || '—', owner: '凌杰',
      source: '批量导入', level: (s.level || 'B').charAt(0),
      status: s.status === 'ok' ? '已分发' : '草稿', budget: s.budget || '—',
      custLevel: '—', bidDeadline: '—',
      created: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    nl.pct = embLeadCompleteness(nl);
    state.SAVED_LEADS.unshift(nl);
  });
  IMPORT_DATA.length = 0;
  const eb = document.getElementById('embImportBg'); if (eb) eb.remove();
  if (!document.getElementById('embAiPanelBg')) { openEmbAiPanel(); }
  setTimeout(() => {
    aiChatBot('已批量导入 ' + submitted.length + ' 条线索并保存。可继续录入单条线索，或查看已保存记录。');
    aiChatActionButton('查看已保存的 ' + state.SAVED_LEADS.length + ' 条线索', openSavedLeads);
  }, 120);
}
