# PanguPay Web 后端契约

## 权威来源

本文件记录 `src/services/gatewayClient.ts` 当前实际调用。后端路由以 `UTXO-Area/gateway/server.go` 为准；`npm run check:backend-contract` 直接扫描该文件，当前自动验证其中 20 条钱包核心 method/path。

新增、删除或修改客户端调用时，必须同时更新客户端、后端路由、契约检查和本表。不要维护第四套路由常量。

## 调用矩阵

“门禁”表示当前 `check:backend-contract` 已自动核对；未覆盖项仍是生产调用，应在后续最小修改中纳入同一脚本。

| Method | Path                                              | 用途                                              | 门禁 |
| ------ | ------------------------------------------------- | ------------------------------------------------- | ---- |
| GET    | `/health`                                         | Gateway 健康                                      | 是   |
| GET    | `/api/v1/com/health`                              | 散户入口与跨链能力                                | 否   |
| GET    | `/api/v1/committee/endpoint`                      | 当前委员会入口发现                                | 是   |
| GET    | `/api/v1/groups`                                  | 可用担保组织                                      | 是   |
| GET    | `/api/v1/groups/{id}`                             | 组织权威详情                                      | 是   |
| POST   | `/api/v1/re-online`                               | 钱包身份恢复与路由发现                            | 是   |
| POST   | `/api/v1/com/register-address`                    | 独立账户地址登记                                  | 是   |
| POST   | `/api/v1/{groupID}/assign/flow-apply`             | 申请加入组织                                      | 是   |
| POST   | `/api/v1/{groupID}/assign/new-address`            | 组织成员新地址登记                                | 否   |
| POST   | `/api/v1/{groupID}/assign/unbind-address`         | 组织地址解绑                                      | 否   |
| POST   | `/api/v1/com/query-address`                       | 地址余额与状态查询                                | 是   |
| POST   | `/api/v1/com/query-address-group`                 | 地址组织归属查询                                  | 是   |
| GET    | `/api/v1/{groupID}/assign/account-update`         | 非破坏性账户更新，客户端固定 `consume=false`      | 是   |
| GET    | `/api/v1/{groupID}/assign/group-info`             | Assign 权威组织详情                               | 是   |
| POST   | `/api/v1/{groupID}/assign/capsule/generate`       | 成员胶囊生成                                      | 否   |
| POST   | `/api/v1/com/capsule/generate`                    | 独立账户胶囊生成                                  | 否   |
| GET    | `/api/v1/org/publickey`                           | 组织胶囊验签公钥                                  | 否   |
| GET    | `/api/v1/com/public-key`                          | 委员会胶囊验签公钥                                | 否   |
| GET    | `/api/v1/{groupID}/assign/txcer-statuses`         | TXCer 生命周期                                    | 是   |
| GET    | `/api/v1/{groupID}/aggr/txcer-issuance-records`   | 签发证据，客户端固定 `includeProof=true`          | 是   |
| GET    | `/api/v1/{groupID}/assign/certifiers`             | 权威 Certifier 上下文                             | 是   |
| POST   | `/api/v1/{groupID}/assign/submit-tx`              | 成员普通/快速/混合/跨链提交                       | 是   |
| GET    | `/api/v1/{groupID}/assign/tx-status/{txID}`       | Assign 交易状态                                   | 是   |
| GET    | `/api/v1/{groupID}/assign/scheduler-dag-events`   | 交易调度事件                                      | 否   |
| GET    | `/api/v1/committee/gqnc/status`                   | 区块链页只读委员会状态                            | 是   |
| GET    | `/api/v1/committee/gqnc/certified-block/{height}` | 区块链页只读认证区块                              | 是   |
| GET    | `/api/v1/committee/gqnc/performance`              | 区块链页只读性能摘要                              | 否   |
| GET    | `/api/v1/committee/cross-chain/transfers/{txID}`  | 跨链 outbox 与目标链终局状态                      | 否   |
| POST   | `/api/v1/com/submit-noguargroup-tx`               | 独立账户普通交易提交                              | 是   |
| GET    | `/api/v1/{groupID}/assign/poll-cross-org-txcers`  | 跨组织 TXCer 无损轮询，客户端固定 `consume=false` | 是   |

## 共同数据规则

- 金额使用规范十进制字符串；运算和比较使用 `bigint`，显示值不得回流到签名材料。
- TXID、TXCerID 和 QCID 按各自协议长度校验；交易 TXID 必须为 64-hex。
- `stringifyGatewayJSON` 负责兼容 Go 旧 ECDSA 大整数；不得用普通 `JSON.stringify` 直接序列化含 `bigint` 的协议对象。
- 客户端请求默认 6 秒超时；超时或网络失败不等于交易失败，已提交交易必须按同一 TXID 恢复查询。
- 后端错误只转换为用户可理解的状态；页面不得显示内部堆栈、节点秘密或 raw transaction。

## 关键失败语义

- 账户同步：离线时保留并标记缓存时间，不把缓存当最新状态。
- 胶囊：长度、checksum、组织 ID、公钥曲线或签名任一失败都在选币前拒绝；原始地址路径不增加公钥请求。
- TXCer：CFAA `Pending/Unavailable` 不阻塞 Active；FastEvidence、AssignAck 或 LiabilityReceipt 明确失败时隔离。
- 跨链：GQNC 本地认证后继续查询状态接口；只有 `TARGET_CONFIRMED` 才显示到账，`NEEDS_RECOVERY` 不伪造失败回滚。
- GQNC 观测：只供 `/wallet/blockchain` 展示，不参与余额、选币、签名或提交快路径。

## 契约门禁

```powershell
$env:PANGU_BACKEND_REPO='<path-to-UTXO-Area>'
npm run check:backend-contract
```

当前脚本覆盖 20/30 条调用。发布前应以源码和本表人工核对其余 10 条；扩展脚本后再把本句更新为完整自动覆盖，不得提前声称 30/30。
