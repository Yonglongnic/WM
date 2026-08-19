# AI agent-全球态势监测平台(WM) V1.1 本地开发与维护规则

本文件是当前本地部署项目的工作入口。所有操作只允许在当前项目目录内进行，最终交付形态必须是本地 Docker 镜像和 Docker Compose 服务。

## 运行目标

这是一个 TypeScript + Vite + Preact 的实时全球态势监测应用。生产式本地容器由 Nginx 提供静态文件，由 Node sidecar 分发 API，由 AIS relay 处理中继和缓存刷新，由 Redis 保存运行数据。

本地 Compose 服务：

- `worldmonitor`：端口映射 `3000 -> 8080`，包含前端和 API sidecar。
- `ais-relay`：容器网络端口 `3004`，负责实时数据中继与部分 seed loop。
- `redis`：带密码的内部 Redis 数据卷。
- `redis-rest`：只绑定到本机回环地址的 Redis HTTP 适配层。

Compose 设置 `WM_LOCAL_PUBLIC_ACCESS=true`。该模式是当前验收目标：不要求登录，不要求会员资格，不让认证或付费接口阻塞可公开使用的页面功能。

## 启动与停止

```powershell
docker compose -p worldmonitor-local up -d --build
docker compose -p worldmonitor-local ps
docker compose -p worldmonitor-local down
```

访问地址：<http://localhost:3000>

宿主机不要求 Node.js、npm 或 Python 虚拟环境。构建和测试优先使用 `worldmonitor-builder:local`，避免修改电脑全局环境。

## 安全规则

- 不读取、输出或总结 `.env` 中的密钥值；只允许检查变量是否存在或为空。
- 不把密钥写入源码、日志、截图、测试快照或文档。
- 不使用 `$HOME`、根目录或工作区根目录作为递归删除目标。
- 删除或覆盖文件前先确认准确路径；优先使用可恢复的编辑方式。
- 不修改工作区以外的环境，不安装全局依赖，不启动全局服务。

## 代码边界

```text
types/config -> services -> components -> app -> App.ts
api/         -> 可独立运行的 API 路由
server/      -> API 网关和领域 RPC 处理器
scripts/     -> 数据刷新、relay、构建与质量检查
```

- `api/*.js` 必须保持 Edge 风格的自包含 JavaScript，不能直接导入 `src/`。
- `server/` 代码由 Docker 构建步骤编译或打包到 API 运行面。
- `src/generated/` 是生成文件；修改 proto 后使用项目生成流程更新，不手工改生成结果。
- 数据 seed 必须写入数据键和对应 `seed-meta:<key>`，并保留失败时的最近有效快照。
- 新数据源要同时接入前端消费者、bootstrap 或按需加载、健康检查、来源归因和专项测试。
- 空的可选 API Key 必须有免费公开替代、缓存降级或明确的非阻塞状态。

## 前端行为

- 当前本地模式中，所有正常页面不应出现登录、注册、会员或 PRO 阻断。
- 页面底部、帮助页、嵌入页和静态 SEO 页面不得展示外部项目创建者、原仓库或原作者链接。
- 数据源名称、新闻原发布者、地图底图和软件许可证属于第三方归因，不得伪造或删除到无法遵守条款。
- 修改面板、路由或公共访问行为后，必须检查首页、专题页面、设置、直播和嵌入页面。

## 测试顺序

重型检查在同一个容器内顺序执行，避免并发占用内存：

```powershell
docker run --rm worldmonitor-builder:local npm run typecheck
docker run --rm worldmonitor-builder:local npm run typecheck:api
docker run --rm worldmonitor-builder:local node --check api/telegram-feed.js
docker run --rm worldmonitor-builder:local node --check scripts/ais-relay.cjs
```

专项测试使用项目标准的 `tsx` ESM loader：

```powershell
docker run --rm `
  -v "${PWD}\tests:/app/tests:ro" `
  worldmonitor-builder:local `
  node --import tsx/esm --test <test-files>
```

运行态检查：

```powershell
docker compose -p worldmonitor-local ps
Invoke-WebRequest http://localhost:3000/
Invoke-WebRequest http://localhost:3000/api/sidecar-health
Invoke-WebRequest "http://localhost:3000/api/bootstrap?tier=fast&public=1"
```

不要把 API 响应正文中的敏感数据复制到聊天或日志；验收输出只报告状态码、长度和非敏感结构字段。

## 交付要求

完成代码修改后必须：

1. 重建受影响的 Docker 镜像。
2. 运行类型检查、语法检查和改动相关的专项测试。
3. 启动 Compose，确认所有服务健康。
4. 检查主要页面和关键 API 返回成功。
5. 对失败项修复后重复测试，不能以“外部服务偶发失败”替代本地代码验证。

最终汇报应说明实际执行的检查和未通过的检查，不得声称未执行的测试已通过。
