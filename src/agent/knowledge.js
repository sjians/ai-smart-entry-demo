// ===== 手搓 RAG · 知识库检索引擎 =====
// 纯前端「手搓」检索：在浏览器里用「关键词/双字匹配」对知识库片段打分排序，命中片段由
// agentLoop 注入提示词，让大模型「有据可依」地补全字段 / 回答能力问题。
//
// 为什么用关键词检索而不是向量检索：
//   实测 Cloudflare Workers AI 的免费中文向量模型(bge-m3)在「短句」上区分度极差——
//   不相关的闲聊句子余弦相似度反而比相关产品条目更高（各条都挤在 0.88~0.99）。
//   对「领域词清晰」的销售知识库，关键词检索更准、且零成本/离线/确定。
//   （Worker 仍保留 /embed 路由，将来要接更强的付费 embedding（通义/智谱/OpenAI）可平滑切换。）

import { KB_SEED } from '../data/knowledge.js';

const LS_UPLOADED = 'KB_UPLOADED'; // 用户上传的片段（[{id,cat,title,text,source}]）
const LEX_MIN = 0.06;              // 关键词检索阈值，低于视为不相关

/* ---------------- 纯函数（可单测，无 DOM / 无网络） ---------------- */

/* 余弦相似度（保留：将来接入可用的 embedding 时复用） */
export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* 分词：中文按「相邻双字」(bigram) + 拉丁/数字按词，统一小写 */
export function tokenize(s) {
  const str = String(s || '').toLowerCase();
  const tokens = [];
  tokens.push(...(str.match(/[a-z0-9]+/g) || []));
  const han = str.match(/[一-龥]/g) || [];
  for (let i = 0; i < han.length - 1; i++) tokens.push(han[i] + han[i + 1]);
  if (han.length === 1) tokens.push(han[0]);
  return tokens;
}

/* 关键词相似度：双字/词「精确命中」为主(0.75)，单字「召回」为辅(0.25)，返回 0–1 */
export function lexicalScore(query, text) {
  const qBig = Array.from(new Set(tokenize(query)));
  if (!qBig.length) return 0;
  const tBig = new Set(tokenize(text));
  let precHit = 0;
  for (const tok of qBig) if (tBig.has(tok)) precHit++;
  const prec = precHit / qBig.length;

  const qUni = Array.from(new Set((String(query).match(/[一-龥]/g) || [])));
  let rec = 0;
  if (qUni.length) {
    const tUni = new Set(String(text).match(/[一-龥]/g) || []);
    let u = 0; for (const c of qUni) if (tUni.has(c)) u++;
    rec = u / qUni.length;
  }
  return 0.75 * prec + 0.25 * rec;
}

/* 文档分块：按段落/句子切成 ≤maxLen 的片段，带少量重叠，避免割裂语义 */
export function chunkText(text, maxLen = 420, overlap = 60) {
  const clean = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
  const sentences = [];
  for (const p of paras) {
    const parts = p.split(/(?<=[。！？!?；;])/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) sentences.push(...parts); else sentences.push(p);
  }
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > maxLen && cur) { chunks.push(cur.trim()); cur = overlap > 0 ? cur.slice(-overlap) : ''; }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  const out = [];
  for (const c of chunks) {
    if (c.length <= maxLen * 1.5) { out.push(c); continue; }
    for (let i = 0; i < c.length; i += maxLen) out.push(c.slice(i, i + maxLen));
  }
  return out;
}

/* ---------------- 存储（seed + 上传） ---------------- */

let _chunks = null; // [{id,cat,title,text,source}]

function lsGet(key) { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch (_) { return null; } }
function lsSet(key, val) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val); } catch (_) {} }

function loadStore() {
  if (_chunks) return;
  _chunks = KB_SEED.map((c) => ({ ...c, source: 'seed' }));
  try { const up = JSON.parse(lsGet(LS_UPLOADED) || '[]'); if (Array.isArray(up)) _chunks.push(...up); } catch (_) {}
}
function persistUploaded() { lsSet(LS_UPLOADED, JSON.stringify(_chunks.filter((c) => c.source !== 'seed'))); }

/* ---------------- 检索（对外主入口） ---------------- */

/* 返回 [{id,cat,title,text,source,score,how:'lexical'}]（按相关度降序，最多 k 条） */
export async function retrieve(query, k = 4) {
  loadStore();
  const q = String(query || '').trim();
  if (!q || !_chunks.length) return [];
  return _chunks
    .map((c) => ({ ...c, score: lexicalScore(q, c.title + ' ' + c.text), how: 'lexical' }))
    .filter((c) => c.score >= LEX_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/* ---------------- 上传文档进知识库 ---------------- */

/* 把一段文本切块、加入知识库。返回 { added } */
export async function addDocument(name, rawText) {
  loadStore();
  const pieces = chunkText(rawText);
  if (!pieces.length) return { added: 0 };
  const source = String(name || '上传文档').slice(0, 60);
  removeUploadedSource(source, true); // 同名旧片段先清掉，避免重复
  const base = pieces.map((text, i) => ({ id: 'up-' + source + '-' + i, cat: '上传', title: source + ' #' + (i + 1), text, source }));
  _chunks.push(...base);
  persistUploaded();
  return { added: base.length };
}

/* ---------------- 管理 / 统计 ---------------- */

export function getAllChunks() { loadStore(); return _chunks.slice(); }

export function kbStats() {
  loadStore();
  const seed = _chunks.filter((c) => c.source === 'seed').length;
  return { total: _chunks.length, seed, uploaded: _chunks.length - seed, mode: '关键词检索（本地）' };
}

export function listSources() {
  loadStore();
  const map = new Map();
  for (const c of _chunks) { if (c.source === 'seed') continue; map.set(c.source, (map.get(c.source) || 0) + 1); }
  return Array.from(map, ([source, count]) => ({ source, count }));
}

export function removeUploadedSource(source, keepArrays) {
  loadStore();
  _chunks = _chunks.filter((c) => c.source !== source);
  if (!keepArrays) persistUploaded();
}

export function clearUploaded() { loadStore(); _chunks = _chunks.filter((c) => c.source === 'seed'); persistUploaded(); }

/* 测试用：重置内存态 */
export function _resetForTest() { _chunks = null; }
