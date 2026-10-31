# Strack・校园点歌台

> 
> 项目简介：面向校园广播站的**校园点歌与节目排期平台**，服务全校师生，实现线上查歌、搜歌、提交点歌申请，广播站管理员后台管理每日点歌曲目、栏目公告。采用**Vue3 单页前端 + Hono 后端同仓一体化开发**；本地使用 Bun 运行，线上一键部署至 Cloudflare Pages。

## 核心功能列表

### 学生端（普通用户）

1. **日历排期视图**
以日历组件展示未来 21 天广播站可点歌栏位，点击日期即可查看当日待播放曲目、点歌人信息、歌曲详情；直观了解广播站节目排期。
2. **多源音乐搜索**
聚合网易云音乐、咪咕音乐音乐源，关键词检索歌曲，支持分页加载，内置在线试听功能，方便学生挑选想要点播的歌曲。
3. **提交点歌申请**
填写点歌信息：接收人、祝福语、选择播放日期；支持两种身份校验：

- 表单校验：填写**姓名、学号、班级**基础信息提交申请
- 对接校园统一账号 `hlzhjy.com`：验证码登录完成身份核验后提交点歌，防止恶意刷点歌。

4. **内置音乐播放器**
歌曲详情浮层内直接播放音乐试听；播放状态全局由 Pinia 状态库统一管控，页面切换不中断播放。
5. **校园公告栏**
用户首次进入网站自动弹出广播站公告；提供「不再提示」选项，配置保存到浏览器本地存储；无公告数据时公告入口自动隐藏，不干扰页面。

### 管理员后台（广播站运维）

管理员登录后，对整个点歌业务进行管理，凭证签名 + JWT Cookie 双重安全校验：

1. 按日期查看、删除用户提交的点歌曲目；
2. 启用 / 关闭指定日期的点歌栏位（例如节假日广播站停播，关闭当日点歌）；
3. 编辑、新增、删除广播站公告内容；

## 技术栈与整体架构

| 分层 | 技术选型 |
| --- | --- |
| 前端 SPA | Vue3（`<script setup>`）+ TypeScript + Vite + TailwindCSS + Pinia + Vue‑Router |
| 后端服务 | Hono（基于 Web 标准 Request / Response API，支持多运行时同构） |
| 运行环境 | 本地：Bun 适配器；线上：Cloudflare Pages Functions |
| 数据存储 | Cloudflare KV，使用 unstorage 做存储层封装，屏蔽底层 KV 细节 |
| 工具库 | ofetch（网络请求）、crypto‑js（接口响应加密、签名校验）、xss（输入内容过滤防 XSS 攻击） |

### 请求流转逻辑

- **本地开发**：浏览器请求 → Vite 代理转发 `/api/*` → 本地 Bun 后端服务（默认 3200 端口）
- **线上生产**：`functions/api/[[route]].ts` 接管全部 `/api/*` 接口请求；其余路由交给 Cloudflare Pages 静态资源，Vue SPA 前端路由兜底。

后端业务划分为三大模块挂载路由：`music`音乐搜索试听、`order`点歌订单业务、`admin`管理员后台接口。
公共能力由中间件统一处理：统一接口响应封装、ETag 缓存、AI 爬虫拦截、权限校验。

### 项目目录结构

```
strack‑school‑song/
├─ src/                     # Vue3前端源代码
│  ├─ views/                # 页面视图：日历排期、搜歌点歌、个人提交记录、管理员后台
│  ├─ components/           # 公共组件：日历、播放器浮层、公告弹窗、表单组件
│  ├─ stores/               # Pinia全局状态：播放器状态、用户登录状态
│  └─ router/               # Vue Router路由配置
├─ backend/                 # Hono后端代码
│  ├─ app.ts                # Hono应用入口
│  ├─ router/               # music / order / admin 业务路由
│  ├─ middleware/           # 全局中间件：鉴权、签名、爬虫拦截、跨域
│  ├─ module/               # 业务逻辑模块
│  └─ plugin/               # 第三方音乐源适配插件
├─ shared/                  # 前后端共享代码（重要！类型、签名加密工具，两边共用）
├─ functions/api/           # Cloudflare Pages Functions 入口文件
├─ public/                  # 前端静态资源
├─ dist/                    # 前端构建输出产物
└─ wrangler.jsonc           # Cloudflare配置：Pages、KV命名空间绑定
```

## 贡献

项目采用 MIT 开源协议，欢迎贡献代码。前端可以随便改，后端需要根据数据库表结构实现。

## 本地开发环境

### 环境依赖

- 推荐：Bun
- 兼容备选：Node.js 20+，pnpm 包管理器

```
# 安装全部依赖（前后端）
bun install

# 复制环境变量模板，配置本地密钥，.dev.vars 不会提交到git仓库
# 参考下方环境变量说明填写
bun run dev
```

### 项目脚本命令

| 脚本命令 | 功能说明 |
| --- | --- |
| `bun run dev` | **日常开发用**，并行启动 Vite 前端 (5173) + Bun 后端 API (3200) |
| `bun run dev:web` | 仅启动 Vue 前端，不启动后端 |
| `bun run dev:api` | 仅单独启动 Hono 后端 API 服务 |
| `bun run build` | TS 类型校验 + 编译打包前端生成 dist 静态产物 |
| `bun run dev:cf` | 本地模拟 Cloudflare Pages Functions 运行时联调 |
| `bun run deploy:cf` | 构建项目并一键部署到 Cloudflare Pages |
| `bun run preview` | 本地预览打包后的 dist 生产产物 |

## 部署说明 & 环境变量

部署平台：Cloudflare Pages

1. 在 `wrangler.jsonc` 配置文件完成 KV 存储命名空间绑定，绑定变量别名 `CF_KV`
2. 执行部署脚本 `bun run deploy:cf`
3. **敏感密钥不要写代码仓库**：线上通过 wrangler 命令设置密钥：
`wrangler pages secret put 变量名`
本地开发把变量写在项目根目录 `.dev.vars`（gitignore 忽略，不会上传）

### 全部环境变量清单

| 环境变量 | 作用说明 |
| --- | --- |
| `ALLOWED_ORIGINS` | CORS 跨域允许来源；`*`代表全部允许，生产环境建议写域名 |
| `ADMIN_NAME` | 广播站管理员登录账号 |
| `ADMIN_PASSWORD` | 管理员登录密码；内部使用 HMAC‑MD5 + 密钥比对校验 |
| `ADMIN_SECRET_KEY` | 管理员接口请求签名密钥，用于接口防篡改 |
| `SCHOOL_NAME` | 本校学校名称，校园账号登录时做校验 |
| `JWT_SECRET_KEY` | 签发、解析管理员 JWT 令牌；存储在 Cookie `stracktoken` |
| `PORT` | 本地 Bun 后端端口，默认 `3200` |

> ⚠️ 项目仓库不会存放任何真实密钥。如果你修改了 `shared/` 目录下签名、加密工具函数，**必须重新构建前端 dist**，保证前后端加密解密规则完全一致，否则接口会签名校验失败。