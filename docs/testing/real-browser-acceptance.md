# PanguPay 真实页面验收

本轮最终验收以 Codex 侧边栏浏览器中的真实点击、输入、选择、上传、下载和滚动为准。不得直接调用前端 store、交易构造函数或 service，不得写 LocalStorage 绕过页面，也不得以模拟响应代替真实后端。

Playwright 的模拟 E2E 与可见浏览器编排仍用于辅助回归，但不能单独作为最终发布证据。

## 环境要求

- 全新 4-ComNode 测试状态，GQNC 为 3-of-4。
- 前端和 Gateway 使用候选提交重新构建。
- Alice、Bob 使用隔离的浏览器站点存储或独立 Profile。
- 轻计算区使用专用测试 RPC、gRPC 和收款地址。
- 所有钱包文件、恢复材料和测试密码位于仓库外的临时私有目录，验收后删除。

环境只通过变量提供，不在文档、源码、报告或图谱中写入实际服务器地址、密码或测试秘密：

```powershell
$env:PANGU_REAL_E2E_EXTERNAL_BACKEND='1'
$env:PANGU_REAL_E2E_EXTERNAL_FRONTEND='1'
$env:PANGU_REAL_E2E_BASE_URL='https://frontend.example.test'
$env:PANGU_REAL_E2E_GATEWAY='https://gateway.example.test'
$env:PANGU_REAL_E2E_GROUP_ID='<test-group-id>'
$env:PANGU_REAL_E2E_FIXTURE='<private-fixture-path>'
$env:PANGU_REAL_E2E_LIGHT_RPC='https://light-rpc.example.test'
$env:PANGU_REAL_E2E_LIGHT_GRPC_HOST='<light-grpc-host>'
$env:PANGU_REAL_E2E_LIGHT_RECIPIENT='<test-recipient>'
$env:PANGU_REAL_E2E_LIGHT_UNITS_PER_PGC='1000000000000000000'
$env:PANGU_REAL_E2E_WALLET_PASSWORD='<temporary-test-password>'
$env:PANGU_REAL_E2E_SOAK_COUNT='30'
```

若编排器提供节点控制目录，再设置 `PANGU_REAL_E2E_CONTROL_DIR` 运行 Gateway、Aggregation、CFAA、validator 和轻计算区故障恢复；没有控制能力时不得用模拟响应冒充故障验收。

## 最终侧边栏场景

1. 钱包创建、双备份、锁定、错误/正确解锁、加密备份导入、恢复材料重建和本地清除。
2. 新用户独立使用、组织详情、加入、重新登录恢复归属和带二次确认的安全退出。
3. 地址创建、切换、二维码、复制、归档阻断和安全解绑。
4. 成员/独立账户胶囊生成、复制、验签、篡改拒绝和原始地址回退。
5. 散户普通转账；组织成员快速、纯 TXCer、混合和胶囊地址转账。
6. 跨链本地认证、轻计算区接收、目标链 receipt、余额增加和重启后幂等恢复。
7. 凭证、安全、活动、区块链、组织和设置页逐项核对。
8. Obsidian/Pearl、中英文、桌面/手机、键盘焦点和 reduced-motion。
9. Gateway、Aggregation、CFAA、validator 和轻计算区的可控暂停/恢复。
10. Alice/Bob 通过页面执行 30 笔连续快速往返。

任何 `SAFETY_BREACH`、`WAIT_EXTERNAL_RECOVERY`、余额不守恒、重复 TXID、重复跨链入账或秘密泄露都必须停止验收并保存脱敏证据。

## 辅助自动化

本地由脚本创建全新后端时：

```powershell
npm run test:e2e:real
```

本轮发布 soak 固定为 30 笔，可通过 `PANGU_REAL_E2E_SOAK_COUNT=30` 显式确认。`npm run test:e2e:real:full` 仍是 500 笔长期研究 soak，不属于本轮发布阻断门禁。

## 证据与脱敏

允许保留：

- 页面截图、失败视频和 trace。
- method、path、状态码和耗时；HAR 中不保留 origin。
- 脱敏后的 TXID、TXCerID、QCID、认证高度、`lightTxHash` 和目标区块。
- 操作前后精确余额、TXCer 可用耗时、前端观测延迟和 GQNC/跨链结算耗时。

禁止保留：

- 密码、私钥、RootSeed、恢复材料和 raw transaction。
- HAR 请求体/响应体、认证 header、敏感查询参数或未脱敏 fixture。
- 实际服务器凭据或个人机器路径。

## 判定

- 13 个正式路由和全部当前钱包能力都通过真实页面到达。
- 普通、快速、纯 TXCer、混合、胶囊和跨链交易使用真实后端完成。
- 30/30 快速转账被接收并最终认证，无重复扣款、遗失 TXCer、卡死 reservation 或余额不守恒。
- TXCer 后端可用耗时、前端观测延迟、GQNC 结算耗时分别记录，不互相冒充。
- 最终结果只在 [发布验收记录](../release-acceptance.md) 中填写；未执行项目保持“待验证”，不得预填通过。
