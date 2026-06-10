// ===== 应用入口 =====
// 1) 引入样式  2) 绑定共享容器  3) 把字符串型 onclick 处理器暴露到 window
// 4) 接管静态 [data-action] 按钮  5) 绑定弹窗遮罩点击关闭  6) 启动 AI 智能录入面板。

// 本地 Tabler 图标字体（取代 CDN，确保离线/无网环境也能完整显示图标）
import '@tabler/icons-webfont/tabler-icons.min.css';
import './styles/main.css';

import { state } from './state.js';
import * as fields from './ui/fields.js';
import * as modals from './ui/modals.js';
import * as crmMatch from './ui/crmMatch.js';
import * as chat from './ui/chat.js';
import * as leads from './ui/leads.js';
import * as importLeads from './ui/importLeads.js';
import * as panel from './ui/panel.js';

function initApp() {
  /* —— 绑定共享容器（C 初始指向 #app；AI 面板打开时会切到右侧字段列）—— */
  const app = document.getElementById('app');
  state.C = app;
  state.C_MAIN = app;

  /* —— 暴露 window 全局：动态生成 HTML 里的 onclick="fn()" 与 + 菜单 window[fn]() 依赖它们 —— */
  Object.assign(window, {
    // 字段编辑弹窗
    openEditModal: modals.openEditModal,
    jumpToField: fields.jumpToField,
    closeEditModal: modals.closeEditModal,
    saveEditModal: modals.saveEditModal,
    // 分级标准 / 编码对照
    showLevelCriteria: modals.showLevelCriteria,
    closeLevelCriteria: modals.closeLevelCriteria,
    showCodeMap: modals.showCodeMap,
    closeCodeMap: modals.closeCodeMap,
    // AI 创建实体
    closeCreateEntity: crmMatch.closeCreateEntity,
    // 对话区 + 菜单（window[fn] 调用）
    aiChatDoc: chat.aiChatDoc,
    aiChatImage: chat.aiChatImage,
    // 批量导入
    openImport: importLeads.openImport,
    closeImport: importLeads.closeImport,
    runImport: importLeads.runImport,
    // 面板 / 已保存线索（启动卡 onclick）
    openEmbAiPanel: panel.openEmbAiPanel,
    openSavedLeads: leads.openSavedLeads,
  });

  /* —— 接管静态模板里的 [data-action] 按钮（index.html 的取消/保存/导入）—— */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = window[el.dataset.action];
    if (typeof fn === 'function') fn();
  });

  /* —— 弹窗遮罩点击空白处关闭（对应原型 line 885 / 1607 / 1784）—— */
  const editBg = document.getElementById('editModalBg');
  if (editBg) editBg.onclick = (e) => { if (e.target === editBg) modals.closeEditModal(); };
  const importBg = document.getElementById('importBg');
  if (importBg) importBg.onclick = (e) => { if (e.target === importBg) importLeads.closeImport(); };

  /* —— 启动：直接打开 AI 智能录入面板 —— */
  panel.openEmbAiPanel();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
