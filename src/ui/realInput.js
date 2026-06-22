// ===== 真实多模态录入 =====
// 与现有 mock 并存，让用户「二选一」体验真实功能：
//   · 真实上传文件（txt/pdf/docx）→ smartExtract 解析填字段
//   · 真实图片识别（百度 OCR，经 Cloudflare Worker 代理）→ 解析填字段
//   · 真实批量上传（csv/xlsx）→ 进现有预览/补全/保存流程
//   · 真实语音（浏览器 Web Speech API）→ 转写进输入框
// 第三方解析库（pdfjs/mammoth/xlsx）均按需懒加载，不拖慢首屏。

import { d } from '../core/dom.js';
import { F } from '../data/fields.js';
import { smartExtract } from '../core/smartExtract.js';
import { config } from '../config.js';
import { state } from '../state.js';
import { renderField, setCodeBadge, updatePct, promptCompletion, resetForNewDoc } from './fields.js';
import { checkCrmMatch } from './crmMatch.js';
import { aiChatBot, aiChatUser, aiChatDoc, aiChatImage } from './chat.js';
import { IMPORT_DATA } from '../data/examples.js';
import { renderEmbImportPreview, closeImport, openImport } from './importLeads.js';
import { showToast } from './leads.js';
import { fileKind, rowsToImportData, batchTemplateCsv } from '../core/fileParse.js';
import { openKnowledgePanel } from './knowledgePanel.js';

/* ---------- 通用：选文件 / 读取 ---------- */
export function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; if (accept) inp.accept = accept; inp.style.display = 'none';
    const finish = (f) => { resolve(f || null); setTimeout(() => { if (inp.parentNode) inp.parentNode.removeChild(inp); }, 0); };
    inp.onchange = () => finish(inp.files && inp.files[0]);
    inp.oncancel = () => finish(null);
    document.body.appendChild(inp); inp.click();
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result || ''); const i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s); };
    r.onerror = () => reject(new Error('读取图片失败'));
    r.readAsDataURL(file);
  });
}

/* ---------- 文档读取（懒加载 pdfjs / mammoth）---------- */
async function readPdfText(file) {
  const pdfjs = await import('pdfjs-dist');
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (_) { /* 退而求其次：让 pdfjs 用默认 worker */ }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let out = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    out += tc.items.map((it) => (it.str || '')).join(' ') + '\n';
  }
  return out.trim();
}

async function readDocxText(file) {
  const mod = await import('mammoth');
  const mammoth = mod.default || mod;
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return (res && res.value ? res.value : '').trim();
}

export async function readDocText(file) {
  const kind = fileKind(file.name);
  if (kind === 'text') return (await file.text()).trim();
  if (kind === 'pdf') return await readPdfText(file);
  if (kind === 'docx') return await readDocxText(file);
  if (kind === 'doc') throw new Error('暂不支持旧版 .doc，请在 Word 里「另存为」.docx 后再上传');
  if (kind === 'image') throw new Error('这是图片，请改用「图片识别」入口');
  if (kind === 'sheet') throw new Error('这是表格，请改用「批量导入」入口');
  return (await file.text()).trim(); /* unknown：兜底当文本读 */
}

/* ---------- 共享：把文本喂给抽取引擎并回填右侧字段 ---------- */
export function fillFromText(text) {
  const ex = smartExtract(text || '');
  let any = false;
  Object.keys(ex).forEach((k) => {
    if (k === '_codes') return;
    if (ex[k]) { F[k] = ex[k]; renderField(k, ex[k], 'ai'); any = true; }
  });
  if (ex._codes) { Object.keys(ex._codes).forEach((k) => { const info = ex._codes[k]; setCodeBadge(k, info.code, info.type, ex[k]); }); }
  updatePct(); checkCrmMatch(); promptCompletion();
  return any;
}

/* ---------- 1) 真实上传文件 → 解析 ---------- */
export async function realDoc() {
  const file = await pickFile('.txt,.md,.csv,.json,.pdf,.docx,.doc,text/plain');
  if (!file) return;
  aiChatUser('[上传文件] ' + file.name);
  aiChatBot('正在读取并解析《' + file.name + '》…');
  let text = '';
  try {
    text = await readDocText(file);
  } catch (err) {
    aiChatBot('解析未成功：' + (err && err.message ? err.message : '无法读取该文件') + '。也可以点「示例」先看效果。');
    return;
  }
  if (!text || !text.trim()) {
    aiChatBot('这个文件里没读到文字（可能是扫描件/纯图片 PDF）。如果内容是图片，请用「图片识别」。');
    return;
  }
  resetForNewDoc(); /* 每个上传文档视为一条全新线索：先清空，避免上一条/示例残留 */
  const any = fillFromText(text);
  if (any) aiChatBot('已从你上传的《' + file.name + '》真实解析并填入右侧字段，请核对，缺失项已红框标出。');
  else aiChatBot('读到了文字，但没匹配到明确字段，可在右侧手动补，或换一份信息更全的文件。');
}

/* ---------- 2) 真实图片识别（百度 OCR 代理）---------- */
export async function realImage() {
  const file = await pickFile('image/*');
  if (!file) return;
  aiChatUser('[图片识别] ' + file.name);
  const proxy = config.OCR_PROXY_URL;
  if (!proxy) {
    aiChatBot('真实图片识别还没配置（部署第二步后生效）。先用示例演示给你看效果：');
    setTimeout(() => aiChatImage(), 400);
    return;
  }
  aiChatBot('正在调用百度识别图片…');
  let text = '';
  try {
    const b64 = await fileToBase64(file);
    const resp = await fetch(proxy, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: b64 }) });
    if (!resp.ok) throw new Error('代理返回 ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error_msg || data.error);
    text = data.text || (Array.isArray(data.words_result) ? data.words_result.map((w) => w.words).join(' ') : '');
  } catch (err) {
    aiChatBot('图片识别失败：' + (err && err.message ? err.message : '网络错误') + '。可重试，或用「示例」。');
    return;
  }
  if (!text.trim()) { aiChatBot('没识别到文字，换一张更清晰、文字更大的图片试试。'); return; }
  aiChatBot('图片识别完成。提取到文字：' + text.slice(0, 100) + (text.length > 100 ? '…' : ''));
  resetForNewDoc(); /* 每张图片视为一条全新线索：先清空，避免上一条/示例残留 */
  const any = fillFromText(text);
  if (!any) aiChatBot('识别出文字了，但没匹配到明确字段，可在右侧手动补。');
}

/* ---------- 3) 真实批量上传（csv/xlsx）---------- */
export async function realBatch() {
  /* 不限定文件类型：csv/xlsx/xls/xlsm/xlsb/ods/dbf 等表格类均可解析；其它类型会优雅提示无数据行 */
  const file = await pickFile('');
  if (!file) return;
  showToast('正在解析《' + file.name + '》…');
  let rows = [];
  try {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } catch (err) {
    showToast('解析失败：' + (err && err.message ? err.message : '无法读取表格'));
    return;
  }
  const data = rowsToImportData(rows);
  if (!data.length) {
    showToast('没解析到数据行，请确认表头含：线索名称/公司/联系人/职位/预算/行业/级别/时间计划');
    return;
  }
  /* 用真实数据替换 IMPORT_DATA（共享引用），复用现有预览/补全/保存流程 */
  IMPORT_DATA.length = 0;
  data.forEach((r) => IMPORT_DATA.push(r));
  closeImport();
  renderEmbImportPreview();
}

/* 下载批量导入 CSV 模板（带 BOM，Excel 正确识别中文 UTF-8）*/
export function downloadBatchTemplate() {
  const csv = '﻿' + batchTemplateCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = '批量导入模板.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 0);
  showToast('已下载导入模板，填好后用「真实上传」导入');
}

/* ---------- 4) 真实语音（Web Speech API）---------- */
function mockVoice() {
  const inp = document.getElementById('aiChatInput'); if (!inp) return;
  const mic = document.getElementById('aiChatMic');
  if (mic) mic.innerHTML = '<i class="ti ti-loader-2"></i>';
  setTimeout(() => {
    if (mic) mic.innerHTML = '<i class="ti ti-microphone"></i>';
    const demo = '客户是天津钢铁集团，想上一套智能排产调度系统，制造业，预算1500万，联系人马总电话13800000006，重要客户，希望今年下半年启动';
    inp.value = demo; inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 160) + 'px'; inp.focus();
    aiChatBot('已填入示例语音转写文本，请检查后点发送。');
  }, 600);
}

export function realVoice() {
  const inp = document.getElementById('aiChatInput'); if (!inp) return;
  const mic = document.getElementById('aiChatMic');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    aiChatBot('当前浏览器不支持实时语音识别（建议用 Chrome / Edge）。先用示例语音演示：');
    mockVoice();
    return;
  }
  /* 已在录音 → 再点一下结束 */
  if (state.speechRec) { try { state.speechRec.stop(); } catch (_) {} return; }
  let rec;
  try { rec = new SR(); } catch (_) { aiChatBot('无法启动语音识别，改用示例。'); mockVoice(); return; }
  rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
  const baseText = inp.value ? inp.value.replace(/\s+$/, '') + ' ' : '';
  let finalText = '';
  state.speechRec = rec;
  if (mic) { mic.style.background = '#c0392b'; mic.style.color = '#fff'; mic.innerHTML = '<i class="ti ti-microphone-2"></i>'; mic.title = '正在听…点一下结束'; }
  inp.placeholder = '正在听…请说话，说完点一下麦克风结束';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    inp.value = baseText + finalText + interim;
    inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 160) + 'px';
  };
  rec.onerror = (e) => {
    const code = e && e.error;
    const msg = code === 'not-allowed' || code === 'service-not-allowed'
      ? '麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试'
      : '语音识别出错（' + code + '）';
    aiChatBot(msg + '。也可以用「示例语音」体验。');
  };
  rec.onend = () => {
    state.speechRec = null;
    if (mic) { mic.style.background = ''; mic.style.color = ''; mic.innerHTML = '<i class="ti ti-microphone"></i>'; mic.title = '语音输入'; }
    inp.placeholder = '直接描述线索，或回答 AI 的问题…';
    if ((baseText + finalText).trim()) { inp.focus(); aiChatBot('语音转写完成，已填入输入框，请检查后点发送。'); }
  };
  try { rec.start(); } catch (_) {}
}

/* ---------- 「+」菜单：真实 / 示例 二选一 ---------- */
function menuGroup(menu, title) {
  const h = d(''); h.style.cssText = 'font-size:9px;color:var(--ink3);text-transform:uppercase;letter-spacing:.6px;padding:9px 10px 3px;font-weight:600'; h.textContent = title; menu.appendChild(h);
}
function menuItem(menu, icon, label, tag, handler, onClose) {
  const it = d(''); it.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;font-size:12.5px;color:var(--ink);border-radius:6px;cursor:pointer';
  const tagHtml = tag === 'real'
    ? '<span style="margin-left:auto;font-size:8px;font-weight:700;color:#fff;background:var(--sage);border-radius:4px;padding:1px 6px;letter-spacing:.3px">真实</span>'
    : tag === 'mock'
      ? '<span style="margin-left:auto;font-size:8px;font-weight:600;color:var(--ink3);background:var(--bg);border:0.5px solid var(--line);border-radius:4px;padding:1px 6px;letter-spacing:.3px">示例</span>'
      : '';
  it.innerHTML = '<i class="ti ' + icon + '" style="font-size:15px;color:var(--clay-md)"></i><span>' + label + '</span>' + tagHtml;
  it.onmouseover = () => (it.style.background = 'var(--clay-lt)'); it.onmouseout = () => (it.style.background = '');
  it.onclick = (e) => { e.stopPropagation(); if (onClose) onClose(); handler(); };
  menu.appendChild(it);
}

/* 填充「+」导入菜单（分组：文件 / 图片OCR / 批量 / 语音，每组真实+示例）*/
export function buildPlusMenu(menu, onClose) {
  menu.innerHTML = '';
  menu.style.minWidth = '236px';
  menu.style.maxHeight = '340px';
  menu.style.overflowY = 'auto';

  menuGroup(menu, '上传文件 · 解析填字段');
  menuItem(menu, 'ti-file-upload', '上传文件（txt/pdf/word）', '', realDoc, onClose);
  menuItem(menu, 'ti-file-text', '招标说明书.pdf', 'mock', aiChatDoc, onClose);

  menuGroup(menu, '图片识别');
  menuItem(menu, 'ti-photo-up', '上传图片', '', realImage, onClose);
  menuItem(menu, 'ti-scan', '客户沟通截图.png', 'mock', aiChatImage, onClose);

  menuGroup(menu, '批量导入（多条）');
  menuItem(menu, 'ti-table-import', '上传文件（批量）', '', realBatch, onClose);
  menuItem(menu, 'ti-list-details', '12 条样例数据', 'mock', openImport, onClose);

  menuGroup(menu, '知识库 (RAG)');
  menuItem(menu, 'ti-books', '管理 / 上传到知识库', 'real', openKnowledgePanel, onClose);
}
