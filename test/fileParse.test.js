import { describe, it, expect } from 'vitest';
import { extOf, fileKind, mapHeaderToKey, computeRowStatus, rowsToImportData, batchTemplateCsv } from '../src/core/fileParse.js';

describe('extOf', () => {
  it('取小写扩展名', () => {
    expect(extOf('招标说明书.PDF')).toBe('pdf');
    expect(extOf('a.b.docx')).toBe('docx');
    expect(extOf('noext')).toBe('');
  });
});

describe('fileKind', () => {
  it('识别常见类型', () => {
    expect(fileKind('x.pdf')).toBe('pdf');
    expect(fileKind('x.docx')).toBe('docx');
    expect(fileKind('x.doc')).toBe('doc');
    expect(fileKind('x.txt')).toBe('text');
    expect(fileKind('x.csv')).toBe('text');
    expect(fileKind('x.xlsx')).toBe('sheet');
    expect(fileKind('x.png')).toBe('image');
    expect(fileKind('x.zip')).toBe('unknown');
  });
});

describe('mapHeaderToKey', () => {
  it('中文表头映射到字段 key', () => {
    expect(mapHeaderToKey('线索名称')).toBe('name');
    expect(mapHeaderToKey('公司')).toBe('company');
    expect(mapHeaderToKey('客户/业主')).toBe('company');
    expect(mapHeaderToKey('联系人')).toBe('contact');
    expect(mapHeaderToKey('职位')).toBe('title');
    expect(mapHeaderToKey('项目预算')).toBe('budget');
    expect(mapHeaderToKey('行业')).toBe('industry');
    expect(mapHeaderToKey('线索级别')).toBe('level');
    expect(mapHeaderToKey('时间计划')).toBe('timeline');
    expect(mapHeaderToKey('联系电话')).toBe('phone');
  });
  it('英文表头 / 大小写 / 空格不敏感', () => {
    expect(mapHeaderToKey('Name')).toBe('name');
    expect(mapHeaderToKey('  Budget ')).toBe('budget');
    expect(mapHeaderToKey('COMPANY')).toBe('company');
  });
  it('未知表头返回 null', () => {
    expect(mapHeaderToKey('备注')).toBeNull();
    expect(mapHeaderToKey('')).toBeNull();
    expect(mapHeaderToKey(null)).toBeNull();
  });
});

describe('computeRowStatus', () => {
  it('全部必填齐全 → ok', () => {
    const row = { name: '甲', company: '乙', contact: '丙', title: '采购总监', budget: '800万', industry: '制造业', level: 'B', timeline: '是' };
    expect(computeRowStatus(row)).toBe('ok');
  });
  it('缺 1-2 项 → partial', () => {
    const row = { name: '甲', company: '乙', contact: '丙', title: '采购总监', budget: '', industry: '制造业', level: 'B', timeline: '是' };
    expect(computeRowStatus(row)).toBe('partial');
  });
  it('缺 3 项及以上 → review', () => {
    const row = { name: '甲', company: '乙' };
    expect(computeRowStatus(row)).toBe('review');
  });
});

describe('rowsToImportData', () => {
  it('把表头行转为 IMPORT_DATA 结构并带 status', () => {
    const raw = [
      { 线索名称: 'A项目', 公司: 'A集团', 联系人: '张三', 职位: '采购总监', 预算: '800万', 行业: '制造业', 级别: 'B — 重点', 时间计划: '是', 电话: '13800000000' },
      { 线索名称: 'B项目', 公司: 'B集团' },
    ];
    const out = rowsToImportData(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: 'A项目', company: 'A集团', contact: '张三', title: '采购总监', industry: '制造业', phone: '13800000000', status: 'ok' });
    expect(out[1].status).toBe('review');
  });
  it('跳过整行为空的数据', () => {
    const raw = [{ 备注: '', 其它: '' }, { 公司: '只有公司' }];
    const out = rowsToImportData(raw);
    expect(out).toHaveLength(1);
    expect(out[0].company).toBe('只有公司');
  });
  it('数字单元格转为字符串', () => {
    const out = rowsToImportData([{ 公司: 'X', 预算: 800 }]);
    expect(out[0].budget).toBe('800');
  });
  it('非数组输入返回空数组', () => {
    expect(rowsToImportData(null)).toEqual([]);
    expect(rowsToImportData(undefined)).toEqual([]);
  });
});

describe('batchTemplateCsv', () => {
  it('含表头与一行示例', () => {
    const csv = batchTemplateCsv();
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('线索名称');
    expect(lines[0]).toContain('电话');
    expect(lines[1]).toContain('示例');
  });
});
