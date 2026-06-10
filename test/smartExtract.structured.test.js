// 结构化「标签：值」解析 + 电话边界 的回归测试（对应真实上传文档/图片/发票场景）
import { describe, it, expect } from 'vitest';
import { smartExtract } from '../src/core/smartExtract.js';

describe('smartExtract · 结构化标签解析（CRM 截图 OCR）', () => {
  const eimos = '基本信息 买方信息 项目编号：PRJ20260608-011 项目名称：菲诺泰克新材料工程 客户经理：谢淏天 商务经理：陆鸿 采购方（客户名称）：浙江依创电力科技有限公司 采购方（客户编码）：KH20211110-6806 项目状态：评审中 项目地：中国/浙江省/杭州市 预计签约日期：- 更新时间：2026/06/08 13:21:09';
  const r = smartExtract(eimos);

  it('从「项目名称：」取线索名称', () => expect(r.name).toBe('菲诺泰克新材料工程'));
  it('从「采购方（客户名称）：」取业主，并截断到公司后缀', () => expect(r.owner).toBe('浙江依创电力科技有限公司'));
  it('从「客户经理：」取客户经理', () => expect(r.salesManager).toBe('谢淏天'));
  it('从「项目地：中国/浙江省/杭州市」拆出国家/区划/地址', () => {
    expect(r.country).toBe('中国');
    expect(r.region).toBe('浙江省/杭州市');
    expect(r.address).toBe('杭州市');
  });
  it('不把客户编码 KH... 当作其它字段污染', () => expect(r.phone).toBeUndefined());
});

describe('smartExtract · 电话号码边界（避免发票号/订单号误识别）', () => {
  it('长数字串（发票号）中的 11 位不被当作手机号', () => {
    const r = smartExtract('发票号码 26317000002024296423 开票日期 2026年06月01日');
    expect(r.phone).toBeUndefined();
  });
  it('被空格包围的真实手机号能正常识别', () => {
    const r = smartExtract('客户 张伟 13800001234 需求采购系统');
    expect(r.phone).toBe('13800001234');
  });
  it('「联系电话：」标签后的手机号能识别', () => {
    const r = smartExtract('联系人：王芳 联系电话：13912345678');
    expect(r.phone).toBe('13912345678');
    expect(r.contact).toBe('王芳');
  });
});

describe('smartExtract · 发票类文档不产生错误线索名称', () => {
  const invoice = '电子发票 名称： 杭州硕磐智能科技有限公司 91330109MA2HX42G00 上海华程西南国际旅行社有限公司 项目名称   规格型号   单位 *经纪代理服务*代订机票   1830.19   税额   109.81';
  const r = smartExtract(invoice);
  it('买方公司被识别为业主', () => expect(r.owner).toBe('杭州硕磐智能科技有限公司'));
  it('表头「项目名称 规格型号」无冒号，不会被当作线索名称', () => {
    // 没有「项目名称：xxx」的冒号结构，故不应抓到错误名称
    expect(r.name === undefined || r.name === '').toBe(true);
  });
  it('发票金额（无万/亿单位）不被当作预算', () => expect(r.budget).toBeUndefined());
});

describe('smartExtract · 自由文本仍正常（无回归）', () => {
  const r = smartExtract('鸿图智造集团采购一套数据中台，预算3000万，金融行业，联系人张伟，电话13800000002，重要客户');
  it('公司/预算/行业/联系人/电话 正常', () => {
    expect(r.owner).toContain('鸿图智造');
    expect(r.budget).toBe('3000万元');
    expect(r.industry).toBe('金融');
    expect(r.contact).toBe('张伟');
    expect(r.phone).toBe('13800000002');
  });
});
