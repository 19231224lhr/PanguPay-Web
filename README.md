# PanguPay Web

PanguPay Web 是 Pangu 快速转账系统的新一代 Vue 前端。当前仓库处于 Phase 0，只包含设计基座、高保真页面切片和 protocol-v2 客户端核心，不连接真实业务后端。

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

Phase 0 页面中的钱包数据均明确标记为演示数据。

## 质量门禁

```powershell
npm run type-check
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

## Phase 0 边界

- 不发送真实交易。
- 不创建或导入真实钱包。
- 不写正式钱包存储。
- 不展示未经实验支持的实时指标。
- `VITE_GATEWAY_URL` 只在 `.env.example` 中预留，Phase 1 才开始接入。
