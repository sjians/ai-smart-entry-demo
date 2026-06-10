// ===== 基础 DOM 助手 =====
// d(cls) : 创建一个 div，可选 className
// esc(s) : HTML 转义，防止 innerHTML 注入（纯字符串函数，可单测）

export function d(cls) {
  const e = document.createElement('div');
  if (cls) e.className = cls;
  return e;
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
