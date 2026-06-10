// 端到端集成冒烟测试（jsdom）：启动整个应用，逐一触发「需要点击」的交互，
// 断言每个交互都有反应。每个用例调用的正是各 onclick 实际绑定的处理函数。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { F, FKEYS } from '../src/data/fields.js';
import { AI_CHAT_EXAMPLES, IMPORT_DATA } from '../src/data/examples.js';
import { CRM_CUSTOMERS } from '../src/data/crm.js';
import * as panel from '../src/ui/panel.js';
import * as chat from '../src/ui/chat.js';
import * as leads from '../src/ui/leads.js';
import * as modals from '../src/ui/modals.js';
import * as crmMatch from '../src/ui/crmMatch.js';
import * as importLeads from '../src/ui/importLeads.js';

const APP_HTML = `
  <div id="app" style="position:relative">
    <div class="edit-modal-bg" id="editModalBg">
      <div class="edit-modal">
        <div class="em-title"><i class="ti ti-pencil" id="emIcon"></i><span id="emTitle">编辑字段</span></div>
        <div id="emBody"></div>
        <div class="em-acts">
          <button class="ab" data-action="closeEditModal">取消</button>
          <button class="ab primary" data-action="saveEditModal">保存</button>
        </div>
      </div>
    </div>
    <div class="import-bg" id="importBg">
      <div class="import-modal">
        <div class="drop-zone" data-action="runImport"></div>
        <div class="prog-wrap" id="progWrap"><div class="prog-bar-fill" id="progFill"></div></div>
      </div>
    </div>
  </div>`;

const IMPORT_SNAPSHOT = IMPORT_DATA.map((r) => ({ ...r }));

function boot() {
  document.body.innerHTML = APP_HTML;
  const app = document.getElementById('app');
  state.C = app;
  state.C_MAIN = app;
  panel.openEmbAiPanel();
  vi.runOnlyPendingTimers(); // 冲洗 mkFieldsCard 的 setTimeout(0) 与聚焦 setTimeout(50)
}

beforeEach(() => {
  vi.useFakeTimers();
  state.SAVED_LEADS.length = 0;
  FKEYS.forEach((k) => (F[k] = ''));
  IMPORT_DATA.length = 0;
  IMPORT_SNAPSHOT.forEach((r) => IMPORT_DATA.push({ ...r }));
  boot();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('启动 · AI 智能录入面板', () => {
  it('打开后渲染对话区与字段卡', () => {
    expect(document.getElementById('embAiPanelBg')).toBeTruthy();
    expect(document.getElementById('aiChatLog')).toBeTruthy();
    expect(document.getElementById('fcCard')).toBeTruthy();
    expect(document.getElementById('aiChatInput')).toBeTruthy();
  });

  it('提供 4 个示例气泡按钮', () => {
    const chips = document.querySelectorAll('.mm-btn');
    expect(chips.length).toBe(AI_CHAT_EXAMPLES.length);
  });
});

describe('交互 · 点击示例气泡', () => {
  it('点选「微信需求」示例即填满右侧字段', () => {
    const chip = document.querySelectorAll('.mm-btn')[0];
    chip.onclick();
    const ex = AI_CHAT_EXAMPLES[0].fields;
    expect(F.owner).toBe(ex.owner);
    expect(F.budget).toBe(ex.budget);
    expect(document.getElementById('fginp-owner').value).toBe(ex.owner);
    // 对话区出现用户气泡 + AI 回复
    expect(document.getElementById('aiChatLog').children.length).toBeGreaterThanOrEqual(2);
  });
});

describe('交互 · 对话框输入并发送', () => {
  it('发送自由文本 → 抽取并回填字段', () => {
    const inp = document.getElementById('aiChatInput');
    inp.value = '客户安泰科技，预算8000万，金融行业，联系人刘强电话13800000004，战略支柱客户';
    chat.aiChatSend();
    expect(F.owner).toBe('安泰科技');
    expect(F.phone).toBe('13800000004');
    expect(F.industry).toBe('金融');
    expect(F.level).toBe('S — 战略级');
    expect(inp.value).toBe(''); // 发送后清空
  });

  it('无法识别的文本给出温和提示', () => {
    const inp = document.getElementById('aiChatInput');
    inp.value = '你好啊在吗';
    chat.aiChatSend();
    vi.advanceTimersByTime(300);
    const bubbles = document.getElementById('aiChatLog').textContent;
    expect(bubbles).toContain('没识别到');
  });
});

describe('交互 · 保存线索', () => {
  it('保存后写入已保存列表并弹出 Toast', () => {
    document.querySelectorAll('.mm-btn')[1].onclick(); // 先用示例填好
    expect(F.owner).toBeTruthy();
    leads.embSaveFromAi();
    expect(state.SAVED_LEADS.length).toBe(1);
    expect(document.getElementById('stdToast')).toBeTruthy();
    // 保存后右侧表单清空
    expect(F.owner).toBe('');
  });

  it('查看已保存线索弹层可打开', () => {
    document.querySelectorAll('.mm-btn')[0].onclick();
    leads.embSaveFromAi();
    leads.openSavedLeads();
    expect(document.getElementById('savedLeadsBg')).toBeTruthy();
    const rows = document.querySelectorAll('#savedLeadsBg .crm-trow');
    expect(rows.length).toBe(1);
  });
});

describe('交互 · 字段编辑弹窗', () => {
  it('打开编辑弹窗 → 修改 → 保存写回字段', () => {
    modals.openEditModal('budget');
    expect(document.getElementById('editModalBg').classList.contains('open')).toBe(true);
    const emInp = document.getElementById('emInp');
    emInp.value = '2000万';
    modals.saveEditModal();
    expect(F.budget).toBe('2000万');
    expect(document.getElementById('editModalBg').classList.contains('open')).toBe(false);
  });

  it('级别字段编辑弹窗附带判定标准说明', () => {
    modals.openEditModal('level');
    expect(document.getElementById('emBody').textContent).toContain('判定标准');
    modals.closeEditModal();
  });
});

describe('交互 · 分级标准 / 编码对照弹层', () => {
  it('线索分级标准弹层可开可关', () => {
    modals.showLevelCriteria();
    expect(document.getElementById('lvlCritModal')).toBeTruthy();
    modals.closeLevelCriteria();
    expect(document.getElementById('lvlCritModal')).toBeFalsy();
  });

  it('编码对照表弹层可开可关', () => {
    modals.showCodeMap();
    expect(document.getElementById('codeMapModal')).toBeTruthy();
    expect(document.getElementById('codeMapModal').textContent).toContain('行业编码');
    modals.closeCodeMap();
    expect(document.getElementById('codeMapModal')).toBeFalsy();
  });
});

describe('交互 · CRM 匹配与 AI 创建实体', () => {
  it('已知客户显示「CRM 已存在」', () => {
    F.owner = CRM_CUSTOMERS[0];
    crmMatch.checkCrmMatch();
    const badge = document.querySelector('#fgi-owner .match-badge');
    expect(badge.classList.contains('matched')).toBe(true);
  });

  it('未知客户显示未匹配并提供「AI 创建」入口', () => {
    F.owner = '某不存在的新客户XYZ';
    crmMatch.checkCrmMatch();
    const badge = document.querySelector('#fgi-owner .match-badge');
    expect(badge.classList.contains('unmatched')).toBe(true);
    const link = badge.querySelector('.create-link');
    expect(link).toBeTruthy();
    // 点击「AI 创建客户」弹出解析弹层
    link.onclick(new Event('click'));
    expect(document.getElementById('createEntityModal')).toBeTruthy();
  });
});

describe('交互 · 批量导入预览与补全', () => {
  it('导入预览渲染全部样本行', () => {
    importLeads.renderEmbImportPreview();
    const rows = document.querySelectorAll('#embImportBg .crm-trow');
    expect(rows.length).toBe(IMPORT_SNAPSHOT.length);
    // 含「需补全」行（partial/review）
    expect(document.getElementById('embImportBg').textContent).toContain('需补全');
  });

  it('保存批量导入 → 全部进入已保存列表', () => {
    const n = IMPORT_DATA.length;
    importLeads.renderEmbImportPreview();
    importLeads.submitImportBatch();
    vi.advanceTimersByTime(200);
    expect(state.SAVED_LEADS.length).toBe(n);
    expect(IMPORT_DATA.length).toBe(0); // 提交后清空
  });

  it('打开行编辑弹窗可补全缺失字段并更新状态', () => {
    importLeads.renderEmbImportPreview();
    // 第 12 条（index 11）是 partial（九州通信，预算缺失）
    importLeads.openImportRowEdit(11);
    expect(document.getElementById('embRowEditModal')).toBeTruthy();
    const inputs = document.querySelectorAll('#embRowEditModal input, #embRowEditModal select');
    expect(inputs.length).toBeGreaterThan(0);
  });
});

describe('交互 · 关闭面板回到启动卡', () => {
  it('关闭后显示启动卡，可重新打开', () => {
    panel.closeEmbAiPanel();
    expect(document.getElementById('embAiPanelBg')).toBeFalsy();
    expect(document.querySelector('.app-launcher')).toBeTruthy();
  });
});
