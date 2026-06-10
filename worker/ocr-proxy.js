// ===== 百度 OCR 代理（Cloudflare Worker）=====
// 作用：替前端保管百度 Secret Key、解决浏览器跨域（CORS），把图片转发给百度通用文字识别。
// 前端只把图片 base64 POST 到本 Worker；Secret 永不出现在前端。
//
// 密钥用 wrangler secret 设置（加密存储，不写进代码/仓库）：
//   npx wrangler secret put BAIDU_API_KEY
//   npx wrangler secret put BAIDU_SECRET_KEY
// 详见同目录 README.md。

const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';

// access_token 进程内缓存（百度 token 有效期约 30 天，避免每次都换取）
let cachedToken = null; // { token, exp }

const CORS = {
  'Access-Control-Allow-Origin': '*', // 演示用放开；如需收紧改成 'https://sjians.github.io'
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function getToken(env) {
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 60000) return cachedToken.token;
  const url = `${TOKEN_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(env.BAIDU_API_KEY)}&client_secret=${encodeURIComponent(env.BAIDU_SECRET_KEY)}`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  const data = await r.json();
  if (!data.access_token) throw new Error('获取百度 access_token 失败：' + (data.error_description || data.error || JSON.stringify(data)));
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ? data.expires_in * 1000 : 2592000000) };
  return cachedToken.token;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ error: '仅支持 POST（请用 { image: <base64> }）' }, 405);
    if (!env.BAIDU_API_KEY || !env.BAIDU_SECRET_KEY) {
      return json({ error: '服务端未配置 BAIDU_API_KEY / BAIDU_SECRET_KEY（用 wrangler secret put 设置）' }, 500);
    }
    let body;
    try { body = await request.json(); } catch (_) { return json({ error: '请求体需为 JSON：{ image: <base64> }' }, 400); }
    const image = body && body.image;
    if (!image) return json({ error: '缺少 image 字段（图片 base64，不含 data: 前缀）' }, 400);

    let token;
    try {
      token = await getToken(env);
    } catch (err) {
      // 换取 access_token 失败 = 百度 API Key / Secret Key 有误 → 用 401 区分（便于在代理环境下仅凭状态码判断）
      return json({ error: 'token_failed', detail: String((err && err.message) || err) }, 401);
    }
    try {
      const form = new URLSearchParams();
      form.set('image', image);
      const r = await fetch(`${OCR_URL}?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form.toString(),
      });
      const data = await r.json();
      if (data.error_code) {
        if (data.error_code === 110 || data.error_code === 111) cachedToken = null; // token 失效 → 清缓存
        return json({ error: 'baidu_error', error_code: data.error_code, error_msg: data.error_msg }, 502);
      }
      const words = Array.isArray(data.words_result) ? data.words_result.map((w) => w.words) : [];
      return json({ text: words.join('\n'), words_result: data.words_result || [], words_result_num: data.words_result_num || words.length, log_id: data.log_id });
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 502);
    }
  },
};
