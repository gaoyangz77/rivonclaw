<p align="center">
  <img src="assets/LOGO_CN.png" width="300" alt="爪爪">
</p>

<p align="center">
  <a href="README.md">English</a> | 中文
</p>

## 为什么需要 RivonClaw？

[OpenClaw](https://github.com/openclaw/openclaw) 是一个强大的 Agent 运行时，
但直接使用它需要管理配置文件、本地进程、服务商凭据、通道插件和更新流程。
RivonClaw 把这套运行时包装成桌面应用，并在本地面板、服务商管理、移动端/通道集成、
电商业务流程和发布基础设施上提供产品层能力。

OpenClaw 是引擎；RivonClaw 是桌面驾驶舱和业务层。

## 当前能力

- **桌面运行时管理**：Electron 桌面应用负责 OpenClaw 网关生命周期、本地面板服务、
  更新检查和用户数据。
- **本地面板 UI**：React/Vite 面板支持聊天、服务商、通道、技能、定时任务、用量、
  设置、账号/计费，以及受权限控制的电商模块。
- **LLM 服务商管理**：支持 API Key、OAuth、自定义 OpenAI-compatible、本地 Ollama、
  订阅/编程计划、代理、模型目录、重新授权和用量查询。
- **通道集成**：支持 OpenClaw 通道配置，以及 RivonClaw 自有的移动聊天、微信包装、
  事件桥接和能力约束插件。
- **云端业务模块**：认证后的云端 GraphQL 代理、账号与计费状态、TikTok/电商界面、
  客服桥接和 Affiliate 工作流。
- **技能市场**：浏览/安装云端技能，管理本地已安装技能，并打开用户技能目录。
- **Token 与 Key 用量**：聚合会话用量、按 Key 记录历史，并在服务商支持时拉取订阅额度。
- **语音转文字与扩展能力**：STT 凭据/转写路由，以及 web search / embedding 凭据管理。
- **动态工具权限**：基于生成的 tool spec、run profile、surface 和 capability-manager
  插件控制当前运行可见工具。
- **自动更新与发布流水线**：electron-builder 安装包、更新清单、GitHub draft release、
  生产网站发布和 CDN 刷新脚本。

## 环境要求

| 工具 | 版本 |
| --- | --- |
| Git | 任意 |
| Node.js | >= 24 |
| pnpm | 10.6.2 |

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/gaoyangz77/rivonclaw.git
cd rivonclaw

# 2. 克隆/构建固定版本的 OpenClaw 运行时并应用 vendor patch
./scripts/setup-vendor.sh

# 3. 安装依赖并构建
pnpm install
pnpm build

# 4. 开发模式启动
pnpm --filter @rivonclaw/desktop dev
```

桌面应用会启动 Electron、拉起 OpenClaw 网关，并在动态分配的 localhost 端口提供面板。
开发模式下面板使用 Vite dev server：`http://localhost:5180`。

## 仓库结构

```text
rivonclaw/
├── apps/
│   ├── desktop/              # Electron 主进程、本地 API、网关运行时
│   └── panel/                # React 管理面板
├── packages/
│   ├── core/                 # 共享类型、默认值、API 契约、MST 模型
│   ├── device-id/            # 设备指纹
│   ├── gateway/              # OpenClaw 配置、启动器、OAuth、技能、vendor helper
│   ├── logger/               # 结构化日志
│   ├── plugin-sdk/           # RivonClaw/OpenClaw 扩展 helper
│   ├── proxy-router/         # 本地代理路由
│   ├── secrets/              # Keychain / DPAPI / 文件回退密钥存储
│   ├── storage/              # SQLite repository 与 migration
│   ├── stt/                  # 语音转文字抽象
│   ├── telemetry/            # 遥测客户端
│   └── updater/              # 更新清单客户端
├── extensions/
│   ├── channel-weixin/
│   ├── rivonclaw-capability-manager/
│   ├── rivonclaw-event-bridge/
│   ├── rivonclaw-mobile-chat-channel/
│   └── rivonclaw-search-browser-fallback/
├── extensions-merchant/      # CI/dev 中签出的私有商家插件
├── server/                   # Backend、relay、website、telemetry、部署脚本
├── scripts/                  # 仓库自动化脚本
├── vendor-patches/openclaw/  # 可重放的 OpenClaw patch
└── vendor/openclaw/          # 固定版本 OpenClaw checkout（本地生成/忽略）
```

## 工作区

Monorepo 使用 pnpm workspaces（`apps/*`、`packages/*`、`extensions/*`、
`extensions-merchant/*`），并通过 Turbo 编排构建。

### 应用

| 包 | 说明 |
| --- | --- |
| `@rivonclaw/desktop` | Electron 40 桌面应用。负责应用生命周期、本地 API、网关启动、配置写入、存储、更新、遥测，以及云端/客服/移动端桥接。 |
| `@rivonclaw/panel` | React 19 + Vite 6 SPA。实现聊天、服务商配置、通道、扩展能力、技能、定时任务、用量、设置、账号、计费和电商界面。 |

### 包

| 包 | 说明 |
| --- | --- |
| `@rivonclaw/core` | 共享默认值、类型、API 路由契约、服务商目录、MST 模型、生成的 GraphQL 类型和工具函数。 |
| `@rivonclaw/gateway` | OpenClaw 配置写入、启动器、OAuth profile 同步、通道配置写入、模型目录读取、技能刷新 helper 和 vendor helper。 |
| `@rivonclaw/storage` | SQLite repositories：settings、provider keys、usage、chat sessions、channel accounts/recipients、mobile pairings、tool selections、CS escalations。 |
| `@rivonclaw/secrets` | 面向 API Key 和 OAuth 凭据的平台密钥存储。 |
| `@rivonclaw/proxy-router` | 面向服务商和一方域名网络路径的本地 HTTP 代理路由。 |
| `@rivonclaw/stt` | STT 服务商工具。 |
| `@rivonclaw/telemetry` | 遥测客户端，包含用户 opt-in 事件和业务遥测通道。 |
| `@rivonclaw/updater` | 桌面更新器使用的版本和清单工具。 |
| `@rivonclaw/logger` | 共享日志设置。 |
| `@rivonclaw/device-id` | 稳定设备身份 helper。 |
| `@rivonclaw/plugin-sdk` | 扩展包共享 helper。 |

### 扩展

| 包 | 说明 |
| --- | --- |
| `openclaw-weixin` | Tencent Weixin OpenClaw 通道包装层，包含 RivonClaw 兼容性修复。 |
| `@rivonclaw/rivonclaw-capability-manager` | 针对当前运行上下文约束有效工具可见性。 |
| `@rivonclaw/rivonclaw-event-bridge` | 将部分 OpenClaw agent 事件镜像到面板事件流。 |
| `@rivonclaw/rivonclaw-mobile-chat-channel` | 移动聊天通道插件和 relay 同步逻辑。 |
| `@rivonclaw/rivonclaw-search-browser-fallback` | 当缺少直接搜索凭据时，引导搜索 fallback 行为。 |

商家专用插件位于 `extensions-merchant/*`，CI 会从私有 merchant extensions 仓库签出。

## 常用脚本

```bash
pnpm build                    # 生成 vendor artifacts、检查 extension deps、构建全部包
pnpm dev                      # 运行 desktop + panel 开发流程
pnpm test                     # 运行 workspace tests
pnpm lint                     # 运行 workspace lint
pnpm format                   # 使用 oxfmt 检查格式
pnpm format:fix               # 应用 oxfmt 格式化
pnpm check:vendor-boundary    # 检查 vendor boundary 规则
pnpm check:tools              # 检查生成 tool IDs / i18n / backend 一致性
```

单包示例：

```bash
pnpm --filter @rivonclaw/desktop dev
pnpm --filter @rivonclaw/desktop test
pnpm --filter @rivonclaw/desktop test:e2e
pnpm --filter @rivonclaw/desktop dist:mac:arm64
pnpm --filter @rivonclaw/desktop dist:win
pnpm --filter @rivonclaw/panel dev
pnpm --filter @rivonclaw/panel build
```

## 架构概览

```text
Electron Desktop
  ├─ 本地 panel server 和类型化 REST/SSE 路由
  ├─ SQLite storage + OS secret store
  ├─ OpenClaw config writer 和 launcher
  ├─ 支持代理的一方/云端 GraphQL/REST client
  ├─ Backend subscription client
  ├─ Channel / mobile / CS / ecommerce bridges
  └─ Auto-updater

React Panel
  ├─ 通过 Desktop 调本地 REST API
  ├─ 通过 Desktop proxy 调云端 GraphQL
  ├─ 通过 /api/events 同步 MST entity/runtime store
  └─ Chat、providers、channels、skills、crons、ecommerce、settings

OpenClaw Gateway
  ├─ 固定版本 vendor runtime
  ├─ vendor-patches/openclaw 中的 patch
  ├─ 自动发现的 extensions
  └─ 用户安装的 skills
```

当前 Desktop ↔ Panel API 的唯一事实源是
[`packages/core/src/api/api-contract.ts`](packages/core/src/api/api-contract.ts)。
生成后的路由参考见 [`docs/API_ROUTES.md`](docs/API_ROUTES.md)。

## 数据目录

默认路径由 [`packages/core/src/node-utils/paths.ts`](packages/core/src/node-utils/paths.ts) 解析。

| 路径 | 用途 |
| --- | --- |
| `~/.rivonclaw/db.sqlite` | Desktop SQLite 数据库 |
| `~/.rivonclaw/logs/` | 应用日志 |
| `~/.rivonclaw/secrets/` | 文件密钥存储回退 |
| `~/.rivonclaw/openclaw/` | OpenClaw 状态目录 |
| `~/.rivonclaw/openclaw/openclaw.json` | 生成的网关配置 |
| `~/.rivonclaw/openclaw/agents/<agentId>/sessions/` | OpenClaw 会话 |
| `~/.rivonclaw/openclaw/skills/` | 用户安装的技能 |
| `~/.rivonclaw/openclaw/credentials/` | OAuth / 通道 / 移动端凭据 |

## 发布

当前发布流程见 [`docs/RELEASE.md`](docs/RELEASE.md)。简要流程：更新
`apps/desktop/package.json` 版本，手动触发 GitHub `Build & Release` workflow，
本地运行 `./scripts/test-local.sh`，用 `./scripts/publish-release.sh` 发布 draft
GitHub Release，然后在 `server/` 仓库中推进网站下载文件和 CDN 状态。

## License

MIT。见 [LICENSE](LICENSE)。
