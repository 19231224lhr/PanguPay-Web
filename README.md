# PanguPay Web

PanguPay Web 是 Pangu 快速转账系统的新一代 Vue 前端。当前已完成 Phase 1：
设计基座、protocol-v2、正式浏览器 keystore、真实只读账户同步和“流动账本”钱包框架。
真实交易签名与提交将在 Phase 2 接入。

## 技术栈

- Vue 3、TypeScript、Vite
- Vue Router、Pinia、Vue I18n
- Vitest、Playwright、Axe
- Phosphor Icons
- CSS Variables、CSS Layers、Scoped CSS

项目不使用 Tailwind、shadcn、Storybook、GSAP 或 Three.js。

## 安装

建议使用 Node `22.21.0` 和 npm `10.9.4`。依赖版本由 `package-lock.json` 固定：

```powershell
npm ci
```

当前锁文件已经解决 create-vue 初始模板中的两个安装问题：

- `oxlint` 与 `eslint-plugin-oxlint` 使用一致的 `1.75.x` 版本，不再发生 peer dependency 冲突。
- 不再依赖要求 Node `22.22.2` 的 `npm-run-all2`，构建和 lint 使用 npm 原生串行脚本。

如果本机访问 npm registry 偶发 `ECONNRESET`，不要使用 `--force` 或 `--legacy-peer-deps`。保留已经下载的 npm 缓存并降低连接并发后重试：

```powershell
$env:NODE_OPTIONS='--dns-result-order=ipv4first'
$env:npm_config_maxsockets='3'
$env:npm_config_fetch_retries='5'
npm ci --prefer-offline --no-audit --no-fund
```

Playwright 使用系统 Microsoft Edge，不下载额外浏览器镜像。

## 开发

```powershell
npm run dev
```

内部评审页面：

- `/`：无导航沉浸式首页
- `/__ledger-preview`：响应式流动账本钱包框架
- `/__foundation`：设计系统陈列页

正式钱包路由：

- `/wallet/setup`：创建或导入钱包
- `/wallet/unlock`：解锁
- `/wallet`：真实只读账户总览
- `/wallet/send`：Phase 2 前的安全发送预览
- `/wallet/receive`：真实地址选择与复制
- `/wallet/activity`：账户活动
- `/wallet/security`：TXCer 凭证与安全
- `/wallet/organization`：担保组织
- `/wallet/settings`：备份与锁定

Gateway 地址通过 `.env` 的 `VITE_GATEWAY_URL` 配置；后端离线时，页面明确显示缓存时间，
不会把旧快照伪装成最新数据。

## 质量门禁

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

生成本地视觉评审截图：

```powershell
npm run dev -- --host 127.0.0.1 --port 5174
npm run capture:visual
```

设计原则见 [DESIGN.md](./DESIGN.md)，产品范围见 [PRODUCT.md](./PRODUCT.md)。

## Phase 1 边界

- 不发送真实交易。
- 不展示未经实验支持的实时指标。
- 不调用 `/committee/gqnc/*` 等运维接口。
- 加密秘密不写入 LocalStorage；未确认备份前，新钱包不会持久化。

真实 UI 操作流程见
[Phase 1 操作图谱](./docs/testing/phase1-wallet-ui-operation-atlas.md)。
