# AI agent-全球态势监测平台(WM) V1.1 架构

## 1. 目标

本项目是一个实时全球态势监测 SPA。浏览器加载静态前端后，通过 `/api/*` 访问本地 Node sidecar；sidecar 从 Redis 读取已缓存数据，必要时调用 relay 或公开上游服务。最终运行形态是本地 Docker Compose，不依赖宿主机 Node.js 或全局服务。

## 2. 服务拓扑

```text
浏览器 :3000
   │
   ▼
worldmonitor 容器
   ├─ Nginx :8080       静态文件、反向代理、健康检查
   └─ Node sidecar      API 路由、网关、缓存读取、降级处理
          │
          ├──────────────► ais-relay :3004
          │                 数据中继、实时刷新、部分 seed loop
          │
          └──────────────► redis-rest :80
                              Redis HTTP 适配
                                      │
                                      ▼
                                  redis :6379
```

Compose 服务及职责：

| 服务 | 职责 | 网络边界 |
|---|---|---|
| `worldmonitor` | 提供 SPA、静态页面、API sidecar | 本机暴露 3000 |
| `ais-relay` | AIS/市场/新闻等中继与持续刷新 | 仅 Compose 网络访问 |
| `redis` | 缓存数据、seed 元信息和锁 | 仅 Compose 网络访问 |
| `redis-rest` | 将有限 Redis 操作转为 HTTP | 仅绑定本机 127.0.0.1:8079 |

## 3. 前端层

主要目录：

- `src/App.ts`：应用启动和页面编排。
- `src/app/`：数据加载、刷新调度、面板布局和事件编排。
- `src/components/`：地图、面板、设置和交互组件。
- `src/config/`：变体、面板、地图图层和市场配置。
- `src/services/`：请求、缓存、分析、状态和领域服务。
- `src/styles/`：主题、布局和组件样式。
- `src/workers/`：分析、机器学习和浏览器后台任务。

Vite 构建结果复制到 Nginx 静态目录。`WM_LOCAL_PUBLIC_ACCESS=true` 时：

- 面板 gate 默认开放本地功能。
- 登录、会员和授权状态不会成为普通页面的前置条件。
- 导出、设置和数据浏览优先走本地公开路径。
- 外部数据暂时不可用时，组件使用缓存、空状态或降级数据，不应让整页崩溃。

## 4. API 与 sidecar

### 4.1 API 路由

`api/` 是独立的 JavaScript 路由层，负责简单 JSON、代理和边缘风格入口。`server/` 包含领域网关、RPC handler、缓存和认证策略。Docker 构建阶段使用 `docker/build-handlers.mjs` 编译需要的 TypeScript handler，运行时由 sidecar 动态分发。

### 4.2 请求流程

```text
组件 fetch('/api/...')
       │
       ▼
Nginx /api 反向代理
       │
       ▼
Node sidecar
       ├─ 本地公开访问策略
       ├─ 路由匹配与参数校验
       ├─ Redis 缓存/seed-meta 读取
       ├─ relay 内部调用
       └─ 必要时调用公开上游 API
       │
       ▼
JSON 响应 + CORS/缓存头
```

健康检查使用 `/api/sidecar-health`，它同时验证 Nginx 到 sidecar 的路径。数据健康检查使用 `/api/health`，不应替代容器 liveness 检查。

## 5. 数据管线

数据刷新器位于 `scripts/`，主要模式为：

1. 读取环境变量和公开数据源配置。
2. 访问上游，设置超时、User-Agent、重试和限流策略。
3. 规范化字段、过滤明显无效或过期记录。
4. 校验最低覆盖率和数据完整性。
5. 写入 Redis 数据键。
6. 写入 `seed-meta:<key>`，记录 `fetchedAt`、记录数和来源版本。

失败时应保留最近一次有效快照或返回明确的空状态。不能用部分失败结果覆盖完整缓存。

## 6. 免费数据源降级

可选 Key 为空时，当前实现使用以下路径：

| 领域 | 主路径 | 本地免费/公开路径 |
|---|---|---|
| 空气质量 | OpenAQ | WAQI 免费接口 |
| 欧洲电价 | ENTSO-E | Energy-Charts 公共接口 |
| 欧洲储气 | GIE 鉴权接口 | AGSI+ 公共接口 |
| 贸易集中度 | Comtrade 鉴权接口 | UN Comtrade Preview |
| Telegram 新闻 | Telegram API | GDELT 新闻检索 |
| Web 搜索 | Brave/Exa 等 | GDELT 搜索降级 |

免费路径必须保持已有的输出字段和缓存键结构，避免前端因为数据源切换而改变契约。免费接口受到限流或暂时无数据时，接口仍返回合法结构，前端显示空状态或缓存数据。

## 7. 缓存与一致性

- Redis 只通过 Compose 网络和 `redis-rest` 访问。
- `REDIS_PASSWORD` 保护 Redis，`REDIS_TOKEN` 保护 HTTP 适配层。
- 写入数据和元信息应尽量在同一个 seed 流程中完成。
- 请求变化参数必须进入缓存键，避免不同国家、日期或筛选条件互相污染。
- bootstrap 分层加载：快速数据优先，较慢或按需数据延后加载。

## 8. 安全边界

- `.env` 只作为本地运行配置，不进入前端 bundle。
- 浏览器不能直接获得 Redis 凭据或服务端 API Key。
- 上游 URL、查询参数和代理目标必须做白名单或严格校验。
- 本地公开模式只由 Compose 注入，不应在源码中硬编码生产凭据。
- 数据源归因、软件许可证和第三方版权条款保持原样；平台展示层不放置外部项目创建者信息。

## 9. 构建与验证

Docker 构建分三阶段：

1. `builder`：安装依赖、编译 handler、构建静态前端。
2. `runtime-deps`：为未打包 API 准备最小运行依赖。
3. `final`：Nginx、Node sidecar、API 文件、静态资源和 supervisor。

推荐顺序：

```powershell
docker compose -p worldmonitor-local build
docker run --rm worldmonitor-builder:local npm run typecheck
docker run --rm worldmonitor-builder:local npm run typecheck:api
docker compose -p worldmonitor-local up -d --force-recreate
docker compose -p worldmonitor-local ps
```

专项测试使用：

```powershell
docker run --rm `
  -v "${PWD}\tests:/app/tests:ro" `
  worldmonitor-builder:local `
  node --import tsx/esm --test <test-files>
```

主要运行态验收路径：

- `/`
- `/dashboard.html`
- `/dashboard-finance.html`
- `/dashboard-energy.html`
- `/settings.html`
- `/live-channels.html`
- `/embed.html`
- `/api/sidecar-health`
- `/api/bootstrap?tier=fast&public=1`

## 10. 修改规则

- API 不能直接导入浏览器代码；浏览器代码不能读取服务端密钥。
- 新面板必须登记配置、接入数据加载并补充测试。
- 新数据源必须接入 bootstrap 或明确标记为按需数据，并补充健康检查和归因。
- 生成文件按生成流程更新，不直接手改生成结果。
- 修改前端、API、缓存或环境变量后必须重建 Docker 并做页面/API 回归。
