// ===== 手搓 Agent · LLM 代理（Cloudflare Worker）=====
// 作用：替前端保管大模型密钥、解决浏览器跨域(CORS)，把对话转发给你选的大模型厂商。
// 前端只把 OpenAI 形状的 { messages, tools, model } POST 到本 Worker；密钥永不出现在前端。
//
// 与 worker/ocr-proxy.js 同一套思路，独立部署为第二个 Worker（互不影响）。
//
// 用 wrangler secret / vars 配置（详见同目录 README.md）：
//   LLM_PROVIDER : deepseek(默认) | openai | kimi | qwen | zhipu | anthropic | custom
//   LLM_API_KEY  : 对应厂商的 API Key（secret，加密存储）
//   LLM_MODEL    : 可选，默认模型（前端没传 model 时用）
//   LLM_BASE_URL : 可选，自定义/自建 OpenAI 兼容端点（provider=custom 时必填）
//   ALLOW_ORIGIN : 可选，CORS 来源白名单（默认 '*'；收紧成 'https://sjians.github.io'）
//   APP_TOKEN    : 可选，简单防滥用令牌；设了则前端须带 header x-app-token

// 各厂商默认端点与模型（base 都按 OpenAI 兼容路径，anthropic 单独翻译）
const PROVIDERS = {
  deepseek:  { base: 'https://api.deepseek.com',                              model: 'deepseek-chat',           kind: 'openai' },
  openai:    { base: 'https://api.openai.com/v1',                             model: 'gpt-4o-mini',             kind: 'openai' },
  kimi:      { base: 'https://api.moonshot.cn/v1',                            model: 'moonshot-v1-8k',          kind: 'openai' },
  moonshot:  { base: 'https://api.moonshot.cn/v1',                            model: 'moonshot-v1-8k',          kind: 'openai' },
  qwen:      { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',     model: 'qwen-plus',               kind: 'openai' },
  dashscope: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',     model: 'qwen-plus',               kind: 'openai' },
  zhipu:     { base: 'https://open.bigmodel.cn/api/paas/v4',                  model: 'glm-4-flash',             kind: 'openai' },
  glm:       { base: 'https://open.bigmodel.cn/api/paas/v4',                  model: 'glm-4-flash',             kind: 'openai' },
  anthropic: { base: 'https://api.anthropic.com',                             model: 'claude-3-5-sonnet-latest', kind: 'anthropic' },
};

// 防滥用上限：单次请求消息条数与总体积
const MAX_MESSAGES = 60;
const MAX_BODY_CHARS = 120000;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-token',
  };
}
function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
}

// 上游有时在出错时返回纯文本（如 "Authentication Fails"）而非 JSON：先取 text 再尝试解析，避免 JSON.parse 抛错把真实报错吞掉
async function readBody(r) {
  const raw = await r.text();
  try { return { raw, data: JSON.parse(raw) }; } catch (_) { return { raw, data: null }; }
}

function resolveProvider(env) {
  const name = String(env.LLM_PROVIDER || 'deepseek').toLowerCase();
  const prov = PROVIDERS[name] || PROVIDERS.deepseek;
  const base = (env.LLM_BASE_URL && env.LLM_BASE_URL.trim()) || prov.base;
  return { name, base, model: prov.model, kind: name === 'custom' ? 'openai' : prov.kind };
}

/* ---------- OpenAI 兼容厂商（deepseek/openai/kimi/qwen/zhipu/custom）：直接透传 ---------- */
async function callOpenAICompatible(base, model, key, body) {
  const payload = {
    model,
    messages: body.messages,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.2,
  };
  if (body.tools) { payload.tools = body.tools; payload.tool_choice = body.tool_choice || 'auto'; }

  const r = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(payload),
  });
  const { raw, data } = await readBody(r);
  if (!r.ok) return { ok: false, status: r.status, error: (data && (data.error?.message || data.error || data.message)) || raw.slice(0, 300) || ('上游返回 ' + r.status) };
  if (!data) return { ok: false, status: 502, error: '上游返回非 JSON：' + raw.slice(0, 300) };
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  if (!msg) return { ok: false, status: 502, error: '上游返回缺少 choices[].message' };
  return { ok: true, message: msg };
}

/* ---------- Anthropic（Claude）：OpenAI 形状 ↔ Anthropic 形状 双向翻译 ---------- */
function toAnthropic(messages, tools, toolChoice) {
  const systemParts = [];
  const out = [];
  let pendingToolResults = null; // 把连续的 OpenAI tool 结果合并进同一条 user 消息

  const flushTools = () => { if (pendingToolResults) { out.push({ role: 'user', content: pendingToolResults }); pendingToolResults = null; } };

  for (const m of messages) {
    if (m.role === 'system') { if (m.content) systemParts.push(m.content); continue; }
    if (m.role === 'tool') {
      if (!pendingToolResults) pendingToolResults = [];
      pendingToolResults.push({ type: 'tool_result', tool_use_id: m.tool_call_id, content: String(m.content ?? '') });
      continue;
    }
    flushTools();
    if (m.role === 'user') {
      out.push({ role: 'user', content: [{ type: 'text', text: String(m.content ?? '') }] });
    } else if (m.role === 'assistant') {
      const blocks = [];
      if (m.content) blocks.push({ type: 'text', text: String(m.content) });
      (m.tool_calls || []).forEach((tc) => {
        let input = {};
        try { input = JSON.parse(tc.function?.arguments || '{}'); } catch (_) {}
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.function?.name, input });
      });
      out.push({ role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: '' }] });
    }
  }
  flushTools();

  const aTools = (tools || []).map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
  let aToolChoice;
  if (aTools.length) aToolChoice = { type: 'auto' };
  return { system: systemParts.join('\n\n'), messages: out, tools: aTools, tool_choice: aToolChoice };
}

function fromAnthropic(data) {
  const blocks = Array.isArray(data.content) ? data.content : [];
  let text = '';
  const toolCalls = [];
  for (const b of blocks) {
    if (b.type === 'text') text += b.text || '';
    else if (b.type === 'tool_use') toolCalls.push({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } });
  }
  const message = { role: 'assistant', content: text || null };
  if (toolCalls.length) message.tool_calls = toolCalls;
  return message;
}

async function callAnthropic(base, model, key, body) {
  const conv = toAnthropic(body.messages, body.tools, body.tool_choice);
  const payload = { model, max_tokens: 1500, temperature: 0.2, system: conv.system, messages: conv.messages };
  if (conv.tools.length) { payload.tools = conv.tools; payload.tool_choice = conv.tool_choice; }

  const r = await fetch(base.replace(/\/$/, '') + '/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  });
  const { raw, data } = await readBody(r);
  if (!r.ok) return { ok: false, status: r.status, error: (data && (data.error?.message || data.error)) || raw.slice(0, 300) || ('上游返回 ' + r.status) };
  if (!data) return { ok: false, status: 502, error: '上游返回非 JSON：' + raw.slice(0, 300) };
  return { ok: true, message: fromAnthropic(data) };
}

export default {
  async fetch(request, env) {
    const origin = (env.ALLOW_ORIGIN && env.ALLOW_ORIGIN.trim()) || '*';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ error: '仅支持 POST（OpenAI 形状 { messages, tools, model }）' }, 405, origin);
    if (env.APP_TOKEN && request.headers.get('x-app-token') !== env.APP_TOKEN) return json({ error: '令牌校验失败' }, 401, origin);
    if (!env.LLM_API_KEY) return json({ error: '服务端未配置 LLM_API_KEY（用 wrangler secret put 设置）' }, 500, origin);

    let body;
    try { body = await request.json(); } catch (_) { return json({ error: '请求体需为 JSON' }, 400, origin); }
    if (!body || !Array.isArray(body.messages) || !body.messages.length) return json({ error: '缺少 messages 数组' }, 400, origin);
    if (body.messages.length > MAX_MESSAGES) return json({ error: '对话过长（消息数超限）' }, 413, origin);
    if (JSON.stringify(body.messages).length > MAX_BODY_CHARS) return json({ error: '内容过长（体积超限）' }, 413, origin);

    const prov = resolveProvider(env);
    if (prov.name === 'custom' && !(env.LLM_BASE_URL && env.LLM_BASE_URL.trim())) return json({ error: 'provider=custom 需配置 LLM_BASE_URL' }, 500, origin);
    const model = (body.model && String(body.model).trim()) || (env.LLM_MODEL && env.LLM_MODEL.trim()) || prov.model;

    try {
      const res = prov.kind === 'anthropic'
        ? await callAnthropic(prov.base, model, env.LLM_API_KEY, body)
        : await callOpenAICompatible(prov.base, model, env.LLM_API_KEY, body);
      if (!res.ok) return json({ error: 'upstream_error', error_msg: res.error, provider: prov.name, model }, res.status || 502, origin);
      return json({ message: res.message, provider: prov.name, model }, 200, origin);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 502, origin);
    }
  },
};
