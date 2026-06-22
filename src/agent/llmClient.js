// ===== 手搓 Agent · LLM 客户端 =====
// 前端只跟「我们自己的 Worker 代理」对话，永远不直接碰大模型厂商，也不持有密钥。
// 统一用 OpenAI 的 chat-completions 消息/工具格式（messages[] + tools[]）：
// DeepSeek / OpenAI / Kimi / 通义 / 智谱都原生兼容；Claude 由 Worker 端做格式翻译。
//
// 返回值：助手消息对象 { role:'assistant', content:string|null, tool_calls?:[...] }（OpenAI 形状）。
// 任何失败（未配置 / 超时 / 网络 / 代理报错）都 throw，由上层 agentLoop 兜底回落规则引擎。

import { agentConfig } from './agentConfig.js';

const TIMEOUT_MS = 45000; // 大模型 + 多轮工具调用可能偏慢，给足时间；超时则兜底

export async function chatComplete(messages, tools) {
  const url = agentConfig.proxyUrl();
  if (!url) throw new Error('未配置 LLM 代理地址');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        tools,
        tool_choice: 'auto',
        model: agentConfig.model() || undefined, // 留空则用 Worker 端默认
      }),
      signal: ctrl.signal,
    });

    if (!resp.ok) {
      let detail = '';
      try { const e = await resp.json(); detail = e.error_msg || e.error || e.detail || ''; } catch (_) {}
      throw new Error('代理返回 ' + resp.status + (detail ? ' · ' + detail : ''));
    }

    const data = await resp.json();
    if (data && data.error) throw new Error(data.error_msg || data.error);

    // Worker 统一吐出 { message }；同时兼容直接透传的 OpenAI { choices:[{message}] }
    const msg = (data && data.message) || (data && data.choices && data.choices[0] && data.choices[0].message);
    if (!msg) throw new Error('代理返回缺少 message 字段');
    return msg;
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('请求超时');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
