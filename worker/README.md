# 百度 OCR 代理（Cloudflare Worker）

前端是纯静态站点（GitHub Pages），**不能**直接调百度 OCR：会被浏览器 CORS 拦截，且会暴露 Secret Key。
这个 Worker 就是那个「中间人」：替前端保管百度密钥、解决跨域，把图片转发给百度并返回识别文字。

```
浏览器(图片base64) ──▶ 本 Worker(持密钥) ──▶ 百度 OCR ──▶ 文字 ──▶ 浏览器
```

## 部署步骤（约 3 分钟）

> 需要：一个免费 Cloudflare 账号；本机已装 Node。

```bash
cd worker
npm install            # 安装 wrangler

npx wrangler login     # 浏览器弹出 → 点 Authorize 授权（和 GitHub 那次类似）

# 设置百度密钥（加密存储在 Cloudflare，绝不进仓库/前端）
npx wrangler secret put BAIDU_API_KEY      # 回车后粘贴你的百度 API Key
npx wrangler secret put BAIDU_SECRET_KEY   # 回车后粘贴你的百度 Secret Key

npx wrangler deploy    # 部署，输出形如 https://baidu-ocr-proxy.<你的子域>.workers.dev
```

## 让前端用上它

把上一步输出的 Worker 地址告诉前端，二选一：

- **临时（不改代码，演示时最快）**：在 Demo 页面打开浏览器控制台执行
  ```js
  localStorage.setItem('OCR_PROXY_URL', 'https://baidu-ocr-proxy.xxx.workers.dev')
  ```
  刷新后「真实图片识别」即走百度。

- **永久（写进构建）**：把地址填到 `src/config.js` 的 `BUILT_IN_OCR_PROXY_URL`，然后 `git push` → GitHub Pages 自动重新部署。

## 接口约定

- 请求：`POST`，body `{"image": "<图片的 base64，不含 data: 前缀>"}`
- 返回：`{ "text": "整段文字", "words_result": [{"words":"..."}], "words_result_num": N }`
- 出错：`{ "error": "...", "error_code": ..., "error_msg": "..." }`

## 说明

- 用的是百度「通用文字识别（标准版 general_basic）」，免费额度足够演示；要更高精度可把 `ocr-proxy.js` 里的 `general_basic` 换成 `accurate_basic`。
- access_token 在 Worker 内缓存（百度有效期约 30 天），不会每次都换取。
- CORS 默认放开（`*`）；要收紧就把 `ocr-proxy.js` 里的 `Access-Control-Allow-Origin` 改成你的 Pages 域名。
- Cloudflare Workers 免费版每天 10 万次请求，演示绰绰有余。
