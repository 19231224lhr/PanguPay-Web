# PanguPay Web

PanguPay Web 是 Pangu 快速转账系统的新一代 Vue 前端。当前已完成 Phase 2：
设计基座、protocol-v2、正式浏览器 keystore、组织接入，以及普通、快速、混合和跨链交易的真实构造、签名与提交。

最新一轮视觉与契约收口进一步补齐了收款二维码、不同转账模式的真实路径说明、活动阶段、TXCer 凭证链、ExposureShares 责任份额和担保组织详情。

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
- `/__foundation`：开发模式下的设计系统陈列页

正式钱包路由：

- `/wallet/setup`：创建或导入钱包
- `/wallet/unlock`：解锁
- `/wallet/recover`：使用独立恢复材料重建本地 keystore
- `/wallet/entry`：恢复组织身份或选择独立/组织使用方式
- `/wallet`：真实账户总览
- `/wallet/send`：普通、快速、混合与跨链交易
- `/wallet/receive`：真实地址、二维码与复制
- `/wallet/activity`：入口、快速可用和后台结算阶段
- `/wallet/security`：TXCer 凭证链与责任份额
- `/wallet/organization`：组织选择与权威详情
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

## 当前安全边界

- 不展示未经实验支持的实时指标。
- 不调用 `/committee/gqnc/*` 等运维接口。
- 加密秘密不写入 LocalStorage；未确认备份前，新钱包不会持久化。
- CFAA 审计状态不阻塞 TXCer 快速可用；FastEvidence、Ack 或责任收据明确失败时隔离 TXCer。
- 页面分别展示“入口已接收”“TXCer 可支付”“后台已结算”，不把它们合并成含糊的成功状态。

真实 UI 操作流程见
[钱包操作图谱](./docs/testing/phase1-wallet-ui-operation-atlas.md)，真实转账结果见
[Phase 2 验证记录](./docs/testing/phase2-real-transfer-validation.md)。
