import { describe, it, expect } from 'vitest';
import { smartExtract } from '../src/core/smartExtract.js';

describe('smartExtract · 微信需求样本', () => {
  const text = '客户微信发来：我们鸿图智造集团有个电子设计集采项目，要采购一套面向物探产线的 EDA 协同平台，预算大概3亿元，电力行业，产品方向物探及智能化，项目在上海浦东，联系人林志远采购总监，电话13800000001，我们是战略支柱客户，投标截止2026-08-31，争取今年内完成招标';
  const r = smartExtract(text);

  it('识别业主（命中已知客户库前缀）', () => { expect(r.owner).toBe('鸿图智造'); });
  it('识别联系人姓名', () => { expect(r.contact).toBe('林志远'); });
  it('识别手机号', () => { expect(r.phone).toBe('13800000001'); });
  it('预算规范化为「3亿元」', () => { expect(r.budget).toBe('3亿元'); });
  it('行业关键词命中电力', () => { expect(r.industry).toBe('电力'); });
  it('产品分类命中物探及智能化', () => { expect(r.productCat).toBe('物探及智能化'); });
  it('地址补全为上海市', () => { expect(r.address).toBe('上海市'); });
  it('所属区划由地址推断', () => { expect(r.region).toBe('上海市/上海城区'); });
  it('客户等级识别为战略支柱客户', () => { expect(r.custLevel).toBe('战略支柱客户'); });
  it('线索级别识别为 S — 战略级', () => { expect(r.level).toBe('S — 战略级'); });
  it('时间计划明确', () => { expect(r.timeline).toBe('是'); });
  it('国家默认中国', () => { expect(r.country).toBe('中国'); });
  it('线索描述提取「电子设计集采」', () => { expect(r.desc).toBe('电子设计集采'); });
  it('新建线索默认未生成商机 / 为私有', () => {
    expect(r.toOpportunity).toBe('未完成');
    expect(r.isPrivate).toBe('是');
  });
});

describe('smartExtract · 电话沟通样本', () => {
  const text = '刚跟东方汽车集团的信息化总监李梅通了电话，他们要做一套产线视觉质检 AI 系统，汽车制造业，预算1200万，希望今年Q3完成选型采购，联系电话13800000003，重要客户，投标截止2026-07-15，目前在技术调研阶段';
  const r = smartExtract(text);

  it('识别业主东方汽车', () => { expect(r.owner).toBe('东方汽车'); });
  it('识别联系人李梅', () => { expect(r.contact).toBe('李梅'); });
  it('识别职位为信息化总监', () => { expect(r.title).toBe('信息化总监'); });
  it('手机号 13800000003', () => { expect(r.phone).toBe('13800000003'); });
  it('预算 1200万元', () => { expect(r.budget).toBe('1200万元'); });
  it('行业命中汽车（优先于制造业）', () => { expect(r.industry).toBe('汽车'); });
  it('产品分类命中视觉质检', () => { expect(r.productCat).toBe('视觉质检'); });
  it('线索级别 A — 重点（重要客户）', () => { expect(r.level).toBe('A — 重点'); });
  it('Q3 触发时间计划明确', () => { expect(r.timeline).toBe('是'); });
});

describe('smartExtract · 预算单位规范化', () => {
  it('万元 → 原值万元', () => { expect(smartExtract('预算2000万').budget).toBe('2000万元'); });
  it('亿 → 折算并以亿元展示', () => { expect(smartExtract('预算1.5亿').budget).toBe('1.5亿元'); });
  it('百万 → 折算为万元', () => { expect(smartExtract('预算5百万').budget).toBe('500万元'); });
  it('千万 → 折算为万元', () => { expect(smartExtract('预算3千万').budget).toBe('3000万元'); });
  it('带千分位逗号', () => { expect(smartExtract('预算1,200万').budget).toBe('1200万元'); });
});

describe('smartExtract · 编码引用自动转换', () => {
  const r = smartExtract('客户行业编码01，客户等级A，需要供应链系统');
  it('行业编码 01 → 电力', () => { expect(r.industry).toBe('电力'); });
  it('行业编码来源记录在 _codes', () => {
    expect(r._codes.industry).toEqual({ code: '01', type: '行业编码' });
  });
  it('客户等级编码 A → 战略支柱客户', () => { expect(r.custLevel).toBe('战略支柱客户'); });
  it('客户等级编码来源记录在 _codes', () => {
    expect(r._codes.custLevel).toEqual({ code: 'A', type: '客户等级编码' });
  });
});

describe('smartExtract · 投标截止日期 / 状态', () => {
  it('「X月X日开标」格式', () => { expect(smartExtract('预计8月15日开标').bidDeadline).toBe('8月15日'); });
  it('「下个月开标」→ 下月（待定）', () => { expect(smartExtract('客户说下个月开标').bidDeadline).toBe('下月（待定）'); });
  it('已初步交流状态', () => { expect(smartExtract('已初步交流，客户鸿图智造').status).toBe('已初步交流'); });
  it('方案沟通中状态', () => { expect(smartExtract('正在做方案，客户东方汽车').status).toBe('方案沟通中'); });
});

describe('smartExtract · 联系人姓名+职位（标题在前）', () => {
  it('采购总监王明 → 王明 / 采购总监', () => {
    const r = smartExtract('对接人采购总监王明，电话13900000000');
    expect(r.contact).toBe('王明');
    expect(r.title).toBe('采购总监');
  });
});

describe('smartExtract · 严格原则（不臆测）', () => {
  it('无信息文本返回空对象', () => {
    expect(Object.keys(smartExtract('你好，在吗')).length).toBe(0);
  });
  it('纯寒暄不产生电话/预算', () => {
    const r = smartExtract('今天天气不错');
    expect(r.phone).toBeUndefined();
    expect(r.budget).toBeUndefined();
  });
});
