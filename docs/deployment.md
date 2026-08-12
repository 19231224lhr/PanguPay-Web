# PanguPay Web 部署与回滚

## 构建输入

- Node 与 npm 版本遵循根目录 `package.json`。
- 使用 `npm ci`，不得在服务器临时改写 lockfile。
- `VITE_GATEWAY_URL` 是构建时变量，会写入前端产物；使用环境占位，不把服务器凭据写进仓库。

```powershell
Copy-Item .env.example .env.production.local
# 在私有部署环境中设置 VITE_GATEWAY_URL
npm ci
npm run build
```

发布前必须通过：

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:protocol-v2
npm run test:e2e
npm run check:backend-contract
npm run build
```

## 静态站点要求

- 发布目录为 `dist/`。
- Vue Router 使用 history 模式；Web 服务器必须把不存在的静态路径回退到 `index.html`，否则直接打开 `/wallet/*` 会返回 404。
- 静态资源使用长期缓存；`index.html` 不使用不可撤销的长期缓存。
- 前端与 Gateway 必须通过 HTTPS 或受控本地安全隧道提供安全上下文。若跨域部署，Gateway CORS 只允许明确的前端 origin。
- 不在前端 Web 根目录放置 `.env`、fixture、wallet.json、recovery.json、日志、source map（除非有受控访问）或后端运行目录。

最小 Nginx 语义示例：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Gateway 的具体反向代理、证书和节点启动顺序由后端部署文档负责；本仓库只要求 `VITE_GATEWAY_URL` 能访问健康与钱包公开接口。

## 部署步骤

1. 记录前端和后端候选 SHA、依赖版本与 `dist/` 哈希。
2. 在隔离目录执行门禁和构建，不直接覆盖当前在线目录。
3. 将新 `dist/` 上传到带 SHA 的发布目录。
4. 原子切换 Web 根目录软链接或等价发布指针。
5. 检查 `/` 与所有 `/wallet/*` 路由回退、Gateway `/health`、浏览器控制台和网络错误。
6. 使用全新浏览器站点存储完成创建/导入、同步、一笔普通、一笔快速和一笔跨链冒烟测试。

## 回滚

1. 保留至少一个上一版本 `dist/` 与对应 SHA/哈希。
2. 回滚只切换静态发布指针，不复用未知来源的浏览器存储或测试钱包。
3. 若前端与后端契约同时变化，按兼容矩阵回滚两者；不得让旧前端调用已删除路由。
4. 回滚后重新检查 history fallback、Gateway 健康和一笔只读账户同步。

## 秘密与证据

- 前端部署不需要钱包密码、私钥或 RootSeed；任何要求将这些值写入环境变量的流程都是错误的。
- 真实页面 trace/HAR 不保存请求体、响应体、认证 header、敏感查询参数或恢复文件。
- 报告只记录脱敏 ID、状态码、耗时、余额和区块高度，不记录实际服务器地址或凭据。
