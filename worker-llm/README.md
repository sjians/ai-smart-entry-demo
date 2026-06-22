# 手搓 Agent · LLM 代理（Cloudflare Worker）

前端是纯静态站点（GitHub Pages / 单文件 HTML），**不能**直接调大模型：要么被浏览器 CORS 拦截（国内厂商尤甚），要么会把密钥暴露在前端。
这个 Worker 就是那个「中间人」：替前端保管密钥、解决跨域，把对话转发给你选的大模型，再把结果传回。

```
浏览器(messages+tools) ──▶ 本 Worker(持密钥) ──▶ 大模型厂商 ──▶ 回复/工具调用 ──▶ 浏览器
```

> 这是给真·AI 用的第二个 Worker，和 `worker/`（百度 OCR 代理）各自独立部署、互不影响。

## 部署步骤（约 3 分钟）

> 需要：一个免费 Cloudflare 账号；本机已装 Node。

```bash
cd worker-llm
npm install            # 安装 wrangler

npx wrangler login     # 浏览器弹出 → 点 Authorize 授权

# 选厂商（默认 deepseek）。要换厂商就改 wrangler.toml 里的 LLM_PROVIDER，或下行临时覆盖：
#   npx wrangler deploy --var LLM_PROVIDER:openai

# 设置该厂商的 API Key（加密存储在 Cloudflare，绝不进仓库/前端）
npx wrangler secret put LLM_API_KEY    # 回车后粘贴你的大模型 API Key

npx wrangler deploy    # 部署，输出形如 https://smart-entry-llm.<你的子域>.workers.dev
```

## 支持的厂商（`LLM_PROVIDER`）

| 值 | 厂商 | 默认模型 | 备注 |
| --- | --- | --- | --- |
| `deepseek`（默认） | DeepSeek | `deepseek-chat` | 中文强、便宜，推荐 |
| `openai` | OpenAI | `gpt-4o-mini` | |
| `kimi` | 月之暗面 Kimi | `moonshot-v1-8k` | |
| `qwen` | 阿里通义千问 | `qwen-plus` | OpenAI 兼容模式端点 |
| `zhipu` | 智谱 GLM | `glm-4-flash` | |
| `anthropic` | Claude | `claude-3-5-sonnet-latest` | Worker 自动做格式翻译 |
| `custom` | 自建/其它 | 需自带 | 配 `LLM_BASE_URL`（OpenAI 兼容） |

换默认模型：`wrangler.toml` 里设 `LLM_MODEL`，或前端「AI 设置」里填模型名（前端传的优先）。

## 让前端用上它

把部署输出的 Worker 地址告诉前端，二选一：

- **临时（演示最快，不重新构建）**：在 Demo 页右上角点状态徽标 →「AI 设置」→ 粘贴地址 → 保存。
  （等价于 `localStorage.setItem('LLM_PROXY_URL','https://smart-entry-llm.xxx.workers.dev')`）
- **永久（写进构建，分发给客户）**：把地址填到 `src/agent/agentConfig.js` 的 `BUILT_IN_LLM_PROXY_URL`，再 `npm run build`。客户端打开即真·AI。

## 接口约定

- 请求：`POST`，body 为 OpenAI chat-completions 形状 `{ messages, tools, tool_choice, model? }`
- 返回：`{ "message": { role, content, tool_calls? }, "provider": "...", "model": "..." }`
- 出错：`{ "error": "...", "error_msg": "..." }`（HTTP 4xx/5xx）

## 防滥用（可选，建议给"任何人都能用"的公开 Demo 加上）

- **收紧 CORS**：`wrangler.toml` 里设 `ALLOW_ORIGIN = "https://你的域名"`，只允许你的页面调用。
- **加访问令牌**：`npx wrangler secret put APP_TOKEN`（设一个随机串）。设了之后，前端请求需带 `x-app-token` 头与之匹配，否则 401。
- 已内置：单次请求消息条数 / 体积上限，防止超大输入。
- 兜底：即便 Worker 挂了或超预算，前端会自动回落本地规则引擎，Demo 不会"开天窗"。

## 说明

- Cloudflare Workers 免费版每天 10 万次请求；真正花钱的是你在大模型厂商那边的 token 消耗——**这把开放给"任何人"用的 Demo，记得用便宜模型（如 deepseek-chat）并考虑加上面的令牌限制。** 密钥在你手里，随时可在厂商后台轮换/停用。
