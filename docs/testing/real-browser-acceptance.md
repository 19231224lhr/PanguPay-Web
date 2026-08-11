# PanguPay 真实页面验收

这套测试与 `e2e/phase2.spec.ts` 的模拟响应回归完全隔离。它启动全新的
4-ComNode 后端状态，生成一次性钱包 fixture，并使用两个独立、可见的 Edge
Profile 完成真实点击、输入、文件上传、下载、普通/快速/胶囊/跨链转账和故障恢复。

## 命令

```powershell
# 功能闭环、节点故障恢复和 30 笔可见页面往返
npm run test:e2e:real

# 同样的功能闭环，再执行 500 笔发布 soak
npm run test:e2e:real:full
```

默认使用兄弟目录 `../UTXO-Area`，由
`scripts/dev-backend-smoke.ps1` 创建全新数据库。测试结束时停止全部节点，并删除
临时浏览器 Profile、fixture、wallet.json、recovery.json、私钥和 RootSeed。

## 轻计算区

默认使用仓库 README 中的测试地址和当前测试轻计算区：

- JSON-RPC：`http://47.243.174.71:36054`
- gRPC host：`47.243.174.71`
- 测试收款地址：`0x742d35cc6634c0532925a3b844bc454e4438f44e`

可覆盖：

```powershell
$env:PANGU_REAL_E2E_LIGHT_RPC='http://host:port'
$env:PANGU_REAL_E2E_LIGHT_GRPC_HOST='host'
$env:PANGU_REAL_E2E_LIGHT_RECIPIENT='0x...'
$env:PANGU_REAL_E2E_LIGHT_UNITS_PER_PGC='1000000000000000000'
```

测试只使用测试资金。目标地址必须是测试地址。

## 外部专用服务器

服务器已经由独立编排器重建全新状态时，可以让本套件只负责真实浏览器：

```powershell
$env:PANGU_REAL_E2E_EXTERNAL_BACKEND='1'
$env:PANGU_REAL_E2E_EXTERNAL_FRONTEND='1'
$env:PANGU_REAL_E2E_BASE_URL='https://test.example'
$env:PANGU_REAL_E2E_GATEWAY='https://test.example'
$env:PANGU_REAL_E2E_GROUP_ID='10000000'
$env:PANGU_REAL_E2E_FIXTURE='C:\private\fixture.json'
npm run test:e2e:real
```

如果外部编排器提供与 smoke runner 相同的节点控制目录，可设置
`PANGU_REAL_E2E_CONTROL_DIR`，运行 Gateway、Aggregation、CFAA 和 validator
故障恢复场景；没有控制目录时外部模式不会伪造这些故障。

## 证据与隐私

脱敏结果位于 `artifacts/real-e2e/<timestamp>/`：

- `playwright-results.json`、HTML 报告；
- 功能场景 trace、视频、最小 HAR；
- 仅含 method、origin、path、状态码和耗时的网络摘要；
- 失败截图；
- `soak-progress.json` 与首尾斜率、p50/p95 摘要。

密码输入发生在 trace 开始前。HAR 不保存请求体、响应体、查询参数或请求头。
证据写入前还会递归清除 password、private key、RootSeed、recovery、raw transaction
等敏感字段。

## 判定

500 笔发布 soak 会自动拒绝以下结果：

- 接收或认证不是 500/500；
- TXCer 后端可用 p95 超过 100 ms；
- GQNC 结算 p95 超过 350 ms；
- 前端观测 p95 超过 1 s；
- 最后 100 笔中位数比前 100 笔增长超过 20%。

功能用例按编号执行，公开地址写入 `public-state.json` 供后续故障和 soak 使用；
该文件不包含账户密钥或恢复材料。
