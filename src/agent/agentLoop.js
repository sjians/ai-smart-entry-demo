// ===== 手搓 Agent · 主循环 =====
// 这就是「agent」的本体：感知(用户输入+表单状态) → 思考(LLM) → 行动(工具) → 观察(工具结果) → 再思考…直到给出回话。
// 失败兜底（方法论第④条）：任何一步出错（未配置/超时/网络/模型异常），静默回落到本地规则引擎，
// 保证「拿给客户永远能用」，不会白屏或报错给客户看。

import { F, FKEYS, FL, KEY_FIELDS } from '../data/fields.js';
import { agentConfig } from './agentConfig.js';
import { chatComplete } from './llmClient.js';
import { TOOLS, runTool } from './tools.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { aiChatSend, aiChatBot, aiChatUser } from '../ui/chat.js';
import { fillFromText } from '../ui/realInput.js';

const MAX_STEPS = 6; // 一轮对话里最多「思考↔工具」往返次数，防止极端情况下死循环

// 对话记忆：模块级数组（面板每次打开时由 resetAgentConversation() 清空，开始一段干净会话）
let history = [];
export function resetAgentConversation() { history = []; }

/* 当前表单快照：作为每轮临时 system 信息注入，让模型即使在「点示例/手动改字段」后也清楚现状（不写入长期 history） */
function formSnapshotText() {
  const filled = FKEYS.filter((k) => F[k]).map((k) => `${FL[k]}=${F[k]}`);
  const missing = KEY_FIELDS.filter(([k]) => !F[k]).map(([, l]) => l);
  if (!filled.length && !missing.length) return '';
  let s = '【当前表单状态】';
  s += filled.length ? '已填：' + filled.join('；') : '尚未填写任何字段';
  if (missing.length) s += '。仍缺必填：' + missing.join('、');
  return s;
}

function buildMessages() {
  // 单条 system（主提示词 + 当前表单快照），避免个别厂商对多条 system 的兼容差异
  const snap = formSnapshotText();
  const system = buildSystemPrompt() + (snap ? '\n\n' + snap : '');
  const msgs = [{ role: 'system', content: system }];
  for (const m of history) msgs.push(m);
  return msgs;
}

function safeParseArgs(raw) {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch (_) { return {}; }
}

/* —— 对话区「正在思考」气泡 —— */
function showTyping() {
  const log = document.getElementById('aiChatLog'); if (!log) return null;
  const row = document.createElement('div'); row.id = 'aiTypingBubble'; row.style.cssText = 'display:flex;gap:8px';
  row.innerHTML =
    '<div style="width:26px;height:26px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;background:linear-gradient(135deg,#b08060,#9980b0);color:#fff"><i class="ti ti-sparkles"></i></div>' +
    '<div style="font-size:12.5px;line-height:1.6;padding:8px 11px;border-radius:10px;background:var(--bg2);color:var(--ink3);border:0.5px solid var(--line)"><i class="ti ti-loader-2 ti-spin"></i> 正在思考…</div>';
  log.appendChild(row); log.scrollTop = log.scrollHeight;
  return row;
}
function removeTyping(el) { if (el && el.parentNode) el.parentNode.removeChild(el); else { const e = document.getElementById('aiTypingBubble'); if (e) e.remove(); } }

/* —— 一轮真·AI 对话 —— */
export async function runAgentTurn() {
  const inp = document.getElementById('aiChatInput'); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  aiChatUser(text);
  inp.value = ''; inp.style.height = 'auto';
  history.push({ role: 'user', content: text });

  const typing = showTyping();
  try {
    const messages = buildMessages();
    for (let step = 0; step < MAX_STEPS; step++) {
      const msg = await chatComplete(messages, TOOLS);
      messages.push(msg);
      history.push(msg);

      const calls = msg.tool_calls || [];
      if (calls.length) {
        for (const call of calls) {
          const fn = call.function || {};
          const result = runTool(fn.name, safeParseArgs(fn.arguments));
          const toolMsg = { role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) };
          messages.push(toolMsg);
          history.push(toolMsg);
        }
        continue; // 把工具结果喂回模型，让它决定下一步（继续填 / 追问 / 收尾）
      }

      // 没有工具调用 = 给出最终回话
      removeTyping(typing);
      aiChatBot(msg.content ? String(msg.content) : '好的。');
      return;
    }
    removeTyping(typing);
    aiChatBot('已尽力处理，请核对右侧字段，或补充更多信息我再帮你完善。');
  } catch (err) {
    // —— 失败兜底：回落规则引擎 ——
    removeTyping(typing);
    const any = fillFromText(text);
    if (any) aiChatBot('（大模型暂不可用，已用本地规则引擎兜底）已填入可识别字段，请核对，缺失项已红框标出。');
    else aiChatBot('网络或模型暂时不可用，也没从这句里识别到明确字段。可换个说法，或直接在右侧填写。');
  }
}

/* —— 发送入口（面板的发送按钮 / 回车都走这里）——
   开了真·AI 且配了代理 → 走 agent；否则走规则引擎（也是离线/兜底路径）。 */
export async function aiChatSubmit() {
  if (agentConfig.enabled()) { await runAgentTurn(); return; }
  aiChatSend();
}
