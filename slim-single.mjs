// 把单文件产物里的图标字体精简为仅 woff2（现代浏览器全支持），去掉 eot/woff/ttf 三份内联 base64，瘦身。
import { readFileSync, writeFileSync, statSync } from 'node:fs';
const SRC = 'dist-single/index.html';
const OUT_DL = 'C:\\Users\\sunjian\\Downloads\\AI智能录入_交互原型.html';

let html = readFileSync(SRC, 'utf8');
const before = statSync(SRC).size;

// 取出 woff2 的 url(...) format("woff2") 片段（数据 URI 不带引号）
const m = html.match(/url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\)\s*format\("woff2"\)/);
if (!m) { console.error('未找到 woff2 片段，已中止(不破坏文件)'); process.exit(1); }

// 用「仅 woff2」重建 tabler 的 @font-face 整块（块内 eot/woff/ttf 的 base64 随之删除）
const face = '@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;font-display:block;src:' + m[0] + '}';
const replaced = html.replace(/@font-face\{[^{}]*tabler-icons[^{}]*\}/, face);
if (replaced === html) { console.error('未匹配到 tabler @font-face 块，已中止', '\n样例:', m[0].slice(0, 60)); process.exit(1); }
html = replaced;

writeFileSync(SRC, html);
writeFileSync(OUT_DL, html);
const kb = (n) => Math.round(n / 1024) + ' KB';
console.log('精简前:', kb(before), '→ 精简后:', kb(Buffer.byteLength(html)));
console.log('已输出:', OUT_DL);
