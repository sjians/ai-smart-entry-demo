// ===== 手搓 Agent · 设置面板 + 顶部状态徽标 =====
// 让用户不改代码就能：开/关真·AI、填 Worker 代理地址、指定模型。配置存浏览器 localStorage。
// 顶部徽标实时显示当前是「真·AI」还是「规则引擎（离线）」，点一下即可打开设置。

import { d, esc } from '../core/dom.js';
import { agentConfig } from './agentConfig.js';
import { resetAgentConversation } from './agentLoop.js';
import { showToast } from '../ui/leads.js';

/* 顶部徽标：在面板头部显示当前大脑状态，点击打开设置 */
export function renderAgentBadge(container) {
  if (!container) return;
  let badge = container.querySelector('#agentBadge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'agentBadge';
    badge.style.cssText = 'margin-left:auto;margin-right:10px';
    badge.title = '点击设置 AI';
    badge.onclick = openAgentSettings;
    container.appendChild(badge);
  }
  updateAgentBadge();
}

export function updateAgentBadge() {
  const badge = document.getElementById('agentBadge');
  if (!badge) return;
  const st = agentConfig.status();
  badge.className = 'agent-badge ' + (st.enabled ? 'on' : 'off');
  badge.innerHTML = st.enabled
    ? '<span class="dot"></span><i class="ti ti-sparkles" style="font-size:12px"></i>真·AI · ' + esc(st.model)
    : '<span class="dot"></span><i class="ti ti-cpu" style="font-size:12px"></i>规则引擎（离线）';
}

export function openAgentSettings() {
  const existing = document.getElementById('agentSettingsModal'); if (existing) existing.remove();
  const st = agentConfig.status();

  const bg = d('import-bg'); bg.id = 'agentSettingsModal'; bg.style.zIndex = 1400; bg.classList.add('open');
  const m = document.createElement('div'); m.className = 'lvl-modal-content'; m.style.width = '500px';
  m.innerHTML = `
    <div class="lvl-modal-h"><i class="ti ti-settings"></i>AI 设置</div>
    <div class="lvl-modal-sub">在「真·大模型」与「本地规则引擎（离线兜底）」之间切换。配置只存在你这台浏览器里。</div>

    <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg2);border:0.5px solid var(--line);border-radius:8px;cursor:pointer;margin-bottom:12px">
      <input type="checkbox" id="agentOnToggle" ${st.enabled ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
      <span style="font-size:13px;color:var(--ink);font-weight:500">启用真·AI（大模型）</span>
      <span style="margin-left:auto;font-size:11px;color:var(--ink3)">关掉则用规则引擎</span>
    </label>

    <div style="font-size:11px;color:var(--ink2);font-weight:600;margin:0 0 5px">Worker 代理地址</div>
    <input type="text" id="agentUrlInput" value="${esc(st.proxyUrl || '')}" placeholder="https://smart-entry-llm.xxx.workers.dev"
      style="width:100%;box-sizing:border-box;font-size:13px;padding:9px 11px;border:0.5px solid var(--line);border-radius:8px;font-family:inherit;color:var(--ink);background:var(--bg2);outline:none;margin-bottom:4px">
    <div style="font-size:10.5px;color:var(--ink3);margin-bottom:12px">密钥放在 Worker 里，前端永远看不到。部署见 <code>worker-llm/README.md</code>。留空 = 只用规则引擎。</div>

    <div style="font-size:11px;color:var(--ink2);font-weight:600;margin:0 0 5px">模型（可选）</div>
    <input type="text" id="agentModelInput" value="${esc(agentConfig.model() || '')}" placeholder="deepseek-chat"
      style="width:100%;box-sizing:border-box;font-size:13px;padding:9px 11px;border:0.5px solid var(--line);border-radius:8px;font-family:inherit;color:var(--ink);background:var(--bg2);outline:none;margin-bottom:6px">
    <div style="font-size:10.5px;color:var(--ink3);margin-bottom:14px">留空则用 Worker 端默认。可换成 Claude / gpt-4o / 通义 / Kimi 等（需 Worker 端配相应密钥）。</div>

    <div class="lvl-modal-foot" style="margin-bottom:4px"><i class="ti ti-bulb" style="font-size:11px;margin-right:3px"></i>大模型若超时/报错/超预算，会自动回落规则引擎，演示永远不会"开天窗"。</div>
    <div class="im-acts">
      <button class="ab" id="agentCancelBtn">取消</button>
      <button class="ab primary" id="agentSaveBtn"><i class="ti ti-check" style="font-size:12px"></i> 保存</button>
    </div>`;
  bg.appendChild(m);
  document.querySelector('div[style*="position:relative"]').appendChild(bg);

  const close = () => bg.remove();
  bg.onclick = (e) => { if (e.target === bg) close(); };
  document.getElementById('agentCancelBtn').onclick = close;
  document.getElementById('agentSaveBtn').onclick = () => {
    const url = document.getElementById('agentUrlInput').value.trim();
    const model = document.getElementById('agentModelInput').value.trim();
    const on = document.getElementById('agentOnToggle').checked;
    agentConfig.setProxyUrl(url);
    agentConfig.setModel(model);
    agentConfig.setAgentOn(on);
    resetAgentConversation(); // 切换大脑后开一段干净对话，避免上下文串味
    updateAgentBadge();
    close();
    const st2 = agentConfig.status();
    showToast(st2.enabled ? '已启用真·AI（' + st2.model + '）' : '已切换为规则引擎（离线）');
  };
}
