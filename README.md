# PanguPay Web

PanguPay Web 是 Pangu 转账区的 Vue 钱包前端。它提供浏览器 keystore、组织接入、多地址账户、原始/胶囊地址收款，以及普通、快速、混合和跨链转账的真实构造、签名、提交与状态观察。

## 技术栈

- Vue 3、TypeScript、Vite
- Vue Router、Pinia、Vue I18n
- Vitest、Playwright、Axe
- Phosphor Icons
- CSS Variables、CSS Layers、Scoped CSS

项目不使用 Tailwind、shadcn、Storybook、GSAP 或 Three.js。

## 安装与开发

建议使用 Node `22.21.0` 和 npm `10.9.4`；依赖版本由 `package-lock.json` 固定。

```powershell
npm ci
npm run dev
```

若 npm registry 偶发 `ECONNRESET`，保留缓存并降低并发后重试，不要使用 `--force` 或 `--legacy-peer-deps`：

```powershell
$env:NODE_OPTIONS='--dns-result-order=ipv4first'
$env:npm_config_maxsockets='3'
$env:npm_config_fetch_retries='5'
npm ci --prefer-offline --no-audit --no-fund
```

Gateway 地址通过 `.env` 中的 `VITE_GATEWAY_URL` 配置。部署方式见 [docs/deployment.md](./docs/deployment.md)。

## 正式路由

| 路由                   | 用途                                             |
| ---------------------- | ------------------------------------------------ |
| `/`                    | 品牌首页与钱包入口                               |
| `/wallet/setup`        | 创建钱包、导入加密备份或使用私钥与 RootSeed 恢复 |
| `/wallet/unlock`       | 解锁本地 keystore                                |
| `/wallet/recover`      | 使用独立恢复材料重建 keystore                    |
| `/wallet/entry`        | 恢复身份并选择独立或组织使用方式                 |
| `/wallet`              | 账户、余额和地址总览                             |
| `/wallet/send`         | 普通、快速、混合与跨链转账                       |
| `/wallet/receive`      | 原始地址、胶囊地址、二维码与复制                 |
| `/wallet/activity`     | 交易类型、方向和已知阶段                         |
| `/wallet/security`     | TXCer 凭证、审计和责任份额                       |
| `/wallet/blockchain`   | 只读 GQNC 认证链浏览器                           |
| `/wallet/organization` | 组织详情、加入和安全退出                         |
| `/wallet/settings`     | 本地资料、主题、语言、备份和锁定                 |

`/__foundation` 仅在开发模式注册，不属于正式路由。

## 当前能力与边界

- 金额运算使用精确十进制字符串和 `bigint`，最终交易使用 protocol-v2 64-hex TXID。
- 胶囊地址是可重复使用的签名隐私别名；发送前必须验签并解析为真实 40-hex 地址，跨链暂不接受胶囊地址。
- 快速转账把入口接收、收款方可用和后台 GQNC 结算分开显示。
- 跨链转账把本地 GQNC 认证、轻计算区接收和目标链 receipt 确认分开显示；只有目标链确认后才显示到账。
- 余额和转账快路径不依赖 GQNC 运维接口；`/wallet/blockchain` 只读访问 Gateway 已公开的 GQNC 观测接口，不提供投票、治理或节点控制。
- 加密秘密不写入 LocalStorage；CFAA `Pending/Unavailable` 不阻塞 Active TXCer，完整证据明确失败时才隔离。
- 后端离线时页面标记缓存时间，不把旧快照伪装成最新状态。

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

当前 `check:backend-contract` 对照后端 `gateway/server.go` 验证钱包核心 method/path；完整前端调用矩阵见 [docs/backend-contract.md](./docs/backend-contract.md)。

## 文档

- [产品范围](./PRODUCT.md)
- [设计语言](./DESIGN.md)
- [钱包 UI 操作图谱](./docs/testing/wallet-ui-operation-atlas.md)
- [真实页面验收](./docs/testing/real-browser-acceptance.md)
- [后端契约](./docs/backend-contract.md)
- [部署与回滚](./docs/deployment.md)
- [发布验收记录](./docs/release-acceptance.md)
