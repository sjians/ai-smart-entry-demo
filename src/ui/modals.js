// ===== 字段编辑弹窗 / 分级标准 / 编码对照 =====

import { d, esc } from '../core/dom.js';
import { F, FL, FI, SELS } from '../data/fields.js';
import { LEVEL_CRITERIA, FULL_LEVEL_CRITERIA } from '../data/criteria.js';
import { INDUSTRY_CODE_MAP, CUSTLEVEL_CODE_MAP } from '../data/codeMaps.js';
import { state } from '../state.js';
import { renderField, updatePct, promptCompletion } from './fields.js';
import { refreshQuickFill } from './leads.js';

export function openEditModal(k) {
  state.editingKey = k;
  /* 编辑弹窗需盖在 AI 录入浮层（z-index 700）之上，否则点字段弹窗在浮层背后看不见 */
  const emBg = document.getElementById('editModalBg'); emBg.style.zIndex = 1200;
  document.getElementById('emTitle').textContent = '编辑：' + FL[k];
  document.getElementById('emIcon').className = 'ti ' + (FI[k] || 'ti-point');
  const body = document.getElementById('emBody'); body.innerHTML = '';
  let inp;
  if (SELS[k]) {
    inp = document.createElement('select'); inp.className = 'em-inp'; inp.id = 'emInp';
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = '— 请选择 —'; inp.appendChild(empty);
    SELS[k].forEach((v) => { const o = document.createElement('option'); o.value = v; o.textContent = v; inp.appendChild(o); });
    if (F[k]) inp.value = F[k];
  } else {
    inp = document.createElement('input'); inp.className = 'em-inp'; inp.id = 'emInp';
    inp.placeholder = '输入' + FL[k] + '…'; inp.value = F[k] || '';
    inp.onkeydown = (e) => { if (e.key === 'Enter') saveEditModal(); if (e.key === 'Escape') closeEditModal(); };
  }
  body.appendChild(inp);

  /* 如果是线索级别字段，展示判定标准 */
  if (k === 'level') {
    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:4px;margin-bottom:8px;padding:10px 12px;background:var(--bg2);border-radius:7px;border:0.5px solid var(--line2)';
    let html = '<div style="font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:500">判定标准</div>';
    Object.entries(LEVEL_CRITERIA).forEach(([lvl, cfg]) => {
      const letter = lvl.charAt(0);
      html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;font-size:11px"><span style="font-weight:600;color:' + cfg.fg + ';background:' + cfg.bg + ';padding:1px 6px;border-radius:4px;min-width:18px;text-align:center">' + letter + '</span><span style="color:var(--ink2)">' + cfg.desc + '</span></div>';
    });
    hint.innerHTML = html;
    body.appendChild(hint);
  }

  document.getElementById('editModalBg').classList.add('open');
  setTimeout(() => inp.focus(), 60);
}

/* 弹出"线索分级标准"全屏说明 */
export function showLevelCriteria(ev) {
  ev && ev.stopPropagation();
  const existing = document.getElementById('lvlCritModal');
  if (existing) { existing.remove(); return; }
  const bg = d('import-bg'); bg.id = 'lvlCritModal'; bg.style.zIndex = 500; bg.classList.add('open');
  const m = document.createElement('div'); m.className = 'lvl-modal-content';
  let html = '<div class="lvl-modal-h"><i class="ti ti-star"></i>线索分级标准</div>';
  html += '<div class="lvl-modal-sub">用于快速判断线索的战略价值与资源投入优先级</div>';
  FULL_LEVEL_CRITERIA.forEach((c) => {
    html += '<div class="lvl-row ' + c.lvl + '"><div class="lvl-row-badge">' + c.lvl + ' 级</div><div class="lvl-row-body"><div class="lvl-row-title">' + c.name + '</div><div class="lvl-row-desc">' + c.desc + '</div></div></div>';
  });
  html += '<div class="lvl-modal-foot"><i class="ti ti-bulb" style="font-size:11px;margin-right:3px"></i>AI 提取时会根据预算和文本关键词（"战略大客户"、"标杆项目"等）自动建议级别，用户可手动调整。</div>';
  html += '<div class="im-acts"><button class="ab primary" onclick="closeLevelCriteria()">了解</button></div>';
  m.innerHTML = html;
  bg.appendChild(m);
  document.querySelector('div[style*="position:relative"]').appendChild(bg);
  bg.onclick = (e) => { if (e.target === bg) closeLevelCriteria(); };
}
export function closeLevelCriteria() { const m = document.getElementById('lvlCritModal'); if (m) m.remove(); }

/* 弹出"编码对照表"说明：展示系统支持的编码→显示值映射 */
export function showCodeMap(ev) {
  ev && ev.stopPropagation();
  const existing = document.getElementById('codeMapModal');
  if (existing) { existing.remove(); return; }
  const bg = d('import-bg'); bg.id = 'codeMapModal'; bg.style.zIndex = 500; bg.classList.add('open');
  const m = document.createElement('div'); m.className = 'lvl-modal-content'; m.style.width = '520px'; m.style.maxHeight = '82vh'; m.style.overflowY = 'auto';
  let html = '<div class="lvl-modal-h"><i class="ti ti-arrows-exchange"></i>编码对照表</div>';
  html += '<div class="lvl-modal-sub">Agent 与业务系统编码体系保持一致，自动将数据库编码 / 业务对象引用转换为可读显示值</div>';
  /* 行业编码表 */
  html += '<div style="font-size:11px;font-weight:600;color:var(--ink2);margin:14px 0 6px;text-transform:uppercase;letter-spacing:.5px"><i class="ti ti-category" style="font-size:12px;color:var(--clay-md);margin-right:4px"></i>行业编码</div>';
  html += '<div class="codemap-grid">';
  Object.entries(INDUSTRY_CODE_MAP).forEach(([code, val]) => {
    html += '<div class="codemap-item"><span class="codemap-code">' + code + '</span><i class="ti ti-arrow-right" style="font-size:11px;color:var(--ink3)"></i><span class="codemap-val">' + esc(val) + '</span></div>';
  });
  html += '</div>';
  /* 客户等级编码表 */
  html += '<div style="font-size:11px;font-weight:600;color:var(--ink2);margin:16px 0 6px;text-transform:uppercase;letter-spacing:.5px"><i class="ti ti-award" style="font-size:12px;color:var(--clay-md);margin-right:4px"></i>客户等级编码</div>';
  html += '<div class="codemap-grid">';
  Object.entries(CUSTLEVEL_CODE_MAP).forEach(([code, val]) => {
    html += '<div class="codemap-item"><span class="codemap-code">' + code + '</span><i class="ti ti-arrow-right" style="font-size:11px;color:var(--ink3)"></i><span class="codemap-val">' + esc(val) + '</span></div>';
  });
  html += '</div>';
  html += '<div class="lvl-modal-foot"><i class="ti ti-bulb" style="font-size:11px;margin-right:3px"></i>当输入或导入的数据包含编码（如「行业编码01」「客户等级A」），AI 会自动转换为显示值，并在字段值旁标注来源编码（紫色徽标）。可在「查看示例 · 系统对接数据」中体验。</div>';
  html += '<div class="im-acts"><button class="ab primary" onclick="closeCodeMap()">了解</button></div>';
  m.innerHTML = html;
  bg.appendChild(m);
  document.querySelector('div[style*="position:relative"]').appendChild(bg);
  bg.onclick = (e) => { if (e.target === bg) closeCodeMap(); };
}
export function closeCodeMap() { const m = document.getElementById('codeMapModal'); if (m) m.remove(); }

export function closeEditModal() { document.getElementById('editModalBg').classList.remove('open'); state.editingKey = null; }

export function saveEditModal() {
  const inp = document.getElementById('emInp'); if (!inp || !state.editingKey) return;
  const v = inp.value.trim(); F[state.editingKey] = v;
  renderField(state.editingKey, v, 'manual'); updatePct();
  refreshQuickFill();
  promptCompletion();
  closeEditModal();
}
