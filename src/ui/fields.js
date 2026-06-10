// ===== 字段预览卡 =====
// 构建右侧「字段预览」卡片，并提供字段渲染 / 完整度进度 / 缺失项红点标注 / 编码徽标 / 跳转定位等能力。

import { d, esc } from '../core/dom.js';
import { F, FKEYS, FL, FI, FGROUPS, SELS, KEY_FIELDS } from '../data/fields.js';
import { submitLead } from './leads.js';
import { openEditModal } from './modals.js';

/* ===== 字段卡 ===== */
export function mkFieldsCard() {
  const card = d('fields-card'); card.id = 'fcCard';
  const head = d('fc-head');
  head.innerHTML = '<span class="fc-hl"><i class="ti ti-layout-grid"></i>字段预览<span class="fc-meta" id="fcMissMeta"></span></span>';
  const pr = d('pct-row');
  pr.innerHTML = '<span class="pct-num" id="pctNum">0%</span><div class="pct-bar"><div class="pct-fill" id="pctFill" style="width:0%"></div></div>';
  head.appendChild(pr);
  card.appendChild(head);

  /* 缺失提示已合并进字段表单（红点/红框标注），不再单独一行 AI 助手 */
  const compSlot = d(''); compSlot.id = 'compSlot'; compSlot.style.display = 'none';
  card.appendChild(compSlot);

  /* 字段区域：内部滚动面板（右侧常显滚动条），完整可滚到最后一行 */
  const scrollWrap = d('fields-scroll'); scrollWrap.id = 'fieldsScroll';

  FGROUPS.forEach((group, gi) => {
    const gh = d('fg-group-head'); gh.style.cursor = 'pointer';
    gh.innerHTML = `<i class="ti ${group.icon}"></i>${group.name}<span class="fg-group-toggle"><i class="ti ti-chevron-up"></i></span>`;
    scrollWrap.appendChild(gh);
    const grid = d('fields-grid'); grid.id = 'fg-grid-' + gi;
    gh.onclick = () => {
      const collapsed = grid.style.display === 'none';
      grid.style.display = collapsed ? 'grid' : 'none';
      gh.querySelector('.fg-group-toggle i').className = collapsed ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
    };
    group.keys.forEach((k) => {
      const item = d('fg-item'); item.id = 'fgi-' + k;
      const top = d('fg-top');
      const lbl = d('fg-label'); lbl.innerHTML = `<i class="ti ${FI[k] || 'ti-point'}"></i>${FL[k]}`;
      top.appendChild(lbl);
      item.appendChild(top);
      /* 内联可编辑：下拉用 select，其余用 input，直接改 F[k]（不再点开弹窗）*/
      let ctrl;
      if (SELS[k]) {
        ctrl = document.createElement('select'); ctrl.className = 'fg-inp'; ctrl.id = 'fginp-' + k;
        const o0 = document.createElement('option'); o0.value = ''; o0.textContent = '请选择'; ctrl.appendChild(o0);
        SELS[k].forEach((v) => { const o = document.createElement('option'); o.value = v; o.textContent = v; ctrl.appendChild(o); });
        ctrl.value = F[k] || '';
        ctrl.onchange = () => { F[k] = ctrl.value; renderField(k, ctrl.value, 'manual'); updatePct(); };
      } else {
        ctrl = document.createElement('input'); ctrl.className = 'fg-inp'; ctrl.id = 'fginp-' + k;
        ctrl.placeholder = '请输入'; ctrl.value = F[k] || '';
        ctrl.oninput = () => { F[k] = ctrl.value; };
        ctrl.onchange = () => { renderField(k, ctrl.value, 'manual'); updatePct(); };
      }
      item.appendChild(ctrl);
      /* 隐藏的值容器，供 renderField/徽标逻辑复用（保持兼容）*/
      const val = d('fg-val'); val.id = 'fgv-' + k; val.style.display = 'none';
      item.appendChild(val);
      grid.appendChild(item);
    });
    const remainder = group.keys.length % 4;
    if (remainder !== 0) { for (let i = 0; i < 4 - remainder; i++) { const filler = d('fg-item fg-filler'); grid.appendChild(filler); } }
    scrollWrap.appendChild(grid);
  });
  card.appendChild(scrollWrap);

  const foot = d(''); foot.id = 'fcFoot';
  foot.style.cssText = 'padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--clay-md);background:var(--clay-lt);position:sticky;bottom:0;z-index:5;border-radius:0 0 12px 12px';
  const lefthint = d(''); lefthint.style.cssText = 'font-size:11px;color:var(--clay-dk);display:flex;align-items:center;gap:5px';
  lefthint.innerHTML = '<i class="ti ti-info-circle" style="font-size:12px"></i>确认字段后保存（无论是否匹配到 CRM 均可保存）';
  const btns = d(''); btns.style.cssText = 'display:flex;gap:8px;flex-shrink:0';
  const rb = document.createElement('button'); rb.className = 'ab'; rb.style.cssText = 'font-size:12px;padding:6px 14px'; rb.textContent = '重置'; rb.onclick = resetFields;
  const sb = document.createElement('button'); sb.className = 'ab primary'; sb.style.cssText = 'font-size:12.5px;padding:6px 16px;box-shadow:0 2px 8px rgba(176,128,96,.3)'; sb.innerHTML = '<i class="ti ti-device-floppy" style="font-size:13px"></i> 保存线索'; sb.onclick = submitLead;
  btns.appendChild(rb); btns.appendChild(sb);
  foot.appendChild(lefthint); foot.appendChild(btns);
  card.appendChild(foot);
  /* 初始渲染常驻 AI 助手 */
  setTimeout(() => promptCompletion(), 0);
  return card;
}

/* ===== 字段渲染 ===== */
export function renderField(k, v, src) {
  const item = document.getElementById('fgi-' + k); const val = document.getElementById('fgv-' + k); if (!item || !val) return;
  /* 同步内联可编辑控件的值（AI 提取后直接显示在输入框里，用户可继续改）*/
  const ctrl = document.getElementById('fginp-' + k);
  if (ctrl) ctrl.value = v || '';
  if (v) {
    item.classList.remove('needs'); item.classList.add('filled');
    val.className = 'fg-val ai-val';
    val.innerHTML = (src === 'ai' ? '<span class="ai-spark"><i class="ti ti-sparkles"></i></span>' : '') + esc(v);
    if (src === 'ai' && ctrl) { ctrl.style.borderColor = 'var(--sage)'; ctrl.style.background = 'var(--sage-lt)'; }
  } else {
    item.className = 'fg-item'; val.className = 'fg-val'; val.textContent = '未填写';
    if (ctrl) { ctrl.style.borderColor = ''; ctrl.style.background = ''; }
  }
}

export function updatePct() {
  const n = FKEYS.filter((k) => F[k]).length; const p = Math.round(n / FKEYS.length * 100);
  const pf = document.getElementById('pctFill'); const pn = document.getElementById('pctNum');
  if (pf) pf.style.width = p + '%'; if (pn) pn.textContent = p + '%';
}

export function resetFields() {
  FKEYS.forEach((k) => { F[k] = ''; renderField(k, '', 'manual'); }); updatePct();
  document.querySelectorAll('.quickfill').forEach((e) => e.remove());
  document.querySelectorAll('.confirm-card').forEach((e) => e.remove());
  promptCompletion();
}

/* 上传新文档/图片前清空表单：每个文档代表一条全新线索，避免上一条/示例的字段残留造成「张冠李戴」 */
export function resetForNewDoc() {
  resetFields();
  document.querySelectorAll('.match-badge,.code-badge').forEach((e) => e.remove());
}

/* ===== 编码徽标 ===== */
export function setCodeBadge(key, code, codeType, displayVal) {
  const item = document.getElementById('fgi-' + key); if (!item) return;
  const valEl = document.getElementById('fgv-' + key); if (!valEl) return;
  /* 移除旧徽标 */
  const oldB = valEl.querySelector('.code-badge'); if (oldB) oldB.remove();
  const badge = document.createElement('span'); badge.className = 'code-badge';
  badge.title = codeType + ' ' + code + ' → ' + displayVal;
  badge.innerHTML = '<i class="ti ti-arrows-exchange" style="font-size:10px"></i> ' + esc(code);
  valEl.appendChild(badge);
}

/* ── 多轮交互补全：在缺失的关键字段上加红点/红框标注 ── */
export function promptCompletion() {
  /* 不再渲染独立 AI 助手块；在缺失的关键字段上加红点/红框标注 */
  const slot = document.getElementById('compSlot'); if (slot) { slot.innerHTML = ''; slot.style.display = 'none'; }
  const missing = KEY_FIELDS.filter(([k]) => !F[k]);
  /* 先清掉所有字段的缺失标记 */
  KEY_FIELDS.forEach(([k]) => {
    const item = document.getElementById('fgi-' + k); if (!item) return;
    item.classList.remove('fg-missing');
    const lbl = item.querySelector('.fg-label'); if (lbl) { const dot = lbl.querySelector('.fg-req-dot'); if (dot) dot.remove(); }
    const ctrl = document.getElementById('fginp-' + k); if (ctrl && !F[k]) { ctrl.style.borderColor = ''; }
  });
  /* 给缺失的关键字段打红点 + 红框 */
  missing.forEach(([k, l]) => {
    const item = document.getElementById('fgi-' + k); if (!item) return;
    item.classList.add('fg-missing');
    const lbl = item.querySelector('.fg-label');
    if (lbl && !lbl.querySelector('.fg-req-dot')) {
      const dot = document.createElement('span'); dot.className = 'fg-req-dot'; dot.title = '必填项尚未填写'; lbl.appendChild(dot);
    }
    const ctrl = document.getElementById('fginp-' + k); if (ctrl && !F[k]) { ctrl.style.borderColor = '#e09b9b'; }
  });
  /* 缺失字段已用红点/红框标出，不再显示「还差 N 项」计数文字 */
  const meta = document.getElementById('fcMissMeta');
  if (meta) meta.innerHTML = '';
}

/* 点击缺失标签：滚动到该字段、高亮闪烁、打开编辑器 */
export function jumpToField(k) {
  const item = document.getElementById('fgi-' + k);
  if (!item) return;
  /* 确保字段所在分组是展开的 */
  const grid = item.closest('.fields-grid');
  if (grid && grid.style.display === 'none') {
    grid.style.display = 'grid';
    const gh = grid.previousElementSibling;
    if (gh && gh.querySelector('.fg-group-toggle i')) gh.querySelector('.fg-group-toggle i').className = 'ti ti-chevron-up';
  }
  /* 滚动到可视区并高亮 */
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  item.classList.add('fg-flash');
  setTimeout(() => item.classList.remove('fg-flash'), 1600);
  /* 稍后打开编辑器 */
  setTimeout(() => openEditModal(k), 400);
}
