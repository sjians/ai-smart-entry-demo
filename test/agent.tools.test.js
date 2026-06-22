// 手搓 Agent · 工具层与配置单测（jsdom）：
// 验证大模型「调用工具」后，是否真的正确操作了右侧字段卡（填值/下拉容错/编码徽标/读状态/保存守卫），
// 以及真·AI 开关逻辑。这些不依赖网络，纯跑执行器。
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { F, FKEYS } from '../src/data/fields.js';
import { state } from '../src/state.js';
import { mkFieldsCard } from '../src/ui/fields.js';
import { runTool, TOOLS } from '../src/agent/tools.js';
import { agentConfig } from '../src/agent/agentConfig.js';
import { CRM_CUSTOMERS } from '../src/data/crm.js';

function boot() {
  document.body.innerHTML = '<div id="app" style="position:relative"></div>';
  const app = document.getElementById('app');
  state.C = app; state.C_MAIN = app;
  app.appendChild(mkFieldsCard());
}

beforeEach(() => { FKEYS.forEach((k) => (F[k] = '')); boot(); });

describe('工具规格 · TOOLS', () => {
  it('暴露三个工具，下拉字段带 enum', () => {
    const names = TOOLS.map((t) => t.function.name);
    expect(names).toEqual(['fill_lead_fields', 'get_form_state', 'save_lead']);
    const props = TOOLS[0].function.parameters.properties.fields.properties;
    expect(props.level.enum).toContain('A — 重点'); // 下拉值直接喂给模型
  });
});

describe('工具 · fill_lead_fields', () => {
  it('填字段 → 写入 F 并回填输入框', () => {
    const r = runTool('fill_lead_fields', { fields: { owner: '安泰科技', budget: '8000万', industry: '金融' } });
    expect(F.owner).toBe('安泰科技');
    expect(F.budget).toBe('8000万');
    expect(document.getElementById('fginp-owner').value).toBe('安泰科技');
    expect(r.ok).toBe(true);
    expect(r.missingRequired).toContain('联系人'); // 还缺的必填项会回报给模型
  });

  it('下拉值容错：level 给单字母 "A" → "A — 重点"', () => {
    runTool('fill_lead_fields', { fields: { level: 'A' } });
    expect(F.level).toBe('A — 重点');
  });

  it('编码自动转换 + 紫色徽标：行业编码 01 → 电力', () => {
    runTool('fill_lead_fields', { fields: {}, codes: { industry: '01' } });
    expect(F.industry).toBe('电力');
    const badge = document.querySelector('#fgv-industry .code-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('01');
  });

  it('忽略不存在的字段键', () => {
    const r = runTool('fill_lead_fields', { fields: { nope: 'x', owner: '某客户' } });
    expect(r.ignoredKeys).toContain('nope');
    expect(F.owner).toBe('某客户');
  });
});

describe('工具 · get_form_state / save_lead', () => {
  it('get_form_state 报告已填 / 缺失 / CRM 命中', () => {
    F.owner = CRM_CUSTOMERS[0];
    const r = runTool('get_form_state', {});
    expect(r.crm.ownerInCrm).toBe(true);
    expect(Array.isArray(r.missingRequired)).toBe(true);
  });

  it('save_lead 在表单为空时拒绝保存（守卫）', () => {
    const r = runTool('save_lead', {});
    expect(r.ok).toBe(false);
  });
});

describe('真·AI 开关逻辑', () => {
  afterEach(() => { try { localStorage.removeItem('LLM_PROXY_URL'); localStorage.removeItem('SMART_AGENT_ON'); } catch (_) {} });
  it('配了代理地址 + 开 → 启用；关掉 → 回落规则引擎', () => {
    agentConfig.setProxyUrl('https://example.workers.dev');
    agentConfig.setAgentOn(true);
    expect(agentConfig.enabled()).toBe(true);
    agentConfig.setAgentOn(false);
    expect(agentConfig.enabled()).toBe(false);
  });
});
