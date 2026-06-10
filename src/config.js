// ===== 运行时配置 =====
// OCR_PROXY_URL：百度 OCR 的 Cloudflare Worker 代理地址。
//   - 部署第二步（worker/ 目录）后，把 Worker 的公网地址填到这里（形如 https://xxx.workers.dev）。
//   - 留空时，「真实图片识别」入口会优雅回退到示例演示，不影响其它功能。
// 也可在浏览器里用 localStorage.setItem('OCR_PROXY_URL','https://xxx.workers.dev') 临时覆盖（便于演示时切换）。

const BUILT_IN_OCR_PROXY_URL = 'https://baidu-ocr-proxy.sjian-demo.workers.dev';

function readOverride() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem('OCR_PROXY_URL');
    return v && v.trim() ? v.trim() : '';
  } catch (_) {
    return '';
  }
}

export const config = {
  get OCR_PROXY_URL() {
    return readOverride() || BUILT_IN_OCR_PROXY_URL;
  },
};
