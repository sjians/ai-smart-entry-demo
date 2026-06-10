import { describe, it, expect } from 'vitest';
import { d, esc } from '../src/core/dom.js';

describe('esc · HTML 转义', () => {
  it('转义尖括号', () => { expect(esc('<div>')).toBe('&lt;div&gt;'); });
  it('转义 & 符号', () => { expect(esc('a & b')).toBe('a &amp; b'); });
  it('混合转义（& 先行避免二次转义）', () => { expect(esc('a<b>&c')).toBe('a&lt;b&gt;&amp;c'); });
  it('非字符串入参强制转字符串', () => { expect(esc(123)).toBe('123'); });
  it('空字符串', () => { expect(esc('')).toBe(''); });
});

describe('d · 创建 div', () => {
  it('返回 DIV 元素', () => { expect(d('').tagName).toBe('DIV'); });
  it('应用 className', () => { expect(d('foo bar').className).toBe('foo bar'); });
  it('空 className 不设置 class', () => { expect(d('').className).toBe(''); });
});
