// ===== 知识库 (RAG) 管理面板 =====
// 给客户一个直观的窗口：看预置语料、上传自己的资料、并「试检索」一句话立刻看到命中片段，
// 直观证明「AI 录入背后真的在查知识库」。

import { d, esc } from '../core/dom.js';
import { state } from '../state.js';
import { kbStats, getAllChunks, listSources, removeUploadedSource, addDocument, retrieve } from '../agent/knowledge.js';
import { pickFile, readDocText } from './realInput.js';
import { showToast } from './leads.js';

const CAT_ICON = { 产品: 'ti-box', 方案: 'ti-bulb', 案例: 'ti-award', 政策: 'ti-gavel', 上传: 'ti-file-text' };

export function openKnowledgePanel() {
  const existing = document.getElementById('kbPanelBg'); if (existing) existing.remove();
  const bg = d('emb-panel-bg'); bg.id = 'kbPanelBg';
  bg.style.cssText = 'position:absolute;inset:0;background:rgba(40,46,58,.45);display:flex;align-items:center;justify-content:center;z-index:1300;padding:24px';
  const panel = d('emb-panel'); panel.style.width = '880px'; panel.style.maxHeight = '88%'; panel.style.display = 'flex'; panel.style.flexDirection = 'column';
  const ph = d('emb-panel-head');
  ph.innerHTML = '<div class="emb-panel-title"><i class="ti ti-books"></i>知识库 (RAG)</div><div class="emb-panel-sub">录线索时 AI 会检索这里的产品 / 方案 / 案例 / 政策来辅助理解与补全</div>';
  const cx = document.createElement('button'); cx.className = 'emb-panel-close'; cx.innerHTML = '<i class="ti ti-x"></i> 关闭'; cx.onclick = () => bg.remove();
  ph.appendChild(cx); panel.appendChild(ph);

  const body = d('emb-panel-body'); body.id = 'kbPanelBody'; body.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:16px 20px';
  panel.appendChild(body); bg.appendChild(panel);
  state.C_MAIN.appendChild(bg);
  bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
  renderBody(body);
}

function renderBody(body) {
  const st = kbStats();
  body.innerHTML = '';

  /* —— 统计 + 上传 —— */
  const bar = d('');
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px';
  bar.innerHTML =
    '<div style="font-size:12px;color:var(--ink2)">共 <b>' + st.total + '</b> 段（预置 ' + st.seed + ' · 上传 ' + st.uploaded + '）</div>'
    + '<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:5px;color:var(--sage-dk);background:var(--sage-lt)">' + esc(st.mode) + '</span>';
  const up = document.createElement('button'); up.className = 'crm-btn primary'; up.style.cssText = 'font-size:12px;padding:6px 12px;margin-left:auto';
  up.innerHTML = '<i class="ti ti-upload" style="font-size:13px"></i> 上传资料（txt/pdf/word）';
  up.onclick = () => doUpload(body);
  bar.appendChild(up);
  body.appendChild(bar);

  /* —— 试检索 —— */
  const tryBox = d(''); tryBox.style.cssText = 'background:var(--bg2);border:0.5px solid var(--line);border-radius:10px;padding:12px;margin-bottom:16px';
  tryBox.innerHTML = '<div style="font-size:11px;color:var(--ink3);margin-bottom:6px"><i class="ti ti-search" style="font-size:12px"></i> 试检索：输入一句话，看 AI 会查到哪些知识（例：客户要做储能并网检测 / 汽车产线质检 / 我们折扣能给多少）</div>';
  const rowq = d(''); rowq.style.cssText = 'display:flex;gap:8px';
  const qi = document.createElement('input'); qi.className = 'fg-inp'; qi.placeholder = '输入要检索的内容…'; qi.style.cssText = 'flex:1;font-size:13px;padding:7px 10px;border:0.5px solid var(--line);border-radius:7px;outline:none';
  const qb = document.createElement('button'); qb.className = 'crm-btn'; qb.style.cssText = 'font-size:12px;padding:6px 14px'; qb.textContent = '检索';
  const res = d(''); res.style.cssText = 'margin-top:10px';
  const run = () => doTestSearch(qi.value.trim(), res);
  qb.onclick = run; qi.onkeydown = (e) => { if (e.key === 'Enter') run(); };
  rowq.appendChild(qi); rowq.appendChild(qb);
  tryBox.appendChild(rowq); tryBox.appendChild(res);
  body.appendChild(tryBox);

  /* —— 已上传来源（可删） —— */
  const sources = listSources();
  if (sources.length) {
    const sh = d(''); sh.style.cssText = 'font-size:11px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;margin:6px 0 8px'; sh.textContent = '我上传的资料';
    body.appendChild(sh);
    sources.forEach((s) => {
      const it = d(''); it.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;border:0.5px solid var(--line);border-radius:8px;margin-bottom:6px;font-size:12px';
      it.innerHTML = '<i class="ti ti-file-text" style="color:var(--clay-md)"></i><span style="flex:1">' + esc(s.source) + '</span><span style="color:var(--ink3);font-size:11px">' + s.count + ' 段</span>';
      const del = document.createElement('button'); del.className = 'ab'; del.style.cssText = 'font-size:11px;padding:3px 8px'; del.innerHTML = '<i class="ti ti-trash" style="font-size:12px"></i>';
      del.onclick = () => { removeUploadedSource(s.source); showToast('已移除《' + s.source + '》'); renderBody(body); };
      it.appendChild(del); body.appendChild(it);
    });
  }

  /* —— 预置语料一览 —— */
  const seedHead = d(''); seedHead.style.cssText = 'font-size:11px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px'; seedHead.textContent = '预置示例语料';
  body.appendChild(seedHead);
  const grid = d(''); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
  getAllChunks().filter((c) => c.source === 'seed').forEach((c) => {
    const card = d(''); card.style.cssText = 'border:0.5px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--card)';
    card.innerHTML = '<div style="font-size:12px;font-weight:600;color:var(--ink);margin-bottom:3px"><i class="ti ' + (CAT_ICON[c.cat] || 'ti-point') + '" style="font-size:12px;color:var(--clay-md);margin-right:4px"></i>' + esc(c.title) + ' <span style="font-size:9px;color:var(--ink3);font-weight:400">· ' + esc(c.cat) + '</span></div><div style="font-size:11px;color:var(--ink2);line-height:1.5">' + esc(c.text.length > 90 ? c.text.slice(0, 90) + '…' : c.text) + '</div>';
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

async function doUpload(body) {
  const file = await pickFile('.txt,.md,.csv,.json,.pdf,.docx,.doc,text/plain');
  if (!file) return;
  showToast('正在读取《' + file.name + '》…');
  let text = '';
  try { text = await readDocText(file); } catch (e) { showToast('读取失败：' + (e && e.message ? e.message : '无法读取')); return; }
  if (!text || !text.trim()) { showToast('没读到文字（可能是扫描件，请用图片识别）'); return; }
  const { added } = await addDocument(file.name, text);
  showToast(added ? '已加入知识库：' + added + ' 段' : '没有可入库的内容');
  renderBody(body);
}

async function doTestSearch(q, res) {
  if (!q) { res.innerHTML = ''; return; }
  res.innerHTML = '<div style="font-size:12px;color:var(--ink3)"><i class="ti ti-loader-2 ti-spin"></i> 检索中…</div>';
  let hits = [];
  try { hits = await retrieve(q, 5); } catch (_) { hits = []; }
  if (!hits.length) { res.innerHTML = '<div style="font-size:12px;color:var(--ink3)">没命中相关内容，换个更贴近产品/方案/案例的说法试试。</div>'; return; }
  res.innerHTML = hits.map((h) =>
    '<div style="border:0.5px solid var(--sage);background:var(--sage-lt);border-radius:8px;padding:8px 10px;margin-bottom:6px">'
    + '<div style="font-size:11px;font-weight:600;color:var(--sage-dk)"><i class="ti ' + (CAT_ICON[h.cat] || 'ti-point') + '" style="font-size:12px"></i> [' + esc(h.cat) + '] ' + esc(h.title) + ' · ' + Math.round(h.score * 100) + '%</div>'
    + '<div style="font-size:11px;color:var(--ink2);line-height:1.5;margin-top:3px">' + esc(h.text.length > 120 ? h.text.slice(0, 120) + '…' : h.text) + '</div></div>'
  ).join('');
}
