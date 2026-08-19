# 本地 Docker 部署

本说明适用于当前项目的单机本地部署。所有服务由 Docker Compose 管理，宿主机不需要安装 Node.js、npm 或 Python 虚拟环境。

## 前置条件

- Docker Desktop 或兼容的 Docker Engine；
- Docker Compose v2；
- 当前项目目录中的 `.env`。

## 启动

首次启动：

```powershell
docker compose -p worldmonitor-local up -d --build
```

已构建镜像的后续启动：

```powershell
docker compose -p worldmonitor-local up -d --no-build
```

访问 <http://localhost:3000>。

## 必需的本地凭据

Compose 启动前，`.env` 需要包含以下三项。它们只用于当前项目容器之间的通信，不会写入前端：

| 变量 | 作用 |
|---|---|
| `RELAY_SHARED_SECRET` | worldmonitor 与 AIS relay 的内部共享凭据 |
| `REDIS_PASSWORD` | Redis AUTH 密码 |
| `REDIS_TOKEN` | Redis REST 适配层的访问令牌 |

可以在当前目录内生成随机值，例如：

```powershell
$bytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$value = -join ($bytes | ForEach-Object { $_.ToString('x2') })
```

不要把真实值粘贴到聊天、日志或版本库。

## 可选数据源

数据源 Key 都是可选项。当前空 Key 的替代路径如下：

| 空变量 | 运行时行为 |
|---|---|
| `OPENAQ_API_KEY` | 使用 WAQI 免费数据 |
| `ENTSO_E_TOKEN` | 使用 Energy-Charts 公共数据 |
| `GIE_API_KEY` | 使用 AGSI+ 公共数据 |
| `COMTRADE_API_KEYS` | 使用 UN Comtrade Preview |
| `TELEGRAM_API_ID` | 使用 GDELT 新闻降级 |
| `BRAVE_API_KEYS` | 使用 GDELT 搜索降级 |

可选 Key 缺失不会让普通页面失效。上游限流或无数据时，面板会使用缓存、空状态或降级结构。

## 服务状态

```powershell
docker compose -p worldmonitor-local ps
```

主要检查地址：

- <http://localhost:3000/>
- <http://localhost:3000/api/sidecar-health>
- <http://localhost:3000/api/bootstrap?tier=fast&public=1>

停止但保留缓存卷：

```powershell
docker compose -p worldmonitor-local down
```

停止并删除本项目的 Redis 数据卷：

```powershell
docker compose -p worldmonitor-local down -v
```

删除数据卷后需要重新等待数据刷新；请确认目标确实是本项目的 Compose 卷。

## 故障排查

| 现象 | 检查 |
|---|---|
| 容器没有变为 healthy | 查看 `docker compose -p worldmonitor-local ps` 和容器日志 |
| 页面 200 但数据为空 | 检查 bootstrap 响应状态、Redis 是否健康、上游是否临时限流 |
| Relay 不可用 | 检查 `RELAY_SHARED_SECRET` 是否在两个服务中一致 |
| Redis REST 不可用 | 检查 `REDIS_TOKEN`、`REDIS_PASSWORD` 和本机 8079 端口 |
| 修改未生效 | 使用 `docker compose -p worldmonitor-local build` 后强制重建容器 |

## 安全边界

- 不把 Redis、sidecar 或 relay 端口暴露到公网。
- 不把 `.env` 复制到前端静态目录。
- 不在浏览器代码中放置上游 API Key。
- 外部数据源的名称、许可证和归因按各自条款保留。
