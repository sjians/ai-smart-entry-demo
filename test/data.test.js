import { describe, it, expect } from 'vitest';
import { F, FKEYS, FL, FI, FGROUPS, SELS, KEY_FIELDS, AI_CHAT_ASK } from '../src/data/fields.js';
import { INDUSTRY_CODE_MAP, CUSTLEVEL_CODE_MAP } from '../src/data/codeMaps.js';
import { CRM_CUSTOMERS, CRM_CONTACTS } from '../src/data/crm.js';
import { LEVEL_CRITERIA, FULL_LEVEL_CRITERIA } from '../src/data/criteria.js';
import { AI_CHAT_EXAMPLES, IMPORT_DATA } from '../src/data/examples.js';

describe('data/fields · 一致性', () => {
  it('FKEYS 与 F 的键一一对应', () => {
    expect(FKEYS).toEqual(Object.keys(F));
  });
  it('每个字段都有中文标签与图标', () => {
    FKEYS.forEach((k) => {
      expect(FL[k], `缺少标签：${k}`).toBeTruthy();
      expect(FI[k], `缺少图标：${k}`).toBeTruthy();
    });
  });
  it('FGROUPS 中的字段都存在于 F', () => {
    FGROUPS.forEach((g) => g.keys.forEach((k) => expect(FKEYS).toContain(k)));
  });
  it('SELS / KEY_FIELDS / AI_CHAT_ASK 的键都合法', () => {
    Object.keys(SELS).forEach((k) => expect(FKEYS).toContain(k));
    KEY_FIELDS.forEach(([k]) => expect(FL[k]).toBeTruthy());
    AI_CHAT_ASK.forEach(([k]) => expect(FKEYS).toContain(k));
  });
});

describe('data/codeMaps · 编码表', () => {
  it('行业编码 01 → 电力', () => { expect(INDUSTRY_CODE_MAP['01']).toBe('电力'); });
  it('客户等级 A → 战略支柱客户', () => { expect(CUSTLEVEL_CODE_MAP['A']).toBe('战略支柱客户'); });
  it('行业编码覆盖 11 个行业', () => { expect(Object.keys(INDUSTRY_CODE_MAP).length).toBe(11); });
});

describe('data/crm · 客户库', () => {
  it('包含鸿图智造集团', () => { expect(CRM_CUSTOMERS).toContain('鸿图智造集团'); });
  it('鸿图智造集团名下有林志远', () => { expect(CRM_CONTACTS['鸿图智造集团']).toContain('林志远'); });
});

describe('data/criteria · 分级标准', () => {
  it('LEVEL_CRITERIA 含 S/A/B/C 四级', () => {
    expect(Object.keys(LEVEL_CRITERIA).length).toBe(4);
  });
  it('FULL_LEVEL_CRITERIA 四条完整说明', () => {
    expect(FULL_LEVEL_CRITERIA.length).toBe(4);
    FULL_LEVEL_CRITERIA.forEach((c) => { expect(c.lvl).toBeTruthy(); expect(c.name).toBeTruthy(); expect(c.desc).toBeTruthy(); });
  });
});

describe('data/examples · 演示样本', () => {
  it('对话示例 4 条且字段完整', () => {
    expect(AI_CHAT_EXAMPLES.length).toBe(4);
    AI_CHAT_EXAMPLES.forEach((e) => {
      expect(e.label).toBeTruthy();
      expect(e.text).toBeTruthy();
      expect(e.fields && typeof e.fields).toBe('object');
    });
  });
  it('批量导入样本 12 条且含状态', () => {
    expect(IMPORT_DATA.length).toBe(12);
    IMPORT_DATA.forEach((row) => {
      expect(row.name).toBeTruthy();
      expect(['ok', 'partial', 'review']).toContain(row.status);
    });
  });
});
