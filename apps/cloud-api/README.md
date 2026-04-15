# DlxAI Cloud API

后端服务，为 DlxAI 桌面端提供用户认证、积分系统、LLM 代理和版本更新推送。

## 技术栈

- **Hono** — HTTP 框架
- **PostgreSQL** — 数据库
- **Jose** — JWT 签发/验证
- **Node.js 20+**

## 本地开发

```bash
# 1. 确保 PostgreSQL 运行，创建数据库
createdb dlxai_credits

# 2. 初始化表结构
psql dlxai_credits < src/db/schema.sql

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际值

# 4. 启动开发服务器 (热重载)
pnpm dev
```

## 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:123@localhost:5432/dlxai_credits` |
| `OPENROUTER_MASTER_KEY` | OpenRouter API Key（代理转发用） | `sk-or-v1-...` |
| `ADMIN_KEY` | 发版管理密钥 | `your-secret-key` |
| `FREE_CREDITS` | 新用户赠送积分 | `100` |
| `DAILY_FREE_TOKENS` | 每日免费 token 额度 | `100000` |
| `PORT` | 监听端口 | `3100` |

## 生产部署

```bash
pnpm build          # 编译到 dist/
node dist/index.js  # 启动
```

推荐用 PM2 管理进程：
```bash
pm2 start dist/index.js --name dlxai-api
```

---

## API 接口文档

基础地址：`http://localhost:3100`

### 认证

大部分接口需要 JWT 认证，在 Header 中传递：
```
Authorization: Bearer <token>
```

---

### 1. 认证 `/api/auth`

#### `POST /api/auth/device` — 设备登录

自动注册，首次登录赠送免费积分。

```json
// Request
{ "deviceId": "bc46cfb4-xxxx-xxxx" }

// Response 200
{ "token": "eyJ...", "balance": 100 }
```

#### `POST /api/auth/register` — 邮箱注册

```json
// Request
{ "email": "user@example.com", "password": "12345678" }

// Response 200
{ "token": "eyJ...", "userId": "uuid" }

// Response 409
{ "error": "Email already registered" }
```

#### `POST /api/auth/login` — 邮箱登录

```json
// Request
{ "email": "user@example.com", "password": "12345678" }

// Response 200
{ "token": "eyJ...", "userId": "uuid" }

// Response 401
{ "error": "Invalid email or password" }
```

#### `GET /api/auth/me` — 当前用户信息 `🔒`

```json
// Response 200
{ "userId": "uuid", "email": "user@example.com", "plan": "free" }
```

---

### 2. 积分 `/api/credits` `🔒`

#### `GET /api/credits/balance` — 查询余额

```json
// Response 200
{ "balance": 95 }
```

#### `GET /api/credits/history` — 消费记录

参数：`?page=1&limit=20`

```json
// Response 200
{
  "entries": [
    { "id": "uuid", "delta": -5, "reason": "consumption", "model": "openrouter/free", "tokens": 1200, "created_at": "..." }
  ],
  "total": 42
}
```

#### `GET /api/credits/quota` — 每日配额

```json
// Response 200
{
  "plan": "free",
  "show_model": false,
  "daily": { "used": 12000, "limit": 100000, "resets_at": "2026-04-16T00:00:00.000Z" },
  "monthly": null
}
```

---

### 3. LLM 代理 `/api/proxy` `🔒`

#### `POST /api/proxy/openrouter/chat/completions` — OpenRouter 代理

透传到 OpenRouter API，自动扣费。免费用户只能使用 free 模型。

```json
// Request (OpenAI 格式)
{
  "model": "openrouter/free",
  "messages": [{ "role": "user", "content": "Hello" }],
  "stream": true
}

// Response: SSE 流 或 JSON (取决于 stream 参数)

// Response 403 (非免费模型 + 无订阅)
{ "error": "Model not available on free plan. Upgrade to access premium models." }

// Response 402 (额度用完)
{ "error": "Daily quota exceeded. Resets at midnight." }
```

免费模型列表见 `src/config/free-models.ts`。

---

### 4. 订阅 `/api/subscription` `🔒`

#### `GET /api/subscription/` — 查询当前订阅

```json
// Response 200 (有订阅)
{ "subscription": { "id": "uuid", "tier": "basic", "tokens_monthly": 5000000, "tokens_used": 120000, "period_start": "2026-04-01", "period_end": "2026-05-01", "status": "active" } }

// Response 200 (无订阅)
{ "subscription": null }
```

#### `POST /api/subscription/create` — 创建订阅（暂未开放）

```json
// Request
{ "tier": "basic" }

// Response 200
{ "status": "pending", "message": "支付功能即将上线，敬请期待" }
```

---

### 5. 充值 `/api/recharge` `🔒`

#### `POST /api/recharge/create` — 创建充值订单（暂未开放）

```json
// Response 200
{ "orderId": null, "status": "unavailable", "message": "充值功能即将上线，敬请期待" }
```

---

### 6. 版本发布 `/api/releases`

#### `GET /api/releases/latest` — 查询最新版本

无需认证。

```json
// Response 200 (有发布)
{ "version": "1.0.1", "downloadUrl": "https://...", "notes": "Bug fixes", "platform": "all", "publishedAt": "2026-04-15T08:00:00.000Z" }

// Response 200 (无发布)
{ "version": null }
```

#### `GET /api/releases/subscribe?v=1.0.0` — SSE 更新推送

无需认证。长连接，有新版本时实时推送。

```
// 连接后立即收到当前最新版 (如果比 v 参数新)
data: {"version":"1.0.1","downloadUrl":"https://..."}

// 有新版本发布时推送
data: {"version":"1.0.2","downloadUrl":"https://..."}

// 每 30s 心跳
: keepalive
```

#### `POST /api/releases/` — 发布新版本 `🔑 Admin`

需要 `X-Admin-Key` header。

```bash
curl -X POST http://localhost:3100/api/releases \
  -H "X-Admin-Key: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"version": "1.0.2", "downloadUrl": "https://example.com/app.exe", "notes": "新功能", "platform": "all"}'
```

```json
// Response 200
{ "ok": true, "version": "1.0.2" }

// Response 401
{ "error": "Unauthorized" }
```

---

### 7. 健康检查

#### `GET /health`

```json
{ "ok": true }
```
