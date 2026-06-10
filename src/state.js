// ===== 运行时共享状态 =====
// 原单文件原型里这些是模块级可变全局变量。拆分为多模块后，集中放进一个对象，
// 保证「重新赋值」（如 C 在主面板/启动卡之间切换）能被所有模块看到同一份引用。
//
//  C       : 当前字段卡渲染容器（AI 面板打开时指向右侧字段列，关闭后指回 #app）
//  C_MAIN  : 应用根容器（#app），Toast / 启动卡 / 各浮层都挂到它上面
//  editingKey      : 字段编辑弹窗当前编辑的字段 key
//  aiChatRecording : 语音输入「录音中」开关
//  SAVED_LEADS     : 本次会话已保存的线索列表

export const state = {
  C: null,
  C_MAIN: null,
  curTab: 'create',
  voiceOn: false,
  editingKey: null,
  activeChips: [],
  aiChatRecording: false,
  speechRec: null,
  SAVED_LEADS: [],
};
