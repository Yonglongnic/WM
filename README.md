# AI agent-全球态势监测平台(WM) V1.1

这是一个以本地 Docker 镜像运行的实时全球态势监测平台，项目名称为 **AI agent-全球态势监测平台(WM)**，当前版本为 **V1.1**。平台聚合新闻、地缘政治、军事、金融、能源、气候、网络安全、航空和海事等公开数据，并通过地图、仪表盘和专题面板统一展示。

当前版本针对本地单机使用进行了调整：无需登录、无需会员资格；涉及付费服务的路径在本地模式下不会阻塞页面；未配置的可选 API Key 会自动使用免费公开数据源或进入可用的降级路径。

## 主要能力

- 交互式全球地图：平面地图与 3D 地球视图
- 地缘政治、冲突、军事、能源、金融、气候、灾害、航空、海事和网络安全面板
- 多个专题视图：综合、科技、金融、商品、能源和积极事件
- 新闻聚合、来源追踪、国家风险、热点和趋势分析
- 本地公开访问模式：不要求登录，不展示会员锁定
- Redis 缓存与 AIS Relay 数据中继，减少浏览器直接访问上游服务
- Docker 镜像交付，运行依赖只存在于项目容器和项目卷中

## 一条命令启动

在当前项目目录执行：

```powershell
docker compose -p worldmonitor-local up -d --build
```

打开：<http://localhost:3000>

已经构建过镜像时，可以使用：

```powershell
docker compose -p worldmonitor-local up -d --no-build
```

停止服务：

```powershell
docker compose -p worldmonitor-local down
```

## 环境变量

Docker Compose 从当前目录的 `.env` 读取变量。以下三项是本地栈自身需要的运行凭据：

- `REDIS_TOKEN`
- `REDIS_PASSWORD`
- `RELAY_SHARED_SECRET`

其他数据源和 AI 变量均为可选。不要把真实密钥提交到版本库，也不要在日志、截图或测试输出中打印密钥。

本地模式下，以下空变量不会导致页面不可用：

| 空变量 | 免费或公开降级路径 |
|---|---|
| `OPENAQ_API_KEY` | WAQI 免费接口 |
| `ENTSO_E_TOKEN` | Energy-Charts 公共接口 |
| `GIE_API_KEY` | AGSI+ 公共接口 |
| `COMTRADE_API_KEYS` | UN Comtrade Preview 接口 |
| `TELEGRAM_API_ID` | GDELT 新闻检索 |
| `BRAVE_API_KEYS` | GDELT 搜索降级 |

## Docker 服务

Compose 会启动四个服务：

| 服务 | 作用 | 本机暴露端口 |
|---|---|---|
| `worldmonitor` | Nginx 静态前端 + Node API sidecar | `3000` |
| `ais-relay` | 数据中继、市场刷新和实时数据缓存 | 容器网络 `3004` |
| `redis` | 内部缓存存储 | 不暴露 |
| `redis-rest` | API sidecar 和 relay 使用的 Redis HTTP 适配层 | `127.0.0.1:8079` |

前端请求通过 `/api/*` 进入 sidecar；sidecar 使用 Redis 缓存和 relay 数据，只有需要实时拉取的数据才访问公开上游服务。容器健康检查使用 `/api/sidecar-health`。

## 测试与验收

宿主机不需要安装 Node.js 或激活虚拟环境。项目测试在构建容器内执行：

```powershell
docker run --rm worldmonitor-builder:local npm run typecheck
docker run --rm worldmonitor-builder:local npm run typecheck:api
docker run --rm worldmonitor-builder:local node --check api/telegram-feed.js
docker run --rm worldmonitor-builder:local node --check scripts/ais-relay.cjs
```

专项测试示例：

```powershell
docker run --rm `
  -v "${PWD}\tests:/app/tests:ro" `
  worldmonitor-builder:local `
  node --import tsx/esm --test tests/air-quality-seed.test.mjs tests/electricity-prices-seed.test.mjs tests/gie-gas-storage-seed.test.mjs tests/gas-storage-countries-seed.test.mjs tests/seed-recovery-import-hhi.test.mjs tests/seed-comtrade-5xx-retry.test.mjs
```

运行态验收至少应确认：

1. `docker compose -p worldmonitor-local ps` 中核心容器为 healthy。
2. 首页、金融、能源、设置、直播和嵌入页面返回 HTTP 200。
3. `/api/sidecar-health` 和 `/api/bootstrap?tier=fast&public=1` 返回成功。
4. 空 Telegram 配置时 `/api/telegram-feed` 返回可用的 GDELT 降级结构。

## 目录说明

```text
src/                 前端 TypeScript/Preact 组件、服务、面板和样式
api/                 API 路由与 Edge 风格处理器
server/              服务端 RPC、网关和领域处理器
scripts/             relay、数据刷新器和构建检查
src-tauri/           桌面 sidecar 及本地 API 适配
public/              静态资源和可抓取页面
docker/              Nginx、Redis REST 和容器启动配置
tests/               单元、集成和契约测试
e2e/                 Playwright 端到端测试
```

## 变更原则

- 页面必须在没有登录态和会员态时仍能加载。
- 可选外部服务失败时优先保留最近一次有效缓存，并提供明确降级。
- 新增数据源必须补充来源说明、健康检查和对应测试。
- 任何修改都必须在 Docker 构建环境中完成类型检查和运行态验证。
- 原始数据源的名称、许可证和归因信息应按各自条款保留；它们不是平台署名信息。

## 许可证

源代码许可证以项目目录中的 `LICENSE` 文件为准；第三方库、地图、新闻和数据服务遵循各自的许可证及使用条款。
