// UI 层冒烟测试：在 jsdom 中挂载字段卡，验证渲染 / 回填 / 完成度 / 缺失标注。
import { describe, it, expect, beforeEach } from 'vitest';
import { mkFieldsCard, renderField, updatePct, promptCompletion } from '../src/ui/fields.js';
import { F, FKEYS, FGROUPS, KEY_FIELDS } from '../src/data/fields.js';

function resetF() { FKEYS.forEach((k) => (F[k] = '')); }

describe('字段卡 · DOM 渲染', () => {
  beforeEach(() => {
    resetF();
    document.body.innerHTML = '<div id="app" style="position:relative"></div>';
    document.getElementById('app').appendChild(mkFieldsCard());
  });

  it('渲染出全部基本信息字段格子', () => {
    const items = document.querySelectorAll('.fg-item:not(.fg-filler)');
    expect(items.length).toBe(FGROUPS[0].keys.length);
  });

  it('renderField(ai) 标记为已填并写入输入框', () => {
    renderField('owner', '鸿图智造集团', 'ai');
    const item = document.getElementById('fgi-owner');
    const ctrl = document.getElementById('fginp-owner');
    expect(item.classList.contains('filled')).toBe(true);
    expect(ctrl.value).toBe('鸿图智造集团');
  });

  it('renderField(空值) 回到未填写态', () => {
    renderField('phone', '13800000001', 'ai');
    renderField('phone', '', 'manual');
    const val = document.getElementById('fgv-phone');
    expect(val.textContent).toBe('未填写');
  });

  it('updatePct 依据 F 计算完成度', () => {
    F.owner = '鸿图智造集团';
    F.name = '某项目';
    updatePct();
    const expected = Math.round(2 / FKEYS.length * 100) + '%';
    expect(document.getElementById('pctNum').textContent).toBe(expected);
  });

  it('promptCompletion 给每个缺失关键字段打红点', () => {
    promptCompletion();
    const dots = document.querySelectorAll('.fg-req-dot');
    expect(dots.length).toBe(KEY_FIELDS.length);
  });

  it('分组标题点击可折叠/展开字段网格', () => {
    const gh = document.querySelector('.fg-group-head');
    const grid = document.getElementById('fg-grid-0');
    expect(grid.style.display).not.toBe('none');
    gh.onclick();
    expect(grid.style.display).toBe('none');
    gh.onclick();
    expect(grid.style.display).toBe('grid');
  });
});
