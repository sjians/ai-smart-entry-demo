// ===== 手搓 Agent · 运行时配置 =====
// 这是「真·AI」与「规则引擎兜底」的总开关。设计目标：客户拿到构建产物双击即用、无需任何配置。
//
// 三个可调项（均可被 localStorage 覆盖，便于演示时不重新构建就切换）：
//   LLM_PROXY_URL : 你部署的 Cloudflare Worker（worker-llm/）公网地址。密钥在 Worker 里，前端永远看不到。
//   SMART_AGENT_ON: 真·AI 开关。默认「只要配了代理地址就开」；用户可在设置里临时关掉改用规则引擎。
//   LLM_MODEL     : 模型名（可选）。留空则用 Worker 端默认。仅作前端展示/覆盖用。
//
// 为什么默认 BUILT_IN_LLM_PROXY_URL 为空：
//   1) 仓库/单测/未部署时 = 没有地址 = 自动走规则引擎（确定性、零成本、离线），不会误连网、不破坏 103 个单测；
//   2) 给客户分发前，把你的 Worker 地址填到下面这行常量，再 `npm run build`，客户端打开即真·AI。
//      （或让用户在设置面板里粘贴地址，存进他自己浏览器的 localStorage。）

const BUILT_IN_LLM_PROXY_URL = ''; // ← 部署 worker-llm 后填这里，例如 'https://smart-entry-llm.xxx.workers.dev'
const DEFAULT_MODEL = 'deepseek-chat';

function lsGet(key) {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(key);
    return v && String(v).trim() ? String(v).trim() : '';
  } catch (_) {
    return '';
  }
}
function lsSet(key, val) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val); } catch (_) { /* 无痕模式等：忽略 */ }
}

export const agentConfig = {
  /* 代理地址：localStorage 覆盖优先，否则用内置常量 */
  proxyUrl() { return lsGet('LLM_PROXY_URL') || BUILT_IN_LLM_PROXY_URL; },
  setProxyUrl(url) { lsSet('LLM_PROXY_URL', (url || '').trim()); },

  /* 模型名（展示/覆盖用，真正默认值在 Worker 端） */
  model() { return lsGet('LLM_MODEL') || DEFAULT_MODEL; },
  setModel(m) { lsSet('LLM_MODEL', (m || '').trim()); },

  /* 真·AI 开关：默认「配了地址就开」。用户显式设为 '0' 才关。 */
  isAgentToggledOn() {
    let v = '1';
    try { if (typeof localStorage !== 'undefined') { const raw = localStorage.getItem('SMART_AGENT_ON'); if (raw !== null) v = raw; } } catch (_) {}
    return v !== '0';
  },
  setAgentOn(on) { lsSet('SMART_AGENT_ON', on ? '1' : '0'); },

  /* 最终是否启用真·AI：必须既配了代理地址、又没被关掉 */
  enabled() { return !!this.proxyUrl() && this.isAgentToggledOn(); },

  /* 供顶部状态徽标 / 设置面板读取 */
  status() {
    const hasUrl = !!this.proxyUrl();
    return { enabled: this.enabled(), hasUrl, model: this.model(), proxyUrl: this.proxyUrl() };
  },
};
